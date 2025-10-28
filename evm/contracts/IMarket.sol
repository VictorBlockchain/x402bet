// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Canonical market interface used by Factory and Oracle
interface IMarket {
    // Core getters
    function eventId() external view returns (uint64);
    function settled() external view returns (bool);
    function cancelled() external view returns (bool);
    function isPush() external view returns (bool);

    // Selection IDs and result
    function homeSelectionId() external view returns (uint16);
    function awaySelectionId() external view returns (uint16);
    function winningSelection() external view returns (uint16);

    // Score getters
    function homeScoreFinal() external view returns (uint16);
    function awayScoreFinal() external view returns (uint16);

    // Stakes mapping getter: bettor => selectionId => amount
    function stakes(address user, uint16 selectionId) external view returns (uint256);

    // Oracle/factory-controlled setters
    function setTimesOracle(uint64 _startTime, uint64 _cutoffTime) external;
    function setScoresOracle(uint16 homeScore, uint16 awayScore) external;
    function setSpreadTenthsOracle(int16 newSpreadTenths) external;
    function setDisputeOracle(bool flag) external;

    // Betting and admin operations used by Factory
    function placeBetNative(address bettor, uint16 selectionId) external payable;
    function creditBetERC20FromFactory(address bettor, uint16 selectionId, uint256 received) external;
    function updateConfig(uint16 _feeBps, address _feeRecipient) external;
}