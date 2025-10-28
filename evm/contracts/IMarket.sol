// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMarket {
    function setTimesOracle(uint64 startTime, uint64 cutoffTime) external;
    function updateConfig(uint16 feeBps, address feeRecipient) external;

    function settled() external view returns (bool);
    function cancelled() external view returns (bool);
    function isPush() external view returns (bool);
    function homeSelectionId() external view returns (uint16);
    function awaySelectionId() external view returns (uint16);
    function winningSelection() external view returns (uint16);

    function stakes(address user, uint16 selectionId) external view returns (uint256);

    function placeBetNative(address bettor, uint16 selectionId) external payable;
    function creditBetERC20FromFactory(address bettor, uint16 selectionId, uint256 amount) external;
}