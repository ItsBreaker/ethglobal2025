// amp.config.ts
// AMP Dataset configuration for x402-Guard
// This file defines how your contract events become SQL tables

import { defineDataset, eventTables } from "@edgeandnode/amp";

// Import your contract ABI
// Make sure to export the ABI from your contracts package
// @ts-ignore - ABI import
import { abi as guardAbi } from "./packages/contracts/artifacts/contracts/X402Guard.sol/X402Guard.json";
// @ts-ignore - ABI import  
import { abi as factoryAbi } from "./packages/contracts/artifacts/contracts/X402GuardFactory.sol/X402GuardFactory.json";

export default defineDataset(() => {
  // Auto-generate tables from contract events
  const guardTables = eventTables(guardAbi);
  const factoryTables = eventTables(factoryAbi);

  return {
    // Your namespace - use underscore for local, your team name for published
    namespace: "x402",
    
    // Dataset name
    name: "guard",
    
    // Network - use "anvil" for local, "base-sepolia" for testnet
    network: "base-sepolia",
    
    // Description shown in AMP Studio
    description: "x402-Guard payment control events for AI agents",
    
    // Dependencies - access to raw blockchain data
    dependencies: {
      // For Base Sepolia, use the hosted chain dataset
      "base-sepolia": "_/base-sepolia@latest",
    },
    
    // Tables derived from your contract events
    tables: {
      // ==========================================
      // AUTO-GENERATED FROM GUARD CONTRACT EVENTS
      // ==========================================
      // These are created automatically from eventTables(abi)
      // Event: ConfigSet(address indexed wallet, uint256 dailyLimit, uint256 maxPerTransaction, uint256 approvalThreshold, bool allowAllEndpoints)
      // Event: EndpointAdded(address indexed wallet, string endpoint)
      // Event: EndpointRemoved(address indexed wallet, string endpoint)
      // Event: PaymentExecuted(address indexed wallet, address recipient, uint256 amount, string endpoint)
      // Event: PaymentBlocked(address indexed wallet, address recipient, uint256 amount, string endpoint, string reason)
      // Event: ApprovalRequested(uint256 indexed approvalId, address indexed wallet, uint256 amount, string endpoint)
      // Event: ApprovalResolved(uint256 indexed approvalId, address indexed wallet, bool approved)
      // Event: Funded(address indexed wallet, uint256 amount)
      // Event: Withdrawn(address indexed wallet, uint256 amount)
      ...guardTables,
      
      // ==========================================
      // AUTO-GENERATED FROM FACTORY CONTRACT EVENTS
      // ==========================================
      // Event: GuardCreated(address indexed owner, address indexed agent, address guard, uint256 dailyLimit, uint256 maxPerTransaction, uint256 approvalThreshold)
      ...factoryTables,
      
      // ==========================================
      // CUSTOM DERIVED TABLES
      // ==========================================
      
      // Active guards with their latest config
      active_guards: {
        sql: `
          SELECT DISTINCT ON (wallet)
            wallet,
            daily_limit,
            max_per_transaction,
            approval_threshold,
            allow_all_endpoints,
            timestamp as last_updated
          FROM config_set
          ORDER BY wallet, timestamp DESC
        `,
      },
      
      // Daily spending summary per wallet
      daily_spending: {
        sql: `
          SELECT
            wallet,
            DATE(TO_TIMESTAMP(timestamp)) as date,
            SUM(amount) as total_spent,
            COUNT(*) as transaction_count
          FROM payment_executed
          GROUP BY wallet, DATE(TO_TIMESTAMP(timestamp))
        `,
      },
      
      // Blocked payment reasons summary
      block_reasons: {
        sql: `
          SELECT
            wallet,
            reason,
            COUNT(*) as count,
            SUM(amount) as total_blocked_amount
          FROM payment_blocked
          GROUP BY wallet, reason
        `,
      },
      
      // Endpoint usage stats
      endpoint_stats: {
        sql: `
          SELECT
            wallet,
            endpoint,
            COUNT(*) as usage_count,
            SUM(amount) as total_spent,
            MAX(timestamp) as last_used
          FROM payment_executed
          GROUP BY wallet, endpoint
        `,
      },
    },
  };
});

// ==========================================
// EXPECTED CONTRACT EVENTS (for reference)
// ==========================================
// 
// Your X402Guard.sol should emit these events:
//
// event ConfigSet(
//     address indexed wallet,
//     uint256 dailyLimit,
//     uint256 maxPerTransaction,
//     uint256 approvalThreshold,
//     bool allowAllEndpoints
// );
//
// event EndpointAdded(address indexed wallet, string endpoint);
// event EndpointRemoved(address indexed wallet, string endpoint);
//
// event PaymentExecuted(
//     address indexed wallet,
//     address recipient,
//     uint256 amount,
//     string endpoint
// );
//
// event PaymentBlocked(
//     address indexed wallet,
//     address recipient,
//     uint256 amount,
//     string endpoint,
//     string reason
// );
//
// event ApprovalRequested(
//     uint256 indexed approvalId,
//     address indexed wallet,
//     uint256 amount,
//     string endpoint
// );
//
// event ApprovalResolved(
//     uint256 indexed approvalId,
//     address indexed wallet,
//     bool approved
// );
//
// event Funded(address indexed wallet, uint256 amount);
// event Withdrawn(address indexed wallet, uint256 amount);
//
// Your X402GuardFactory.sol should emit:
//
// event GuardCreated(
//     address indexed owner,
//     address indexed agent,
//     address guard,
//     uint256 dailyLimit,
//     uint256 maxPerTransaction,
//     uint256 approvalThreshold
// );