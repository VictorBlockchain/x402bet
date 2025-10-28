// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMarketDeployer {
    function deployMarket(
        uint64 eventId,
        uint8 tokenTypeCode,
        address token,
        uint16 feeBps,
        address feeRecipient,
        uint16 homeSelectionId,
        uint16 awaySelectionId,
        int16 spreadTenths,
        bool spreadAppliesToHome,
        address oracle
    ) external returns (address);
}