// amp.config.ts
// AMP dataset configuration for x402-Guard
// This automatically creates SQL tables from your contract events

import { defineDataset, eventTables } from "@edgeandnode/amp";
// @ts-ignore
import { abi } from "./app/src/lib/abi.ts";

export default defineDataset(() => {
  // Auto-generate tables from contract events
  // This creates tables: config_set, endpoint_added, endpoint_removed, etc.
  const baseTables = eventTables(abi);

  return {
    namespace: "x402",
    name: "guard",
    network: "anvil", // Change to "base-sepolia" or "base" for production
    description: "x402 Guard - User policies, endpoints, and transaction history",

    dependencies: {
      // Access to raw blockchain data (blocks, transactions, logs)
      anvil: "_/anvil@0.0.1",
    },

    tables: {
      // Auto-generated event tables
      ...baseTables,

      // ===== Derived Tables (pre-computed views for faster queries) =====

      // Latest config for each wallet (most recent ConfigSet event)
      latest_configs: {
        sql: `
          SELECT DISTINCT ON (wallet)
            wallet,
            daily_limit,
            max_per_transaction,
            approval_threshold,
            allow_all_endpoints,
            timestamp,
            block_num
          FROM guard.config_set
          ORDER BY wallet, block_num DESC, log_index DESC
        `,
      },

      // Active endpoints per wallet (added but not removed)
      active_endpoints: {
        sql: `
          SELECT 
            a.wallet,
            a.endpoint,
            a.timestamp as added_at,
            a.block_num
          FROM guard.endpoint_added a
          LEFT JOIN guard.endpoint_removed r 
            ON a.wallet = r.wallet 
            AND a.endpoint = r.endpoint 
            AND r.block_num > a.block_num
          WHERE r.wallet IS NULL
        `,
      },

      // Pending approvals (requested but not resolved)
      pending_approvals: {
        sql: `
          SELECT 
            r.approval_id,
            r.wallet,
            r.amount,
            r.endpoint,
            r.timestamp as requested_at
          FROM guard.approval_requested r
          LEFT JOIN guard.approval_resolved res 
            ON r.approval_id = res.approval_id
          WHERE res.approval_id IS NULL
        `,
      },

      // All transactions (successful payments)
      transactions: {
        sql: `
          SELECT 
            wallet,
            recipient,
            amount,
            endpoint,
            'success' as status,
            NULL as block_reason,
            timestamp,
            block_num
          FROM guard.payment_executed
        `,
      },

      // Blocked transactions
      blocked_transactions: {
        sql: `
          SELECT 
            wallet,
            recipient,
            amount,
            endpoint,
            'blocked' as status,
            reason as block_reason,
            timestamp,
            block_num
          FROM guard.payment_blocked
        `,
      },
    },
  };
});