// app/src/lib/amp.ts
// AMP client for querying guard data

const AMP_ENDPOINT = process.env.NEXT_PUBLIC_AMP_ENDPOINT || "http://localhost:1603";
const DATASET = process.env.NEXT_PUBLIC_AMP_DATASET || "x402/guard@dev";

// ===== Types =====

export interface GuardConfig {
  wallet: string;
  dailyLimit: string;
  maxPerTransaction: string;
  approvalThreshold: string;
  allowAllEndpoints: boolean;
  timestamp: number;
}

export interface Endpoint {
  wallet: string;
  endpoint: string;
  addedAt: number;
}

export interface PendingApproval {
  approvalId: string;
  wallet: string;
  amount: string;
  endpoint: string;
  requestedAt: number;
}

export interface Transaction {
  wallet: string;
  recipient: string;
  amount: string;
  endpoint: string;
  status: "success" | "blocked";
  blockReason?: string;
  timestamp: number;
}

export interface ApprovalResolution {
  approvalId: string;
  wallet: string;
  approved: boolean;
  resolvedAt: number;
}

export interface WalletStats {
  totalTransactions: number;
  totalBlocked: number;
  totalSpent: string;
  pendingApprovals: number;
}

// ===== AMP Query Helper =====

async function query<T = any>(sql: string): Promise<T[]> {
  const response = await fetch(AMP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: sql,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("AMP query failed:", error);
    throw new Error(`AMP query failed: ${response.status}`);
  }

  // AMP returns JSON Lines (one JSON object per line)
  const text = await response.text();
  if (!text.trim()) return [];

  return text
    .trim()
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

// ===== Query Functions =====

/**
 * Get the latest config for a wallet
 */
export async function getConfig(wallet: string): Promise<GuardConfig | null> {
  const results = await query<any>(`
    SELECT 
      wallet,
      daily_limit,
      max_per_transaction,
      approval_threshold,
      allow_all_endpoints,
      timestamp
    FROM "${DATASET}".config_set
    WHERE wallet = '${wallet.toLowerCase()}'
    ORDER BY timestamp DESC
    LIMIT 1
  `);

  if (results.length === 0) return null;

  const row = results[0];
  return {
    wallet: row.wallet,
    dailyLimit: (Number(row.daily_limit) / 1e6).toFixed(2),
    maxPerTransaction: (Number(row.max_per_transaction) / 1e6).toFixed(2),
    approvalThreshold: (Number(row.approval_threshold) / 1e6).toFixed(2),
    allowAllEndpoints: row.allow_all_endpoints,
    timestamp: Number(row.timestamp),
  };
}

/**
 * Get active endpoints for a wallet
 * Active = added but not removed
 */
export async function getEndpoints(wallet: string): Promise<Endpoint[]> {
  // Get all added endpoints that haven't been removed
  const results = await query<any>(`
    WITH added AS (
      SELECT wallet, endpoint, timestamp as added_at
      FROM "${DATASET}".endpoint_added
      WHERE wallet = '${wallet.toLowerCase()}'
    ),
    removed AS (
      SELECT wallet, endpoint, timestamp as removed_at
      FROM "${DATASET}".endpoint_removed
      WHERE wallet = '${wallet.toLowerCase()}'
    )
    SELECT a.wallet, a.endpoint, a.added_at
    FROM added a
    LEFT JOIN removed r ON a.wallet = r.wallet 
      AND a.endpoint = r.endpoint 
      AND r.removed_at > a.added_at
    WHERE r.removed_at IS NULL
    ORDER BY a.added_at DESC
  `);

  return results.map((row) => ({
    wallet: row.wallet,
    endpoint: row.endpoint,
    addedAt: Number(row.added_at),
  }));
}

/**
 * Check if an endpoint is active for a wallet
 */
export async function isEndpointActive(wallet: string, endpoint: string): Promise<boolean> {
  const endpoints = await getEndpoints(wallet);
  return endpoints.some((e) => e.endpoint === endpoint);
}

/**
 * Get pending approvals for a wallet
 * Pending = requested but not resolved
 */
export async function getPendingApprovals(wallet: string): Promise<PendingApproval[]> {
  const results = await query<any>(`
    WITH requested AS (
      SELECT approval_id, wallet, amount, endpoint, timestamp as requested_at
      FROM "${DATASET}".approval_requested
      WHERE wallet = '${wallet.toLowerCase()}'
    ),
    resolved AS (
      SELECT approval_id, wallet, approved, timestamp as resolved_at
      FROM "${DATASET}".approval_resolved
      WHERE wallet = '${wallet.toLowerCase()}'
    )
    SELECT r.approval_id, r.wallet, r.amount, r.endpoint, r.requested_at
    FROM requested r
    LEFT JOIN resolved res ON r.approval_id = res.approval_id
    WHERE res.approval_id IS NULL
    ORDER BY r.requested_at DESC
  `);

  return results.map((row) => ({
    approvalId: row.approval_id.toString(),
    wallet: row.wallet,
    amount: (Number(row.amount) / 1e6).toFixed(2),
    endpoint: row.endpoint,
    requestedAt: Number(row.requested_at),
  }));
}

/**
 * Get a specific pending approval by ID
 */
export async function getPendingApproval(approvalId: string): Promise<PendingApproval | null> {
  const results = await query<any>(`
    WITH requested AS (
      SELECT approval_id, wallet, amount, endpoint, timestamp as requested_at
      FROM "${DATASET}".approval_requested
      WHERE approval_id = '${approvalId}'
    ),
    resolved AS (
      SELECT approval_id
      FROM "${DATASET}".approval_resolved
      WHERE approval_id = '${approvalId}'
    )
    SELECT r.approval_id, r.wallet, r.amount, r.endpoint, r.requested_at
    FROM requested r
    LEFT JOIN resolved res ON r.approval_id = res.approval_id
    WHERE res.approval_id IS NULL
    LIMIT 1
  `);

  if (results.length === 0) return null;

  const row = results[0];
  return {
    approvalId: row.approval_id.toString(),
    wallet: row.wallet,
    amount: (Number(row.amount) / 1e6).toFixed(2),
    endpoint: row.endpoint,
    requestedAt: Number(row.requested_at),
  };
}

/**
 * Get successful transactions for a wallet
 */
export async function getSuccessfulTransactions(wallet: string, limit: number = 50): Promise<Transaction[]> {
  const results = await query<any>(`
    SELECT wallet, recipient, amount, endpoint, timestamp
    FROM "${DATASET}".payment_executed
    WHERE wallet = '${wallet.toLowerCase()}'
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `);

  return results.map((row) => ({
    wallet: row.wallet,
    recipient: row.recipient,
    amount: (Number(row.amount) / 1e6).toFixed(2),
    endpoint: row.endpoint,
    status: "success" as const,
    timestamp: Number(row.timestamp),
  }));
}

/**
 * Get blocked transactions for a wallet
 */
export async function getBlockedTransactions(wallet: string, limit: number = 50): Promise<Transaction[]> {
  const results = await query<any>(`
    SELECT wallet, recipient, amount, endpoint, reason, timestamp
    FROM "${DATASET}".payment_blocked
    WHERE wallet = '${wallet.toLowerCase()}'
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `);

  return results.map((row) => ({
    wallet: row.wallet,
    recipient: row.recipient,
    amount: (Number(row.amount) / 1e6).toFixed(2),
    endpoint: row.endpoint,
    status: "blocked" as const,
    blockReason: row.reason,
    timestamp: Number(row.timestamp),
  }));
}

/**
 * Get all transactions (both successful and blocked) for a wallet
 */
export async function getTransactions(wallet: string, limit: number = 50): Promise<Transaction[]> {
  const [successful, blocked] = await Promise.all([
    getSuccessfulTransactions(wallet, limit),
    getBlockedTransactions(wallet, limit),
  ]);

  return [...successful, ...blocked]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Get daily spending for a wallet (today)
 */
export async function getDailySpending(wallet: string): Promise<string> {
  const now = new Date();
  const todayStart = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);

  const results = await query<any>(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM "${DATASET}".payment_executed
    WHERE wallet = '${wallet.toLowerCase()}'
      AND timestamp >= ${todayStart}
  `);

  const total = Number(results[0]?.total || 0);
  return (total / 1e6).toFixed(2);
}

/**
 * Get spending for a specific time period
 */
export async function getSpendingInPeriod(
  wallet: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<string> {
  const results = await query<any>(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM "${DATASET}".payment_executed
    WHERE wallet = '${wallet.toLowerCase()}'
      AND timestamp >= ${startTimestamp}
      AND timestamp <= ${endTimestamp}
  `);

  const total = Number(results[0]?.total || 0);
  return (total / 1e6).toFixed(2);
}

/**
 * Get wallet statistics
 */
export async function getWalletStats(wallet: string): Promise<WalletStats> {
  const [successCount, blockedCount, totalSpent, pendingCount] = await Promise.all([
    query<any>(`
      SELECT COUNT(*) as count
      FROM "${DATASET}".payment_executed
      WHERE wallet = '${wallet.toLowerCase()}'
    `),
    query<any>(`
      SELECT COUNT(*) as count
      FROM "${DATASET}".payment_blocked
      WHERE wallet = '${wallet.toLowerCase()}'
    `),
    query<any>(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM "${DATASET}".payment_executed
      WHERE wallet = '${wallet.toLowerCase()}'
    `),
    query<any>(`
      WITH requested AS (
        SELECT approval_id FROM "${DATASET}".approval_requested
        WHERE wallet = '${wallet.toLowerCase()}'
      ),
      resolved AS (
        SELECT approval_id FROM "${DATASET}".approval_resolved
        WHERE wallet = '${wallet.toLowerCase()}'
      )
      SELECT COUNT(*) as count
      FROM requested r
      LEFT JOIN resolved res ON r.approval_id = res.approval_id
      WHERE res.approval_id IS NULL
    `),
  ]);

  return {
    totalTransactions: Number(successCount[0]?.count || 0),
    totalBlocked: Number(blockedCount[0]?.count || 0),
    totalSpent: (Number(totalSpent[0]?.total || 0) / 1e6).toFixed(2),
    pendingApprovals: Number(pendingCount[0]?.count || 0),
  };
}

/**
 * Get config history for a wallet
 */
export async function getConfigHistory(wallet: string, limit: number = 10): Promise<GuardConfig[]> {
  const results = await query<any>(`
    SELECT 
      wallet,
      daily_limit,
      max_per_transaction,
      approval_threshold,
      allow_all_endpoints,
      timestamp
    FROM "${DATASET}".config_set
    WHERE wallet = '${wallet.toLowerCase()}'
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `);

  return results.map((row) => ({
    wallet: row.wallet,
    dailyLimit: (Number(row.daily_limit) / 1e6).toFixed(2),
    maxPerTransaction: (Number(row.max_per_transaction) / 1e6).toFixed(2),
    approvalThreshold: (Number(row.approval_threshold) / 1e6).toFixed(2),
    allowAllEndpoints: row.allow_all_endpoints,
    timestamp: Number(row.timestamp),
  }));
}

/**
 * Get all data for a wallet (used on initial load)
 */
export async function getWalletData(wallet: string) {
  const [config, endpoints, pendingApprovals, transactions, dailySpent, stats] = await Promise.all([
    getConfig(wallet),
    getEndpoints(wallet),
    getPendingApprovals(wallet),
    getTransactions(wallet),
    getDailySpending(wallet),
    getWalletStats(wallet),
  ]);

  return {
    config,
    endpoints,
    pendingApprovals,
    transactions,
    dailySpent,
    stats,
  };
}

/**
 * Check if a payment would be allowed based on current config
 * This is a client-side check - actual enforcement happens on-chain
 */
export async function checkPaymentAllowed(
  wallet: string,
  amount: string,
  endpoint: string
): Promise<{ allowed: boolean; reason?: string }> {
  const [config, endpoints, dailySpent] = await Promise.all([
    getConfig(wallet),
    getEndpoints(wallet),
    getDailySpending(wallet),
  ]);

  if (!config) {
    return { allowed: false, reason: "No config set for wallet" };
  }

  const amountNum = parseFloat(amount);
  const maxPerTx = parseFloat(config.maxPerTransaction);
  const dailyLimit = parseFloat(config.dailyLimit);
  const dailySpentNum = parseFloat(dailySpent);

  // Check max per transaction
  if (amountNum > maxPerTx) {
    return { allowed: false, reason: `Amount exceeds max per transaction ($${maxPerTx})` };
  }

  // Check daily limit
  if (dailySpentNum + amountNum > dailyLimit) {
    return { allowed: false, reason: `Would exceed daily limit ($${dailyLimit})` };
  }

  // Check endpoint allowlist
  if (!config.allowAllEndpoints) {
    const isAllowed = endpoints.some((e) => e.endpoint === endpoint);
    if (!isAllowed) {
      return { allowed: false, reason: `Endpoint not in allowlist: ${endpoint}` };
    }
  }

  return { allowed: true };
}

// ===== Subscription / Real-time Updates =====

/**
 * Poll for updates (simple polling approach)
 * Returns a cleanup function to stop polling
 */
export function subscribeToWalletUpdates(
  wallet: string,
  callback: (data: Awaited<ReturnType<typeof getWalletData>>) => void,
  intervalMs: number = 5000
): () => void {
  let isRunning = true;

  const poll = async () => {
    while (isRunning) {
      try {
        const data = await getWalletData(wallet);
        callback(data);
      } catch (error) {
        console.error("Error polling wallet data:", error);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  };

  poll();

  return () => {
    isRunning = false;
  };
}