// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20, IFactoryLite } from "./Interfaces.sol";

contract Market {
    enum TokenType { Native, ERC20 }

    address public factory;
    uint64 public eventId;
    bool public isOpen;
    bool public cancelled;

    // fees
    uint16 public feeBps; // basis points (1e4 == 100%)
    address public feeRecipient;

    // token config
    TokenType public tokenType;
    address public token; // ERC20 address if tokenType == ERC20

    // pools and stakes
    mapping(uint16 => uint256) public selectionPools;
    mapping(address => mapping(uint16 => uint256)) public stakes; // bettor => selectionId => amount
    mapping(uint16 => uint256) public selectionBetCounts; // number of bets per selection
    mapping(address => uint256) public feesPaid; // cumulative fees paid by bettor within this market

    // settlement & claims
    uint16 public winningSelection;
    bool public settled;
    bool public isPush;
    bool public inDispute; // blocks claims while true
    mapping(address => bool) public claimed;
    uint256 public payoutMultiplier; // fixed-point with 1e18, so payout = stake * payoutMultiplier / 1e18
    uint256 public bonusPool; // extra funds locked at settlement and distributed to winners pro-rata
    uint64 public settlementTime; // timestamp recorded at settlement or cancellation

    // home/away and spread set at creation
    uint16 public homeSelectionId;
    uint16 public awaySelectionId;
    int16 public spreadTenths; // spread in tenths of a point (e.g., 5 = 0.5)
    bool public spreadAppliesToHome; // true: spread applies to home, false: applies to away

    // timing and limits
    uint64 public startTime;   // optional, 0 means no restriction
    uint64 public cutoffTime;  // optional, 0 means open until manually closed
    uint256 public minBet;     // optional, 0 means no min
    uint256 public maxBet;     // optional, 0 means no max (gross amount)

    // score oracle
    address public oracle;
    uint16 public homeScoreFinal;
    uint16 public awayScoreFinal;
    bool public scoresSet;

    event BetPlaced(address indexed bettor, uint16 indexed selectionId, uint256 stake, uint256 fee);
    event Settled(uint16 indexed winningSelection, uint256 totalPool, uint256 winningPool, uint256 payoutMultiplier);
    event Claimed(address indexed bettor, uint256 payout);
    event ConfigUpdated(uint16 feeBps, address feeRecipient);
    event ScoresSet(uint16 homeScore, uint16 awayScore, bool isPush, uint16 winningSelection);
    event SpreadUpdated(int16 newSpreadTenths);
    event MarketClosed();
    event MarketCancelled();
    event BonusLocked(uint256 bonusPool);
    event TimesUpdated(uint64 startTime, uint64 cutoffTime);
    event LimitsUpdated(uint256 minBet, uint256 maxBet);

    // simple reentrancy guard
    bool private _entered;
    modifier nonReentrant() {
        require(!_entered, "reentrancy");
        _entered = true;
        _;
        _entered = false;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "not factory");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == factory || msg.sender == feeRecipient, "not admin");
        _;
    }

    constructor(
        address _factory,
        uint64 _eventId,
        TokenType _tokenType,
        address _token,
        uint16 _feeBps,
        address _feeRecipient,
        uint16 _homeSelectionId,
        uint16 _awaySelectionId,
        int16 _spreadTenths,
        bool _spreadAppliesToHome,
        address _oracle
    ) {
        require(_factory != address(0), "factory required");
        require(_feeRecipient != address(0), "fee recipient required");
        factory = _factory;
        eventId = _eventId;
        isOpen = true;
        tokenType = _tokenType;
        token = _token;
        feeBps = _feeBps;
        // route fees to the factory as requested
        feeRecipient = _factory;
        homeSelectionId = _homeSelectionId;
        awaySelectionId = _awaySelectionId;
        spreadTenths = _spreadTenths;
        spreadAppliesToHome = _spreadAppliesToHome;
        oracle = _oracle;
    }

    // compact selection ids avoid string hashing overhead; off-chain maps names -> ids

    // Place bet in native coin (SEI); attribute stake to `bettor`
    function placeBetNative(address bettor, uint16 selectionId) external payable nonReentrant {
        require(bettor != address(0), "invalid bettor");
        require(isOpen, "market closed");
        require(tokenType == TokenType.Native, "native only");
        require(msg.value > 0, "no value");
        require(selectionId == homeSelectionId || selectionId == awaySelectionId, "invalid selection");
        if (startTime > 0) require(block.timestamp >= startTime, "not started");
        if (cutoffTime > 0) require(block.timestamp <= cutoffTime, "bets closed");
        if (minBet > 0) require(msg.value >= minBet, "below minBet");
        if (maxBet > 0) require(msg.value <= maxBet, "above maxBet");
        uint256 fee = (msg.value * feeBps) / 10000;
        uint256 stake = msg.value - fee;
        (bool ok, ) = feeRecipient.call{value: fee}("");
        require(ok, "fee transfer failed");
        feesPaid[bettor] += fee;

        stakes[bettor][selectionId] += stake;
        selectionPools[selectionId] += stake;
        selectionBetCounts[selectionId] += 1;

        // push referral tracking to factory (count and net stake amount)
        IFactoryLite(factory).updateUserBetAmount(bettor, stake);

        emit BetPlaced(bettor, selectionId, stake, fee);
    }

    // Place bet in ERC20 token (x402Bet token); attribute stake to `bettor`
    function placeBetERC20(address bettor, uint16 selectionId, uint256 amount) external nonReentrant {
        require(bettor != address(0), "invalid bettor");
        require(isOpen, "market closed");
        require(tokenType == TokenType.ERC20, "erc20 only");
        require(token != address(0), "x402Bet token not set");
        require(amount > 0, "no amount");
        require(selectionId == homeSelectionId || selectionId == awaySelectionId, "invalid selection");
        if (startTime > 0) require(block.timestamp >= startTime, "not started");
        if (cutoffTime > 0) require(block.timestamp <= cutoffTime, "bets closed");
        if (minBet > 0) require(amount >= minBet, "below minBet");
        if (maxBet > 0) require(amount <= maxBet, "above maxBet");
        IERC20 erc = IERC20(token);
        // measure actual received to handle deflationary tokens
        uint256 beforeBal = erc.balanceOf(address(this));
        require(erc.transferFrom(bettor, address(this), amount), "transferFrom failed");
        uint256 afterBal = erc.balanceOf(address(this));
        uint256 received = afterBal - beforeBal;
        require(received > 0, "no tokens received");
        uint256 fee = (received * feeBps) / 10000;
        uint256 stake = received - fee;
        require(erc.transfer(feeRecipient, fee), "fee transfer failed");
        feesPaid[bettor] += fee;

        stakes[bettor][selectionId] += stake;
        selectionPools[selectionId] += stake;
        selectionBetCounts[selectionId] += 1;

        // push referral tracking to factory (count and net stake amount)
        IFactoryLite(factory).updateUserBetAmount(bettor, stake);

        emit BetPlaced(bettor, selectionId, stake, fee);
    }

    // Credit ERC20 bet amounts forwarded by Factory in unified create+bet flow
    function creditBetERC20FromFactory(address bettor, uint16 selectionId, uint256 received) external nonReentrant onlyFactory {
        require(bettor != address(0), "invalid bettor");
        require(isOpen, "market closed");
        require(tokenType == TokenType.ERC20, "erc20 only");
        require(token != address(0), "x402Bet token not set");
        require(received > 0, "no amount");
        require(selectionId == homeSelectionId || selectionId == awaySelectionId, "invalid selection");
        if (startTime > 0) require(block.timestamp >= startTime, "not started");
        if (cutoffTime > 0) require(block.timestamp <= cutoffTime, "bets closed");
        if (minBet > 0) require(received >= minBet, "below minBet");
        if (maxBet > 0) require(received <= maxBet, "above maxBet");
        IERC20 erc = IERC20(token);
        uint256 fee = (received * feeBps) / 10000;
        uint256 stake = received - fee;
        require(erc.transfer(feeRecipient, fee), "fee transfer failed");
        feesPaid[bettor] += fee;

        stakes[bettor][selectionId] += stake;
        selectionPools[selectionId] += stake;
        selectionBetCounts[selectionId] += 1;

        IFactoryLite(factory).updateUserBetAmount(bettor, stake);

        emit BetPlaced(bettor, selectionId, stake, fee);
    }

    // Internal scorer: computes winner based on spread and final scores
    function _settleWithScores(uint16 homeScore, uint16 awayScore) internal {
        require(isOpen, "already closed");
        isOpen = false;
        settled = true;
        inDispute = false;
        homeScoreFinal = homeScore;
        awayScoreFinal = awayScore;
        scoresSet = true;
        settlementTime = uint64(block.timestamp);
        // compare margin vs spread (tenths of point)
        int256 marginTenths = (int256(uint256(homeScore)) - int256(uint256(awayScore))) * 10;
        if (spreadAppliesToHome) {
            marginTenths -= int256(spreadTenths);
        } else {
            marginTenths += int256(spreadTenths);
        }
        uint256 totalPool = selectionPools[homeSelectionId] + selectionPools[awaySelectionId];
        if (marginTenths == 0) {
            // push: refund all stakes
            isPush = true;
            winningSelection = homeSelectionId; // arbitrary; claim handles push
            payoutMultiplier = 1e18;
            emit ScoresSet(homeScore, awayScore, true, winningSelection);
            emit Settled(winningSelection, totalPool, 0, payoutMultiplier);
            return;
        }
        uint16 winner = marginTenths > 0 ? homeSelectionId : awaySelectionId;
        winningSelection = winner;
        uint256 winningPool = selectionPools[winner];
        require(winningPool > 0, "no winners");
        uint256 loserPool = totalPool - winningPool;
        // Lock extra funds present at settlement as a bonus pool
        uint256 balanceAtSettlement;
        if (tokenType == TokenType.Native) {
            balanceAtSettlement = address(this).balance;
        } else {
            IERC20 erc = IERC20(token);
            balanceAtSettlement = erc.balanceOf(address(this));
        }
        bonusPool = balanceAtSettlement > totalPool ? (balanceAtSettlement - totalPool) : 0;
        emit BonusLocked(bonusPool);
        // payout multiplier: 1 + (loserPool + bonusPool) / winningPool (fixed-point)
        payoutMultiplier = (((loserPool + bonusPool) * 1e18) / winningPool) + 1e18;
        emit ScoresSet(homeScore, awayScore, false, winningSelection);
        emit Settled(winningSelection, totalPool, winningPool, payoutMultiplier);
    }

    // Oracle sets final score
    function setScoresOracle(uint16 homeScore, uint16 awayScore) external {
        require(msg.sender == oracle, "not oracle");
        require(!settled, "already settled");
        _settleWithScores(homeScore, awayScore);
    }

    // Admin sets final score
    function setScoresAdmin(uint16 homeScore, uint16 awayScore) external onlyAdmin {
        require(!settled, "already settled");
        _settleWithScores(homeScore, awayScore);
    }

    // Claim payout for a bettor after settlement
    function claim() external nonReentrant {
        require(settled, "not settled");
        require(!inDispute, "in dispute");
        // 15-minute wait only applies to markets with eventId = 0
        if (eventId == 0) {
            require(settlementTime > 0 && block.timestamp >= (uint256(settlementTime) + 15 minutes), "claim wait 15m");
        }
        require(!claimed[msg.sender], "already claimed");
        uint256 payout;
        if (isPush || cancelled) {
            // refund both sides stakes
            uint256 stakeHome = stakes[msg.sender][homeSelectionId];
            uint256 stakeAway = stakes[msg.sender][awaySelectionId];
            payout = stakeHome + stakeAway;
            require(payout > 0, "no stake to refund");
            // if cancelled, also refund fees via factory
            if (cancelled) {
                uint256 feeTotal = feesPaid[msg.sender];
                if (feeTotal > 0) {
                    if (tokenType == TokenType.Native) {
                        IFactoryLite(factory).refundUserFee(address(0), payable(msg.sender), feeTotal);
                    } else {
                        IFactoryLite(factory).refundUserFee(token, payable(msg.sender), feeTotal);
                    }
                    feesPaid[msg.sender] = 0;
                }
            }
        } else {
            uint256 stake = stakes[msg.sender][winningSelection];
            require(stake > 0, "no winning stake");
            payout = (stake * payoutMultiplier) / 1e18;
        }
        claimed[msg.sender] = true;

        if (tokenType == TokenType.Native) {
            (bool ok, ) = msg.sender.call{value: payout}("");
            require(ok, "payout failed");
        } else {
            IERC20 erc = IERC20(token);
            require(erc.transfer(msg.sender, payout), "payout transfer failed");
        }
        emit Claimed(msg.sender, payout);
    }

    // Admin updates from factory
    function updateConfig(uint16 _feeBps, address _feeRecipient) external onlyFactory {
        require(_feeRecipient != address(0), "fee recipient required");
        feeBps = _feeBps;
        // keep feeRecipient bound to factory per policy
        feeRecipient = factory;
        emit ConfigUpdated(feeBps, feeRecipient);
    }

    function setOracle(address _oracle) external onlyFactory {
        require(_oracle != address(0), "oracle required");
        oracle = _oracle;
    }

    // Oracle can adjust spread prior to settlement
    function setSpreadTenthsOracle(int16 newSpreadTenths) external {
        require(msg.sender == oracle, "not oracle");
        require(!settled, "already settled");
        spreadTenths = newSpreadTenths;
        emit SpreadUpdated(newSpreadTenths);
    }

    // Oracle can set start and cutoff times prior to settlement
    function setTimesOracle(uint64 _startTime, uint64 _cutoffTime) external {
        require(msg.sender == oracle || factory == msg.sender, "not oracle");
        require(!settled, "already settled");
        require(_startTime == 0 || _startTime <= (block.timestamp + 7 days), "start > 7d from now");
        require(_cutoffTime == 0 || (_startTime == 0 ? true : _cutoffTime >= _startTime), "cutoff < start");
        startTime = _startTime;
        cutoffTime = _cutoffTime;
        emit TimesUpdated(startTime, cutoffTime);
    }

    // Admin controls
    function closeMarket() external onlyAdmin {
        require(isOpen, "already closed");
        isOpen = false;
        emit MarketClosed();
    }

    // Cancel market: refunds stakes on claim; fees are not refunded under current design
    function cancelMarket() external onlyAdmin {
        require(!settled, "already settled");
        isOpen = false;
        settled = true;
        cancelled = true;
        inDispute = false;
        settlementTime = uint64(block.timestamp);
        emit MarketCancelled();
    }

    // Oracle-dispute controls
    event DisputeOpened();
    event DisputeClosed();

    function setDisputeOracle(bool flag) external {
        require(msg.sender == oracle, "not oracle");
        if (flag) {
            inDispute = true;
            settled = false;
            emit DisputeOpened();
        } else {
            inDispute = false;
            emit DisputeClosed();
        }
    }

    function updateLimits(uint256 _minBet, uint256 _maxBet) external onlyFactory {
        minBet = _minBet;
        maxBet = _maxBet;
        emit LimitsUpdated(minBet, maxBet);
    }

    // Frontend stats helpers
    function getSelectionStats(uint16 selectionId) external view returns (uint256 totalStake, uint256 betCount) {
        return (selectionPools[selectionId], selectionBetCounts[selectionId]);
    }
    function getHomeStats() external view returns (uint256 totalStake, uint256 betCount) {
        return (selectionPools[homeSelectionId], selectionBetCounts[homeSelectionId]);
    }
    function getAwayStats() external view returns (uint256 totalStake, uint256 betCount) {
        return (selectionPools[awaySelectionId], selectionBetCounts[awaySelectionId]);
    }

    // Frontend odds and payout previews
    function getImpliedOdds(uint16 selectionId) external view returns (uint256 odds1e18) {
        uint256 totalPool = selectionPools[homeSelectionId] + selectionPools[awaySelectionId];
        uint256 selPool = selectionPools[selectionId];
        if (totalPool == 0 || selPool == 0) return 0;
        return (totalPool * 1e18) / selPool;
    }

    function getPayoutPreview(uint16 selectionId, uint256 netStake) external view returns (uint256 payout1e18) {
        require(selectionId == homeSelectionId || selectionId == awaySelectionId, "invalid selection");
        uint256 currentTotalPool = selectionPools[homeSelectionId] + selectionPools[awaySelectionId];
        uint256 bonusEstimate;
        if (tokenType == TokenType.Native) {
            uint256 bal = address(this).balance;
            bonusEstimate = bal > currentTotalPool ? (bal - currentTotalPool) : 0;
        } else {
            IERC20 erc = IERC20(token);
            uint256 bal = erc.balanceOf(address(this));
            bonusEstimate = bal > currentTotalPool ? (bal - currentTotalPool) : 0;
        }
        uint256 totalPool = currentTotalPool + netStake;
        uint256 winnerPool = selectionPools[selectionId] + netStake;
        uint256 loserPool = totalPool - winnerPool;
        if (winnerPool == 0) return 0;
        uint256 mult = (((loserPool + bonusEstimate) * 1e18) / winnerPool) + 1e18;
        return (netStake * mult) / 1e18;
    }

    receive() external payable {}

    ///Aggregated market view for frontend and API consumers
    struct MarketView {
        address factory;
        uint64 eventId;
        bool isOpen;
        bool cancelled;
        uint16 feeBps;
        address feeRecipient;
        TokenType tokenType;
        address token;
        uint16 winningSelection;
        bool settled;
        bool isPush;
        bool inDispute;
        uint256 payoutMultiplier;
        uint256 bonusPool;
        uint64 settlementTime;
        uint16 homeSelectionId;
        uint16 awaySelectionId;
        int16 spreadTenths;
        bool spreadAppliesToHome;
        uint64 startTime;
        uint64 cutoffTime;
        uint256 minBet;
        uint256 maxBet;
        address oracle;
        uint16 homeScoreFinal;
        uint16 awayScoreFinal;
        bool scoresSet;
        uint256 homePool;
        uint256 awayPool;
        uint256 totalPool;
        uint256 homeBetCount;
        uint256 awayBetCount;
    }

    function getMarketDetails() external view returns (MarketView memory v) {
        v.factory = factory;
        v.eventId = eventId;
        v.isOpen = isOpen;
        v.cancelled = cancelled;
        v.feeBps = feeBps;
        v.feeRecipient = feeRecipient;
        v.tokenType = tokenType;
        v.token = token;
        v.winningSelection = winningSelection;
        v.settled = settled;
        v.isPush = isPush;
        v.inDispute = inDispute;
        v.payoutMultiplier = payoutMultiplier;
        v.bonusPool = bonusPool;
        v.settlementTime = settlementTime;
        v.homeSelectionId = homeSelectionId;
        v.awaySelectionId = awaySelectionId;
        v.spreadTenths = spreadTenths;
        v.spreadAppliesToHome = spreadAppliesToHome;
        v.startTime = startTime;
        v.cutoffTime = cutoffTime;
        v.minBet = minBet;
        v.maxBet = maxBet;
        v.oracle = oracle;
        v.homeScoreFinal = homeScoreFinal;
        v.awayScoreFinal = awayScoreFinal;
        v.scoresSet = scoresSet;
        v.homePool = selectionPools[homeSelectionId];
        v.awayPool = selectionPools[awaySelectionId];
        v.totalPool = v.homePool + v.awayPool;
        v.homeBetCount = selectionBetCounts[homeSelectionId];
        v.awayBetCount = selectionBetCounts[awaySelectionId];
    }

    struct UserPosition {
        address user;
        uint256 stakeHome;
        uint256 stakeAway;
        uint256 feesPaid;
        bool claimed;
        uint256 potentialPayoutHome;
        uint256 potentialPayoutAway;
        uint256 payoutIfSettled;
    }

    function getUserPosition(address user) external view returns (UserPosition memory p) {
        p.user = user;
        p.stakeHome = stakes[user][homeSelectionId];
        p.stakeAway = stakes[user][awaySelectionId];
        p.feesPaid = feesPaid[user];
        p.claimed = claimed[user];

        uint256 currentTotalPool = selectionPools[homeSelectionId] + selectionPools[awaySelectionId];
        uint256 bonusEstimate;
        if (tokenType == TokenType.Native) {
            uint256 bal = address(this).balance;
            bonusEstimate = bal > currentTotalPool ? (bal - currentTotalPool) : 0;
        } else {
            IERC20 erc = IERC20(token);
            uint256 bal = erc.balanceOf(address(this));
            bonusEstimate = bal > currentTotalPool ? (bal - currentTotalPool) : 0;
        }

        if (p.stakeHome > 0) {
            uint256 winnerPoolHome = selectionPools[homeSelectionId];
            if (winnerPoolHome > 0) {
                uint256 loserPoolHome = currentTotalPool - winnerPoolHome;
                uint256 multHome = (((loserPoolHome + bonusEstimate) * 1e18) / winnerPoolHome) + 1e18;
                p.potentialPayoutHome = (p.stakeHome * multHome) / 1e18;
            }
        }

        if (p.stakeAway > 0) {
            uint256 winnerPoolAway = selectionPools[awaySelectionId];
            if (winnerPoolAway > 0) {
                uint256 loserPoolAway = currentTotalPool - winnerPoolAway;
                uint256 multAway = (((loserPoolAway + bonusEstimate) * 1e18) / winnerPoolAway) + 1e18;
                p.potentialPayoutAway = (p.stakeAway * multAway) / 1e18;
            }
        }

        if (settled) {
            if (isPush || cancelled) {
                p.payoutIfSettled = p.stakeHome + p.stakeAway;
            } else {
                uint256 stakeWin = stakes[user][winningSelection];
                if (stakeWin > 0) {
                    p.payoutIfSettled = (stakeWin * payoutMultiplier) / 1e18;
                }
            }
        }
    }

    function getUserPositionArrays(address user) external view returns (uint256[] memory nums, address[] memory addrs) {
        nums = new uint256[](7);
        nums[0] = stakes[user][homeSelectionId];
        nums[1] = stakes[user][awaySelectionId];
        nums[2] = feesPaid[user];
        uint256 currentTotalPool = selectionPools[homeSelectionId] + selectionPools[awaySelectionId];
        uint256 bonusEstimate;
        if (tokenType == TokenType.Native) {
            uint256 bal = address(this).balance;
            bonusEstimate = bal > currentTotalPool ? (bal - currentTotalPool) : 0;
        } else {
            IERC20 erc = IERC20(token);
            uint256 bal = erc.balanceOf(address(this));
            bonusEstimate = bal > currentTotalPool ? (bal - currentTotalPool) : 0;
        }
        if (nums[0] > 0) {
            uint256 winnerPoolHome = selectionPools[homeSelectionId];
            if (winnerPoolHome > 0) {
                uint256 loserPoolHome = currentTotalPool - winnerPoolHome;
                uint256 multHome = (((loserPoolHome + bonusEstimate) * 1e18) / winnerPoolHome) + 1e18;
                nums[3] = (nums[0] * multHome) / 1e18;
            }
        }
        if (nums[1] > 0) {
            uint256 winnerPoolAway = selectionPools[awaySelectionId];
            if (winnerPoolAway > 0) {
                uint256 loserPoolAway = currentTotalPool - winnerPoolAway;
                uint256 multAway = (((loserPoolAway + bonusEstimate) * 1e18) / winnerPoolAway) + 1e18;
                nums[4] = (nums[1] * multAway) / 1e18;
            }
        }
        if (settled) {
            if (isPush || cancelled) {
                nums[5] = nums[0] + nums[1];
            } else {
                uint256 stakeWin = stakes[user][winningSelection];
                if (stakeWin > 0) {
                    nums[5] = (stakeWin * payoutMultiplier) / 1e18;
                }
            }
        }
        nums[6] = settlementTime;
        addrs = new address[](1);
        addrs[0] = user;
    }
}