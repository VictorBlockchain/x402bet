// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Market } from "./Market.sol";

/// @dev Dedicated deployer to keep Factory bytecode small.
contract MarketDeployer {
    address public immutable factory;

    constructor(address _factory) {
        require(_factory != address(0), "factory required");
        factory = _factory;
    }

    function deployMarket(
        uint64 eventId,
        address creator,
        uint8 tokenTypeCode,
        address token,
        uint16 feeBps,
        address feeRecipient,
        uint16 homeSelectionId,
        uint16 awaySelectionId,
        int16 spreadTenths,
        bool spreadAppliesToHome,
        address oracle
    ) external returns (address) {
        require(msg.sender == factory, "not factory");
        Market.TokenType tt = tokenTypeCode == 0 ? Market.TokenType.Native : Market.TokenType.ERC20;
        Market m = new Market(
            factory,
            creator,
            eventId,
            tt,
            token,
            feeBps,
            feeRecipient,
            homeSelectionId,
            awaySelectionId,
            spreadTenths,
            spreadAppliesToHome,
            oracle
        );
        return address(m);
    }
}