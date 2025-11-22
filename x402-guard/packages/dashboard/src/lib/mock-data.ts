// packages/dashboard/src/lib/mock-data.ts
// Mock data for development/demo without live contracts

import { GuardConfig, Endpoint, PendingApproval, Transaction, WalletStats } from "./amp";

// ===== Mock Guard Wallets =====

export const MOCK_GUARDS: Record<string, {
  config: GuardConfig;
  endpoints: Endpoint[];
  pendingApprovals: PendingApproval[];
  transactions: Transaction[];
  stats: WalletStats;
  balance: string;
  dailySpent: string;
}> = {
  "0x1234567890abcdef1234567890abcdef12345678": {
    config: {
      wallet: "0x1234567890abcdef1234567890abcdef12345678",
      dailyLimit: "100.00",
      maxPerTransaction: "10.00",
      approvalThreshold: "5.00",
      allowAllEndpoints: false,
      timestamp: Date.now() / 1000 - 86400,
    },
    endpoints: [
      { wallet: "0x1234567890abcdef1234567890abcdef12345678", endpoint: "api.openai.com", addedAt: Date.now() / 1000 - 172800 },
      { wallet: "0x1234567890abcdef1234567890abcdef12345678", endpoint: "api.anthropic.com", addedAt: Date.now() / 1000 - 86400 },
      { wallet: "0x1234567890abcdef1234567890abcdef12345678", endpoint: "api.cohere.ai", addedAt: Date.now() / 1000 - 43200 },
    ],
    pendingApprovals: [
      {
        approvalId: "1",
        wallet: "0x1234567890abcdef1234567890abcdef12345678",
        amount: "7.50",
        endpoint: "api.openai.com/v1/chat/completions",
        requestedAt: Date.now() / 1000 - 300,
      },
    ],
    transactions: [
      {
        wallet: "0x1234567890abcdef1234567890abcdef12345678",
        recipient: "0xaaaa000000000000000000000000000000000001",
        amount: "0.50",
        endpoint: "api.openai.com/v1/chat/completions",
        status: "success",
        timestamp: Date.now() / 1000 - 3600,
      },
      {
        wallet: "0x1234567890abcdef1234567890abcdef12345678",
        recipient: "0xaaaa000000000000000000000000000000000001",
        amount: "1.20",
        endpoint: "api.anthropic.com/v1/messages",
        status: "success",
        timestamp: Date.now() / 1000 - 7200,
      },
      {
        wallet: "0x1234567890abcdef1234567890abcdef12345678",
        recipient: "0xaaaa000000000000000000000000000000000001",
        amount: "15.00",
        endpoint: "api.openai.com/v1/images/generations",
        status: "blocked",
        blockReason: "Exceeds max per transaction ($10.00)",
        timestamp: Date.now() / 1000 - 10800,
      },
      {
        wallet: "0x1234567890abcdef1234567890abcdef12345678",
        recipient: "0xbbbb000000000000000000000000000000000002",
        amount: "2.00",
        endpoint: "api.mistral.ai/v1/chat",
        status: "blocked",
        blockReason: "Endpoint not in allowlist",
        timestamp: Date.now() / 1000 - 14400,
      },
      {
        wallet: "0x1234567890abcdef1234567890abcdef12345678",
        recipient: "0xaaaa000000000000000000000000000000000001",
        amount: "0.75",
        endpoint: "api.cohere.ai/v1/generate",
        status: "success",
        timestamp: Date.now() / 1000 - 18000,
      },
    ],
    stats: {
      totalTransactions: 15,
      totalBlocked: 3,
      totalSpent: "42.50",
      pendingApprovals: 1,
    },
    balance: "57.50",
    dailySpent: "2.45",
  },
};

// ===== Mock User's Guards =====

// Maps user address -> their guard addresses
export const MOCK_USER_GUARDS: Record<string, string[]> = {
  // Any connected wallet will see this mock guard
  "default": ["0x1234567890abcdef1234567890abcdef12345678"],
};

// ===== Helper to get mock data =====

export function getMockGuardData(guardAddress: string) {
  const normalized = guardAddress.toLowerCase();
  const guard = MOCK_GUARDS[normalized] || MOCK_GUARDS["0x1234567890abcdef1234567890abcdef12345678"];
  
  return {
    ...guard,
    config: { ...guard.config, wallet: guardAddress },
  };
}

export function getMockUserGuards(userAddress: string): string[] {
  const normalized = userAddress.toLowerCase();
  return MOCK_USER_GUARDS[normalized] || MOCK_USER_GUARDS["default"];
}

// ===== Mock Contract Functions =====

// Simulates creating a new guard
export function mockCreateGuard(
  owner: string,
  agent: string,
  maxPerTx: string,
  dailyLimit: string,
  approvalThreshold: string
): string {
  // Generate a fake address
  const newAddress = `0x${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16)}`.padEnd(42, "0") as string;
  
  // Add to mock data
  MOCK_GUARDS[newAddress.toLowerCase()] = {
    config: {
      wallet: newAddress,
      dailyLimit,
      maxPerTransaction: maxPerTx,
      approvalThreshold,
      allowAllEndpoints: true,
      timestamp: Date.now() / 1000,
    },
    endpoints: [],
    pendingApprovals: [],
    transactions: [],
    stats: {
      totalTransactions: 0,
      totalBlocked: 0,
      totalSpent: "0.00",
      pendingApprovals: 0,
    },
    balance: "0.00",
    dailySpent: "0.00",
  };

  // Add to user's guards
  const normalizedOwner = owner.toLowerCase();
  if (!MOCK_USER_GUARDS[normalizedOwner]) {
    MOCK_USER_GUARDS[normalizedOwner] = [];
  }
  MOCK_USER_GUARDS[normalizedOwner].push(newAddress);

  console.log(`[MOCK] Created guard ${newAddress} for ${owner}`);
  return newAddress;
}

// Simulates updating policy
export function mockSetPolicy(
  guardAddress: string,
  maxPerTx: string,
  dailyLimit: string,
  approvalThreshold: string
): void {
  const guard = MOCK_GUARDS[guardAddress.toLowerCase()];
  if (guard) {
    guard.config.maxPerTransaction = maxPerTx;
    guard.config.dailyLimit = dailyLimit;
    guard.config.approvalThreshold = approvalThreshold;
    guard.config.timestamp = Date.now() / 1000;
    console.log(`[MOCK] Updated policy for ${guardAddress}`);
  }
}

// Simulates adding an endpoint
export function mockAddEndpoint(guardAddress: string, endpoint: string): void {
  const guard = MOCK_GUARDS[guardAddress.toLowerCase()];
  if (guard) {
    guard.endpoints.push({
      wallet: guardAddress,
      endpoint,
      addedAt: Date.now() / 1000,
    });
    console.log(`[MOCK] Added endpoint ${endpoint} to ${guardAddress}`);
  }
}

// Simulates removing an endpoint
export function mockRemoveEndpoint(guardAddress: string, endpoint: string): void {
  const guard = MOCK_GUARDS[guardAddress.toLowerCase()];
  if (guard) {
    guard.endpoints = guard.endpoints.filter(e => e.endpoint !== endpoint);
    console.log(`[MOCK] Removed endpoint ${endpoint} from ${guardAddress}`);
  }
}

// Simulates toggling allow all endpoints
export function mockToggleAllowAllEndpoints(guardAddress: string, allowAll: boolean): void {
  const guard = MOCK_GUARDS[guardAddress.toLowerCase()];
  if (guard) {
    guard.config.allowAllEndpoints = allowAll;
    console.log(`[MOCK] Set allowAllEndpoints=${allowAll} for ${guardAddress}`);
  }
}

// Simulates approving a payment
export function mockApprovePayment(guardAddress: string, approvalId: string): void {
  const guard = MOCK_GUARDS[guardAddress.toLowerCase()];
  if (guard) {
    const approval = guard.pendingApprovals.find(a => a.approvalId === approvalId);
    if (approval) {
      // Move to transactions as successful
      guard.transactions.unshift({
        wallet: guardAddress,
        recipient: "0xaaaa000000000000000000000000000000000001",
        amount: approval.amount,
        endpoint: approval.endpoint,
        status: "success",
        timestamp: Date.now() / 1000,
      });
      // Remove from pending
      guard.pendingApprovals = guard.pendingApprovals.filter(a => a.approvalId !== approvalId);
      guard.stats.pendingApprovals--;
      guard.stats.totalTransactions++;
      console.log(`[MOCK] Approved payment ${approvalId}`);
    }
  }
}

// Simulates rejecting a payment
export function mockRejectPayment(guardAddress: string, approvalId: string): void {
  const guard = MOCK_GUARDS[guardAddress.toLowerCase()];
  if (guard) {
    const approval = guard.pendingApprovals.find(a => a.approvalId === approvalId);
    if (approval) {
      // Move to transactions as blocked
      guard.transactions.unshift({
        wallet: guardAddress,
        recipient: "0xaaaa000000000000000000000000000000000001",
        amount: approval.amount,
        endpoint: approval.endpoint,
        status: "blocked",
        blockReason: "Rejected by owner",
        timestamp: Date.now() / 1000,
      });
      // Remove from pending
      guard.pendingApprovals = guard.pendingApprovals.filter(a => a.approvalId !== approvalId);
      guard.stats.pendingApprovals--;
      guard.stats.totalBlocked++;
      console.log(`[MOCK] Rejected payment ${approvalId}`);
    }
  }
}

// Simulates funding the guard
export function mockFund(guardAddress: string, amount: string): void {
  const guard = MOCK_GUARDS[guardAddress.toLowerCase()];
  if (guard) {
    const currentBalance = parseFloat(guard.balance);
    const fundAmount = parseFloat(amount);
    guard.balance = (currentBalance + fundAmount).toFixed(2);
    console.log(`[MOCK] Funded ${guardAddress} with $${amount}. New balance: $${guard.balance}`);
  }
}

// Simulates withdrawing from the guard
export function mockWithdraw(guardAddress: string, amount: string): void {
  const guard = MOCK_GUARDS[guardAddress.toLowerCase()];
  if (guard) {
    const currentBalance = parseFloat(guard.balance);
    const withdrawAmount = parseFloat(amount);
    guard.balance = Math.max(0, currentBalance - withdrawAmount).toFixed(2);
    console.log(`[MOCK] Withdrew $${amount} from ${guardAddress}. New balance: $${guard.balance}`);
  }
}