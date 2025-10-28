// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "./Interfaces.sol";
import { IMarket } from "./IMarket.sol";
import { IMarketDeployer } from "./IMarketDeployer.sol";

interface IOracle {
    function registerMarket(address market) external;
}

contract X402BetFactory {
    // limits
    uint256 public constant MAX_PROPOSITION_LEN = 64;
    // admin management
    mapping(address => bool) public admins;
    address public owner;

    // global config
    uint16 public serviceFeeBps; // applies to newly created markets
    address public serviceFeeRecipient;
    address public x402BetToken; // ERC20 token address
    address public defaultOracle; // oracle used at market creation

    // registry
    address[] public markets;
    mapping(uint64 => address) public marketByEventId; // compact eventId => market address
    // game slug registry: key is keccak256(lower(sport) + ":" + lower(region) + ":" + lower(proposition) + ":" + lower(home) + ":" + lower(away))
    mapping(bytes32 => address) public marketBySlug;

    // market allowlist (only markets can push bet updates)
    mapping(address => bool) public isMarket;

    // user/creator registries
    mapping(address => address[]) public marketsByCreator; // creator => markets created
    mapping(address => mapping(address => uint256)) public userTotalStakeByMarket; // user => market => net stake
    mapping(address => mapping(address => uint256)) public userBetCountByMarket; // user => market => bet count

    // referral reverse index (for retrieval of all referred users by a referrer)
    mapping(address => address[]) private referralsByReferrer; // referrer => list of referred users

    // referral config and tracking
    uint256 public referralBonusWei; // bonus paid in native token (wei)
    uint256 public minBetsForReferral; // minimum number of bets placed by referred user
    mapping(address => address) public referrerOf; // referred user => referrer
    mapping(address => uint256) public referredBetCount; // count of bets placed by referred user
    mapping(address => uint256) public referredBetAmount; // cumulative bet amount by referred user (for analytics)
    mapping(address => bool) public referralPaid; // referred user => referral paid flag

    event GameRegistered(bytes32 indexed key, string sport, string region, string proposition, string homeVsAway, address market);

    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event ConfigUpdated(uint16 feeBps, address feeRecipient, address token);
    event MarketCreated(address indexed market, uint64 eventId, uint8 tokenType, address token);
    event DefaultOracleUpdated(address indexed oracle);
    event MarketDeployerUpdated(address indexed deployer);
    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);

    event ReferralConfigUpdated(uint256 bonusWei, uint256 minBetsRequired);
    event ReferrerSet(address indexed referred, address indexed referrer);
    event BetAmountUpdated(address indexed user, uint256 amount, uint256 newCount, uint256 newTotalAmount);
    event ReferralClaimed(address indexed referrer, address indexed referred, uint256 amount);
    event FeesWithdrawn(address indexed token, address indexed to, uint256 amount);
    event FeeRefunded(address indexed token, address indexed to, uint256 amount);

    event UserWagerUpdated(
        address indexed user,
        address indexed market,
        uint256 amount,
        uint256 newCount,
        uint256 newTotalStakeInMarket,
        uint256 newGlobalTotalStake
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner, "not admin");
        _;
    }

    modifier onlyMarket() {
        require(isMarket[msg.sender], "not market");
        _;
    }

    constructor(uint16 _feeBps, address _feeRecipient, address _token) {
        owner = msg.sender;
        admins[msg.sender] = true;
        require(_feeRecipient != address(0), "fee recipient required");
        serviceFeeBps = _feeBps;
        serviceFeeRecipient = _feeRecipient;
        x402BetToken = _token; // optional, can be address(0)
        emit ConfigUpdated(serviceFeeBps, serviceFeeRecipient, x402BetToken);
    }

    // public admin check (used by markets)
    function isAdmin(address a) external view returns (bool) {
        return admins[a] || a == owner;
    }

    // External market deployer to keep factory bytecode small
    address public marketDeployer;
    function setMarketDeployer(address d) external onlyAdmin {
        require(d != address(0), "invalid deployer");
        marketDeployer = d;
        emit MarketDeployerUpdated(d);
    }

    // admin management
    function addAdmin(address a) external onlyOwner {
        admins[a] = true;
        emit AdminAdded(a);
    }
    function removeAdmin(address a) external onlyOwner {
        admins[a] = false;
        emit AdminRemoved(a);
    }

    // owner management
    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "invalid owner");
        address prev = owner;
        owner = newOwner;
        admins[newOwner] = true; // ensure new owner has admin privileges
        admins[prev] = false; // remove admin privileges from previous owner
        emit OwnerUpdated(prev, newOwner);
    }

    // global config
    function setServiceFee(uint16 _feeBps) external onlyAdmin {
        serviceFeeBps = _feeBps;
        emit ConfigUpdated(serviceFeeBps, serviceFeeRecipient, x402BetToken);
    }
    function setServiceFeeRecipient(address _feeRecipient) external onlyAdmin {
        require(_feeRecipient != address(0), "fee recipient required");
        serviceFeeRecipient = _feeRecipient;
        emit ConfigUpdated(serviceFeeBps, serviceFeeRecipient, x402BetToken);
    }
    function setX402BetToken(address _token) external onlyAdmin {
        x402BetToken = _token;
        emit ConfigUpdated(serviceFeeBps, serviceFeeRecipient, x402BetToken);
    }

    function setDefaultOracle(address _oracle) external onlyAdmin {
        require(_oracle != address(0), "oracle required");
        defaultOracle = _oracle;
        emit DefaultOracleUpdated(defaultOracle);
    }



    // receive native token fees
    receive() external payable {}

    // withdraw fees (native if token == address(0), else ERC20)
    function withdraw(address token, address payable to, uint256 amount) external onlyAdmin {
        require(to != address(0), "invalid to");
        require(amount > 0, "amount=0");
        if (token == address(0)) {
            require(address(this).balance >= amount, "insufficient native");
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "native transfer failed");
        } else {
            require(IERC20(token).transfer(to, amount), "erc20 transfer failed");
        }
        emit FeesWithdrawn(token, to, amount);
    }

    // refund fee to user (called by markets when a market is cancelled)
    function refundUserFee(address token, address payable to, uint256 amount) external onlyMarket {
        require(to != address(0), "invalid to");
        require(amount > 0, "amount=0");
        if (token == address(0)) {
            require(address(this).balance >= amount, "insufficient native");
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "native refund failed");
        } else {
            require(IERC20(token).transfer(to, amount), "erc20 refund failed");
        }
        emit FeeRefunded(token, to, amount);
    }

    // set referral config
    function setReferralConfig(uint256 bonusWei, uint256 minBets) external onlyAdmin {
        referralBonusWei = bonusWei;
        minBetsForReferral = minBets;
        emit ReferralConfigUpdated(bonusWei, minBets);
    }

    // set a user's referrer (can be called by the referred user, an admin, or a market)
    function setReferrer(address referred, address referrer) external {
        require(referred != address(0) && referrer != address(0), "invalid address");
        require(referred != referrer, "self-referral disallowed");
        require(referrerOf[referred] == address(0), "referrer already set");
        bool authorized = (msg.sender == referred) || admins[msg.sender] || (msg.sender == owner) || isMarket[msg.sender];
        require(authorized, "not authorized");
        referrerOf[referred] = referrer;
        referralsByReferrer[referrer].push(referred);
        emit ReferrerSet(referred, referrer);
    }

    // markets push bet activity to track referral progress
    function updateUserBetAmount(address user, uint256 amount) external onlyMarket {
        require(user != address(0), "invalid user");
        require(amount > 0, "amount=0");
        referredBetCount[user] += 1;
        referredBetAmount[user] += amount;
        emit BetAmountUpdated(user, amount, referredBetCount[user], referredBetAmount[user]);

        // also track per-market aggregates (msg.sender is the market address)
        address marketAddr = msg.sender;
        userBetCountByMarket[user][marketAddr] += 1;
        userTotalStakeByMarket[user][marketAddr] += amount;
        emit UserWagerUpdated(
            user,
            marketAddr,
            amount,
            userBetCountByMarket[user][marketAddr],
            userTotalStakeByMarket[user][marketAddr],
            referredBetAmount[user]
        );
    }

    // referrer can claim bonus after referred user meets minBets
    function claimReferral(address referred) external {
        address referrer = referrerOf[referred];
        require(referrer != address(0), "no referrer");
        require(msg.sender == referrer, "not referrer");
        require(!referralPaid[referred], "already paid");
        require(minBetsForReferral > 0, "minBets not set");
        require(referredBetCount[referred] >= minBetsForReferral, "threshold not met");
        uint256 amount = referralBonusWei;
        require(amount > 0, "bonus not set");
        require(address(this).balance >= amount, "insufficient balance");
        referralPaid[referred] = true; // effects before interaction
        (bool ok, ) = payable(referrer).call{value: amount}("");
        require(ok, "bonus transfer failed");
        emit ReferralClaimed(referrer, referred, amount);
    }

    // create a market per event
    // create a market per event
    function createMarket(
        uint64 eventId,
        uint16 homeSelectionId,
        uint16 awaySelectionId,
        int16 spreadTenths,
        bool spreadAppliesToHome,
        string memory sport,
        string memory region,
        string memory proposition,
        string memory homeVsAway,
        uint64 startTime,
        uint64 cutoffTime,
        uint16 initialSelectionId,
        uint256 amount
    ) external payable returns (address) {
        require(marketByEventId[eventId] == address(0), "market exists");
        require(defaultOracle != address(0), "oracle not set");

        // Enforce start within 7 days and cutoff not before start (0 means unset/no restriction)
        require(startTime == 0 || startTime <= (block.timestamp + 7 days), "start > 7d from now");
        require(cutoffTime == 0 || (startTime == 0 ? true : cutoffTime >= startTime), "cutoff < start");

        uint8 tokenType = msg.value > 0 ? 0 : 1; // 0=Native, 1=ERC20
        address tokenAddr = tokenType == 1 ? x402BetToken : address(0);
        if (tokenType == 1) {
            require(tokenAddr != address(0), "x402Bet token not set");
        }
        // Normalize and validate sport and teams
        string memory sportLower = _toLower(sport);
        string memory regionLower = _toLower(region);
        string memory propLower = _toLower(proposition);
        string memory hvaLower = _toLower(homeVsAway);
        require(bytes(propLower).length > 0, "proposition required");
        require(bytes(propLower).length <= MAX_PROPOSITION_LEN, "proposition too long");
        (string memory homeTeam, string memory awayTeam) = _splitColon(hvaLower);
        require(bytes(homeTeam).length > 0 && bytes(awayTeam).length > 0, "invalid team format");
        // Skip registry validation for sport/region/team to keep market creation flexible
        require(marketDeployer != address(0), "deployer not set");
        address payable marketAddr = payable(IMarketDeployer(marketDeployer).deployMarket(
            eventId,
            msg.sender,
            tokenType,
            tokenAddr,
            serviceFeeBps,
            serviceFeeRecipient,
            homeSelectionId,
            awaySelectionId,
            spreadTenths,
            spreadAppliesToHome,
            defaultOracle
        ));
        markets.push(marketAddr);
        marketByEventId[eventId] = marketAddr;
        isMarket[marketAddr] = true;
        
        // track creator -> markets registry
        marketsByCreator[msg.sender].push(marketAddr);
        bytes32 key = _computeGameKey(sportLower, regionLower, propLower, hvaLower);
        require(marketBySlug[key] == address(0), "slug exists");
        marketBySlug[key] = marketAddr;
        emit MarketCreated(marketAddr, eventId, tokenType, tokenAddr);
        emit GameRegistered(key, sportLower, regionLower, propLower, hvaLower, marketAddr);

        // Initialize times on the market (onlyFactory) via oracle-compatible setter
        IMarket(marketAddr).setTimesOracle(startTime, cutoffTime);
        
        // Register market with oracle for automatic settlement (address-only)
        if (defaultOracle != address(0)) {
            try IOracle(defaultOracle).registerMarket(marketAddr) {
                // Oracle registration successful
            } catch {
                // Oracle registration failed, but market creation continues
            }
        }
        
        // Place initial bet to seed liquidity regardless of start time
        // This ensures markets for future events can have initial liquidity
        if (tokenType == 0 && msg.value > 0) {
            IMarket(marketAddr).placeBetNative{ value: msg.value }(msg.sender, initialSelectionId);
        } else if (tokenType == 1 && amount > 0) {
            IERC20 erc = IERC20(tokenAddr);
            uint256 beforeBal = erc.balanceOf(marketAddr);
            require(erc.transferFrom(msg.sender, marketAddr, amount), "approve factory as spender first");
            uint256 afterBal = erc.balanceOf(marketAddr);
            uint256 received = afterBal - beforeBal;
            require(received > 0, "no tokens received");
            IMarket(marketAddr).creditBetERC20FromFactory(msg.sender, initialSelectionId, received);
        }
        return marketAddr;
    }

    // propagate config updates to an existing market
    function updateMarketConfig(address payable market) external onlyAdmin {
        IMarket(market).updateConfig(serviceFeeBps, serviceFeeRecipient);
    }

    function getMarkets() external view returns (address[] memory) {
        return markets;
    }

    // Count total markets (use with range pagination to avoid large returns)
    function getMarketsCount() external view returns (uint256) {
        return markets.length;
    }

    // Paginated retrieval of markets
    function getMarketsRange(uint256 start, uint256 count) external view returns (address[] memory out) {
        uint256 n = markets.length;
        if (start >= n || count == 0) {
            return new address[](0);
        }
        uint256 endExclusive = start + count;
        if (endExclusive > n) endExclusive = n;
        uint256 size = endExclusive - start;
        out = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            out[i] = markets[start + i];
        }
        return out;
    }

    // Paginated retrieval of markets created by a specific creator
    function getMarketsByCreatorRange(address creator, uint256 start, uint256 count) external view returns (address[] memory out) {
        address[] storage arr = marketsByCreator[creator];
        uint256 n = arr.length;
        if (start >= n || count == 0) {
            return new address[](0);
        }
        uint256 endExclusive = start + count;
        if (endExclusive > n) endExclusive = n;
        uint256 size = endExclusive - start;
        out = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            out[i] = arr[start + i];
        }
        return out;
    }

    // Retrieve markets created by a specific creator
    function getMarketsByCreator(address creator) external view returns (address[] memory) {
        return marketsByCreator[creator];
    }

    // Retrieve all referred users for a given referrer
    function getReferralsByReferrer(address referrer) external view returns (address[] memory) {
        return referralsByReferrer[referrer];
    }

    // Retrieve per-user wager aggregates for a specific market
    function getUserMarketWager(address user, address market) external view returns (uint256 totalStake, uint256 betCount) {
        return (userTotalStakeByMarket[user][market], userBetCountByMarket[user][market]);
    }

    // Retrieve all markets a user has wagered in, with totals and counts
    function getAllUserMarketWagers(address user)
        external
        view
        returns (address[] memory marketsOut, uint256[] memory stakesOut, uint256[] memory countsOut)
    {
        uint256 n = markets.length;
        uint256 cnt = 0;
        for (uint256 i = 0; i < n; i++) {
            address m = markets[i];
            if (userTotalStakeByMarket[user][m] > 0 || userBetCountByMarket[user][m] > 0) {
                cnt++;
            }
        }
        marketsOut = new address[](cnt);
        stakesOut = new uint256[](cnt);
        countsOut = new uint256[](cnt);
        uint256 j = 0;
        for (uint256 i = 0; i < n; i++) {
            address m = markets[i];
            uint256 stake = userTotalStakeByMarket[user][m];
            uint256 count = userBetCountByMarket[user][m];
            if (stake > 0 || count > 0) {
                marketsOut[j] = m;
                stakesOut[j] = stake;
                countsOut[j] = count;
                j++;
            }
        }
        return (marketsOut, stakesOut, countsOut);
    }

    // Compute a user's outcome on a market without storing (0=Unsettled, 1=Won, 2=Lost, 3=Refunded)
    function getUserOutcomeOnMarket(address user, address market) external view returns (uint8 outcomeCode) {
        require(user != address(0) && market != address(0), "invalid params");
        IMarket m = IMarket(market);
        if (!m.settled()) {
            return 0; // Unsettled
        }
        // Push or cancelled means refunds
        if (m.cancelled() || m.isPush()) {
            uint256 stakeHome = m.stakes(user, m.homeSelectionId());
            uint256 stakeAway = m.stakes(user, m.awaySelectionId());
            if (stakeHome + stakeAway == 0) return 0; // no participation
            return 3; // Refunded
        }
        uint16 winner = m.winningSelection();
        uint256 winningStake = m.stakes(user, winner);
        if (winningStake > 0) {
            return 1; // Won
        }
        // If user had any stake but none on winning side, it's a loss
        uint256 stakeHome2 = m.stakes(user, m.homeSelectionId());
        uint256 stakeAway2 = m.stakes(user, m.awaySelectionId());
        if (stakeHome2 + stakeAway2 == 0) return 0; // no participation
        return 2; // Lost
    }

    // manual registration in case a market was created without slug
    function registerGame(string memory sport, string memory region, string memory proposition, string memory homeVsAway, address market) external onlyAdmin {
        require(market != address(0), "invalid market");
        string memory propLower = _toLower(proposition);
        require(bytes(propLower).length > 0, "proposition required");
        require(bytes(propLower).length <= MAX_PROPOSITION_LEN, "proposition too long");
        bytes32 key = _computeGameKey(sport, region, propLower, homeVsAway);
        require(marketBySlug[key] == address(0), "slug exists");
        marketBySlug[key] = market;
        emit GameRegistered(key, _toLower(sport), _toLower(region), propLower, _toLower(homeVsAway), market);
    }

    /// @notice Lookup market address by slug components.
    /// @dev Slug format when calling:
    ///      - `sport`: lowercase short code (e.g., "nba", "nfl", "mlb").
    ///      - `region`: lowercase geographic/league region (e.g., "us", "eu").
    ///      - `proposition`: lowercase market predicate (e.g., "moneyline", "winner", "yes_no", "o/u_50.5").
    ///      - `homeVsAway`: lowercase teams separated by a colon, i.e., "home:away" (e.g., "bucks:lakers").
    ///      Internally, the slug key is keccak256 of `sport:region:proposition:home:away` in lowercase (e.g., "nba:us:moneyline:bucks:lakers").
    ///      Inputs are lowercased; other characters are NOT removed, so keep a consistent format.
    ///      Example: getMarketBySlug("nba", "us", "moneyline", "bucks:lakers").
    function getMarketBySlug(string memory sport, string memory region, string memory proposition, string memory homeVsAway) external view returns (address) {
        bytes32 key = _computeGameKey(sport, region, proposition, homeVsAway);
        return marketBySlug[key];
    }

    // helpers
    function _computeGameKey(string memory sport, string memory region, string memory proposition, string memory homeVsAway) internal pure returns (bytes32) {
        string memory hvaLower = _toLower(homeVsAway);
        (string memory homeTeam, string memory awayTeam) = _splitColon(hvaLower);
        return keccak256(
            abi.encodePacked(
                _toLower(sport), ":", _toLower(region), ":", _toLower(proposition), ":", homeTeam, ":", awayTeam
            )
        );
    }

    function _toLower(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 65 && c <= 90) {
                b[i] = bytes1(c + 32);
            }
        }
        return string(b);
    }

    // Split a "home:away" string into two team tokens at the first occurrence of ":"
    function _splitColon(string memory s) internal pure returns (string memory left, string memory right) {
        bytes memory b = bytes(s);
        uint256 n = b.length;
        require(n >= 3, "too short");
        int256 idx = -1;
        for (uint256 i = 0; i < n; i++) {
            if (b[i] == bytes1(":")) {
                idx = int256(i);
                break;
            }
        }
        require(idx >= 1 && uint256(idx) + 1 <= n - 1, ": not found");
        uint256 iColon = uint256(idx);
        // left = [0, iColon)
        bytes memory l = new bytes(iColon);
        for (uint256 i = 0; i < iColon; i++) {
            l[i] = b[i];
        }
        // right = (iColon+1, n]
        uint256 rLen = n - (iColon + 1);
        bytes memory r = new bytes(rLen);
        for (uint256 j = 0; j < rLen; j++) {
            r[j] = b[iColon + 1 + j];
        }
        return (string(l), string(r));
    }
}