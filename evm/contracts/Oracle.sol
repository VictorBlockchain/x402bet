// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IFactoryLite } from "./Interfaces.sol";
import { IMarket } from "./IMarket.sol";

contract Oracle {
    address public owner;
    address public factory;
    
    // Market scoring data (address-first design)
    struct MarketScore {
        uint16 homeScore;
        uint16 awayScore;
        bool isSet;
        uint64 timestamp;
    }
    
    // Per-market score storage (optional when not settling immediately)
    mapping(address => MarketScore) public marketScores;
    mapping(address => bool) public authorizedReporters;
    
    // Track known markets only (single market per game design)
    mapping(address => bool) public knownMarkets;
    
    event ScoreReportedForMarket(address indexed market, uint16 homeScore, uint16 awayScore, address reporter);
    event MarketSettled(address indexed market, uint16 homeScore, uint16 awayScore);
    event MarketSpreadUpdated(address indexed market, int16 newSpreadTenths);
    event MarketDisputeOpened(address indexed market);
    event MarketDisputeClosed(address indexed market);
    event ReporterAuthorized(address indexed reporter, bool authorized);
    event MarketRegistered(address indexed market);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }
    
    modifier onlyAuthorized() {
        require(msg.sender == owner || authorizedReporters[msg.sender], "not authorized");
        _;
    }
    
    constructor(address _factory) {
        require(_factory != address(0), "factory required");
        owner = msg.sender;
        factory = _factory;
        authorizedReporters[msg.sender] = true;
    }
    
    // Register a market (called by factory or owner)
    function registerMarket(address market) external {
        require(msg.sender == factory || msg.sender == owner, "not authorized");
        require(market != address(0), "invalid market");
        
        if (!knownMarkets[market]) {
            knownMarkets[market] = true;
            emit MarketRegistered(market);
        }
    }

    // Update market spread tenths prior to settlement
    function setMarketSpreadTenths(address market, int16 newSpreadTenths) external onlyAuthorized {
        require(market != address(0), "invalid market");
        require(knownMarkets[market], "unknown market");
        IMarket(market).setSpreadTenthsOracle(newSpreadTenths);
        emit MarketSpreadUpdated(market, newSpreadTenths);
    }

    // Address-first score report and immediate settlement for a single market
    function reportScoreForMarket(address market, uint16 homeScore, uint16 awayScore) external onlyAuthorized {
        require(market != address(0), "invalid market");
        require(knownMarkets[market], "unknown market");
        // Persist reported scores for reference
        marketScores[market] = MarketScore({
            homeScore: homeScore,
            awayScore: awayScore,
            isSet: true,
            timestamp: uint64(block.timestamp)
        });
        emit ScoreReportedForMarket(market, homeScore, awayScore, msg.sender);
        // Apply scores directly to the market; revert bubbles up on failure
        IMarket(market).setScoresOracle(homeScore, awayScore);
        emit MarketSettled(market, homeScore, awayScore);
    }

    // Open dispute: unset settlement until resolved
    function openDispute(address market) external onlyAuthorized {
        require(knownMarkets[market], "unknown market");
        IMarket(market).setDisputeOracle(true);
        emit MarketDisputeOpened(market);
    }

    // Close dispute without resettling (e.g., invalid dispute)
    function closeDispute(address market) external onlyAuthorized {
        require(knownMarkets[market], "unknown market");
        IMarket(market).setDisputeOracle(false);
        emit MarketDisputeClosed(market);
    }

    // Resolve dispute by submitting corrected scores
    function resolveDispute(address market, uint16 homeScore, uint16 awayScore) external onlyAuthorized {
        require(knownMarkets[market], "unknown market");
        marketScores[market] = MarketScore({
            homeScore: homeScore,
            awayScore: awayScore,
            isSet: true,
            timestamp: uint64(block.timestamp)
        });
        IMarket(market).setScoresOracle(homeScore, awayScore);
        emit MarketSettled(market, homeScore, awayScore);
    }
    
    // Manually settle a specific market by address only
    function settleMarketByAddress(address market) external onlyAuthorized {
        require(knownMarkets[market], "unknown market");
        require(marketScores[market].isSet, "score not set");
        MarketScore memory score = marketScores[market];
        IMarket(market).setScoresOracle(score.homeScore, score.awayScore);
        emit MarketSettled(market, score.homeScore, score.awayScore);
    }
    
    // Authorize/deauthorize score reporters
    function setReporterAuthorization(address reporter, bool authorized) external onlyOwner {
        authorizedReporters[reporter] = authorized;
        emit ReporterAuthorized(reporter, authorized);
    }
    
    // Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "invalid owner");
        owner = newOwner;
    }
    
    // Get market score (reported via oracle)
    function getMarketScore(address market) external view returns (uint16 homeScore, uint16 awayScore, bool isSet, uint64 timestamp) {
        MarketScore memory score = marketScores[market];
        return (score.homeScore, score.awayScore, score.isSet, score.timestamp);
    }
        
    // Check if a market is settled
    function isMarketSettled(address market) external view returns (bool) {
        if (!knownMarkets[market]) return false;
        try IMarket(market).settled() returns (bool settled) {
            return settled;
        } catch {
            return false;
        }
    }
    
    // Get market final scores
    function getMarketScores(address market) external view returns (uint16 homeScore, uint16 awayScore, bool settled) {
        if (!knownMarkets[market]) return (0, 0, false);
        try IMarket(market).settled() returns (bool isSettled) {
            if (!isSettled) return (0, 0, false);
            try IMarket(market).homeScoreFinal() returns (uint16 home) {
                try IMarket(market).awayScoreFinal() returns (uint16 away) {
                    return (home, away, true);
                } catch {
                    return (0, 0, false);
                }
            } catch {
                return (0, 0, false);
            }
        } catch {
            return (0, 0, false);
        }
    }
}