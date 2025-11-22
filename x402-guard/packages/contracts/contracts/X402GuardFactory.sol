// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./X402Guard.sol";

/**
 * @title X402GuardFactory
 * @notice Factory contract for deploying X402Guard wallets
 */
contract X402GuardFactory {
    
    // ============ State ============
    
    address public immutable usdc;
    
    // Track all deployed guards
    mapping(address => address[]) public guardsByOwner;
    address[] public allGuards;
    
    // ============ Events ============
    
    event GuardCreated(
        address indexed guard,
        address indexed owner,
        address indexed agent,
        uint256 maxPerTransaction,
        uint256 dailyLimit,
        uint256 approvalThreshold
    );

    // ============ Constructor ============

    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = _usdc;
    }

    // ============ Factory Function ============

    /**
     * @notice Deploy a new X402Guard wallet
     * @param agent Address that can execute payments
     * @param maxPerTransaction Max USDC per transaction (6 decimals)
     * @param dailyLimit Max USDC per day (6 decimals)
     * @param approvalThreshold Require approval above this amount (6 decimals)
     */
    function createGuard(
        address agent,
        uint256 maxPerTransaction,
        uint256 dailyLimit,
        uint256 approvalThreshold
    ) external returns (address guard) {
        guard = address(new X402Guard(
            usdc,
            msg.sender,  // Owner is the caller
            agent,
            maxPerTransaction,
            dailyLimit,
            approvalThreshold
        ));

        guardsByOwner[msg.sender].push(guard);
        allGuards.push(guard);

        emit GuardCreated(
            guard,
            msg.sender,
            agent,
            maxPerTransaction,
            dailyLimit,
            approvalThreshold
        );
    }

    // ============ View Functions ============

    function getGuardsByOwner(address owner) external view returns (address[] memory) {
        return guardsByOwner[owner];
    }

    function getGuardCount() external view returns (uint256) {
        return allGuards.length;
    }

    function getAllGuards() external view returns (address[] memory) {
        return allGuards;
    }
}
