"use client";

import { useState, useEffect, useCallback } from "react";
import { Address, createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { useWeb3 } from "./providers";
import * as db from "@/lib/db-browser";

// ===== Exported Types =====

export interface GuardData {
  address: Address;
  owner: Address;
  agent: Address;
  balance: string;
  dailySpent: string;
  totalSpent: string;
  dailyLimit: string;
  maxPerTransaction: string;
  approvalThreshold: string;
  remainingBudget: string;
  timeUntilReset: string;
  allowAllEndpoints: boolean;
}

export interface PendingPayment {
  id: number;
  to: Address;
  amount: string;
  endpointHash: string;
  expiry: number;
  executed: boolean;
  rejected: boolean;
}

export interface Transaction {
  wallet: string;
  recipient: string;
  amount: string;
  endpoint: string;
  status: "success" | "blocked";
  blockReason?: string;
  timestamp: number;
  txHash?: string;
  explorerUrl?: string;
}

export interface Endpoint {
  wallet: string;
  endpoint: string;
  addedAt: number;
}

export interface E2EPaymentResult {
  success: boolean;
  result?: any;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

// ===== Helper Functions =====

function formatTimeUntilReset(seconds: number): string {
  if (seconds <= 0) return "Now";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const seconds = Math.floor((midnight.getTime() - now.getTime()) / 1000);
  return formatTimeUntilReset(seconds);
}

// ===== useGuard Hook =====

export function useGuard(guardAddress?: Address) {
  const { publicClient, walletClient, address, chainId } = useWeb3();
  
  const [guardData, setGuardData] = useState<GuardData | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbGuardId, setDbGuardId] = useState<number | null>(null);

  // Fetch guard data - Uses IndexedDB as primary source
  const fetchGuardData = useCallback(async () => {
    if (!guardAddress || !address) return;

    setIsLoading(true);
    setError(null);

    try {
      // Ensure user exists in database
      let user = await db.getUser(undefined, address);
      if (!user) {
        user = await db.createUser(`privy-${address}`, address);
        console.log("[DB] Created user in database:", user.id);
      }

      // Get or create guard in database
      let dbGuard = await db.getGuardByAddress(guardAddress);
      
      if (!dbGuard) {
        // Guard doesn't exist in DB yet - create with defaults
        dbGuard = await db.createGuard({
          userId: user.id!,
          guardAddress,
          name: `Guard ${guardAddress.slice(0, 8)}`,
          dailyLimit: "100.0",
          perTransactionLimit: "10.0",
          approvalThreshold: "50.0",
        });
        console.log("[DB] Created guard in database:", dbGuard.id);
      }

      setDbGuardId(dbGuard.id!);
      
      // Build guard data from database
      const guardDataObj: GuardData = {
        address: guardAddress,
        owner: address,
        agent: address,
        balance: "0.00", // Will be updated by fund operations
        dailySpent: "0.00", // Calculated from transactions
        totalSpent: "0.00", // Calculated from transactions
        dailyLimit: dbGuard.daily_limit,
        maxPerTransaction: dbGuard.per_transaction_limit,
        approvalThreshold: dbGuard.approval_threshold,
        remainingBudget: dbGuard.daily_limit,
        timeUntilReset: getTimeUntilMidnight(),
        allowAllEndpoints: true, // Default for now
      };

      // Calculate daily spend from transactions
      const dailySpendResult = await db.getDailySpend(dbGuard.id!);
      guardDataObj.dailySpent = dailySpendResult.total.toFixed(2);
      guardDataObj.remainingBudget = (
        parseFloat(dbGuard.daily_limit) - dailySpendResult.total
      ).toFixed(2);

      // Calculate total spent from all transactions
      const allTxs = await db.getTransactions(dbGuard.id!, 1000);
      const totalSpent = allTxs
        .filter(tx => tx.status === 'success')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      guardDataObj.totalSpent = totalSpent.toFixed(2);

      // Calculate balance (this is a simplified version - in production would come from blockchain)
      // For now, we'll track it in memory or could add a balance field to the guard table
      const fundTxs = allTxs.filter(tx => tx.endpoint_used === 'fund');
      const withdrawTxs = allTxs.filter(tx => tx.endpoint_used === 'withdraw');
      const fundTotal = fundTxs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      const withdrawTotal = withdrawTxs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      guardDataObj.balance = (fundTotal - withdrawTotal - totalSpent).toFixed(2);

      setGuardData(guardDataObj);
      
      console.log("[DB] Loaded guard data from database:", {
        dailyLimit: dbGuard.daily_limit,
        perTxLimit: dbGuard.per_transaction_limit,
        approvalThreshold: dbGuard.approval_threshold,
        dailySpent: guardDataObj.dailySpent,
        balance: guardDataObj.balance,
      });

      // Load transactions from database
      const dbTransactions = await db.getTransactions(dbGuard.id!);
      console.log("[DB] Loaded transactions:", dbTransactions.length);
      
      const formattedTxs: Transaction[] = dbTransactions.map(tx => ({
        wallet: guardAddress,
        recipient: tx.recipient,
        amount: tx.amount,
        endpoint: tx.endpoint_used || '',
        status: tx.status === 'success' ? 'success' : 'blocked',
        blockReason: tx.error_message,
        timestamp: Math.floor(new Date(tx.created_at || Date.now()).getTime() / 1000),
        txHash: tx.tx_hash,
      }));
      
      setTransactions(formattedTxs);

      // Load endpoints from database
      const dbEndpoints = await db.getEndpoints(dbGuard.id!);
      console.log("[DB] Loaded endpoints:", dbEndpoints.length);
      
      const formattedEndpoints: Endpoint[] = dbEndpoints.map(ep => ({
        wallet: guardAddress,
        endpoint: ep.url,
        addedAt: Math.floor(new Date(ep.created_at || Date.now()).getTime() / 1000),
      }));
      
      setEndpoints(formattedEndpoints);
      
      // No pending payments for now (would come from smart contract)
      setPendingPayments([]);

    } catch (err: unknown) {
      console.error("Error fetching guard data:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch guard data";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [guardAddress, address]);

  // Auto-fetch on mount and when guardAddress changes
  useEffect(() => {
    if (guardAddress) {
      fetchGuardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardAddress, address]); // Only re-fetch when guard address or user address changes

  // Set policy
  const setPolicy = useCallback(
    async (maxPerTx: string, dailyLimit: string, approvalThreshold: string) => {
      if (!guardAddress || !dbGuardId) {
        throw new Error("Guard not initialized");
      }

      console.log("[DB] Updating policy");
      
      // Update database
      await db.updateGuard({
        guardId: dbGuardId,
        dailyLimit: dailyLimit,
        perTransactionLimit: maxPerTx,
        approvalThreshold: approvalThreshold,
      });
      console.log("[DB] Updated guard policy in database");
      
      // Update local state
      if (guardData) {
        setGuardData({
          ...guardData,
          maxPerTransaction: maxPerTx,
          dailyLimit: dailyLimit,
          approvalThreshold: approvalThreshold,
          remainingBudget: (parseFloat(dailyLimit) - parseFloat(guardData.dailySpent)).toFixed(2),
        });
      }
      
      return "0xsuccess";
    },
    [guardAddress, guardData, dbGuardId]
  );

  // Set agent
  const setAgent = useCallback(
    async (newAgent: Address) => {
      console.log("[DB] Setting agent to", newAgent);
      // For now, just log - would update database or contract in production
      return "0xsuccess";
    },
    []
  );

  // Add endpoint
  const addEndpoint = useCallback(
    async (url: string) => {
      if (!guardAddress || !dbGuardId) {
        throw new Error("Guard not initialized");
      }

      console.log("[DB] Adding endpoint", url);
      
      // Save to database
      await db.addEndpoint({
        guardId: dbGuardId,
        url: url,
        description: `Added ${new Date().toLocaleDateString()}`,
      });
      console.log("[DB] Saved endpoint to database");
      
      // Update local state
      setEndpoints(prev => [...prev, {
        wallet: guardAddress,
        endpoint: url,
        addedAt: Math.floor(Date.now() / 1000),
      }]);
      
      return "0xsuccess";
    },
    [guardAddress, dbGuardId]
  );

  // Remove endpoint
  const removeEndpoint = useCallback(
    async (url: string) => {
      if (!dbGuardId) {
        throw new Error("Guard not initialized");
      }

      console.log("[DB] Removing endpoint", url);
      
      // Remove from database
      const dbEndpoints = await db.getEndpoints(dbGuardId);
      const endpoint = dbEndpoints.find(ep => ep.url === url);
      if (endpoint && endpoint.id) {
        await db.removeEndpoint(endpoint.id);
        console.log("[DB] Removed endpoint from database");
        
        // Update local state
        setEndpoints(prev => prev.filter(e => e.endpoint !== url));
      }
      
      return "0xsuccess";
    },
    [dbGuardId]
  );

  // Toggle allow all endpoints
  const toggleAllowAllEndpoints = useCallback(
    async (allowAll: boolean) => {
      console.log("[DB] Toggle allow all endpoints:", allowAll);
      
      // Update local state
      if (guardData) {
        setGuardData({
          ...guardData,
          allowAllEndpoints: allowAll,
        });
      }
      
      return "0xsuccess";
    },
    [guardData]
  );

  // Approve payment
  const approvePayment = useCallback(
    async (paymentId: number) => {
      console.log("[DB] Approving payment", paymentId);
      return "0xsuccess";
    },
    []
  );

  // Reject payment
  const rejectPayment = useCallback(
    async (paymentId: number) => {
      console.log("[DB] Rejecting payment", paymentId);
      return "0xsuccess";
    },
    []
  );

  // Fund guard
  const fund = useCallback(
    async (amount: string) => {
      if (!guardAddress || !dbGuardId) {
        throw new Error("Guard not initialized");
      }

      console.log("[DB] Funding guard with", amount);
      
      // Log transaction to database
      await db.logTransaction({
        guardId: dbGuardId,
        amount: amount,
        recipient: guardAddress,
        endpointUsed: 'fund',
        status: 'success',
        txHash: '0xfund' + Date.now(),
      });
      console.log("[DB] Logged fund transaction");
      
      // Update local state - add to balance
      if (guardData) {
        const newBalance = (parseFloat(guardData.balance) + parseFloat(amount)).toFixed(2);
        setGuardData({
          ...guardData,
          balance: newBalance,
        });
      }
      
      // Add transaction to list
      setTransactions(prev => [{
        wallet: guardAddress,
        recipient: guardAddress,
        amount: amount,
        endpoint: 'fund',
        status: 'success',
        timestamp: Math.floor(Date.now() / 1000),
      }, ...prev]);
      
      return "0xsuccess";
    },
    [guardAddress, dbGuardId, guardData]
  );

  // Withdraw
  const withdraw = useCallback(
    async (amount: string) => {
      if (!guardAddress || !dbGuardId) {
        throw new Error("Guard not initialized");
      }

      console.log("[DB] Withdrawing", amount);
      
      // Log transaction to database
      await db.logTransaction({
        guardId: dbGuardId,
        amount: amount,
        recipient: guardAddress,
        endpointUsed: 'withdraw',
        status: 'success',
        txHash: '0xwithdraw' + Date.now(),
      });
      
      // Update local state - subtract from balance
      if (guardData) {
        const newBalance = (parseFloat(guardData.balance) - parseFloat(amount)).toFixed(2);
        setGuardData({
          ...guardData,
          balance: newBalance,
        });
      }
      
      return "0xsuccess";
    },
    [guardAddress, dbGuardId, guardData]
  );

  // Withdraw all
  const withdrawAll = useCallback(async () => {
    if (!guardAddress || !dbGuardId || !guardData) {
      throw new Error("Guard not initialized");
    }

    console.log("[DB] Withdrawing all");
    
    const currentBalance = guardData.balance;
    
    // Log transaction
    await db.logTransaction({
      guardId: dbGuardId,
      amount: currentBalance,
      recipient: guardAddress,
      endpointUsed: 'withdraw',
      status: 'success',
      txHash: '0xwithdrawAll' + Date.now(),
    });
    
    // Update local state
    setGuardData({
      ...guardData,
      balance: "0.00",
    });
    
    return "0xsuccess";
  }, [guardAddress, dbGuardId, guardData]);

  // Make E2E payment through proxy (with manual payment construction)
  const makeE2EPayment = useCallback(
    async (targetUrl: string): Promise<E2EPaymentResult> => {
      if (!guardAddress || !dbGuardId || !guardData) {
        throw new Error("Guard not initialized");
      }

      if (!walletClient) {
        throw new Error("Wallet not connected");
      }

      console.log("[E2E] Making payment to", targetUrl);
      
      try {
        // First, call the endpoint without payment to get the 402 response with payment details
        const proxyUrl = `/api/x402-proxy/e2e?target=${encodeURIComponent(targetUrl)}`;
        console.log("[E2E] Fetching payment requirements from:", proxyUrl);
        
        const initialResponse = await fetch(proxyUrl, {
          method: 'GET',
        });

        if (initialResponse.status !== 402) {
          // If it's not 402, either it succeeded without payment or there's an error
          if (initialResponse.ok) {
            const data = await initialResponse.json();
            return {
              success: true,
              result: data,
            };
          }
          const errorData = await initialResponse.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Request failed with status ${initialResponse.status}`);
        }

        // Parse the 402 response to get payment requirements
        const paymentRequired = await initialResponse.json();
        console.log("[E2E] Payment required:", paymentRequired);

        // Extract payment details
        const accept = paymentRequired.accepts?.[0] || paymentRequired.payment;
        if (!accept) {
          throw new Error("Could not parse payment requirements from proxy");
        }

        const payTo = accept.payTo as Address;
        const amount = accept.maxAmountRequired || accept.amount;
        const token = accept.asset || accept.token || 'USDC';

        console.log("[E2E] Payment details:", { payTo, amount, token });

        // Create payment using viem signature
        const account = walletClient.account;
        if (!account) {
          throw new Error("No account found in wallet");
        }

        // Create the payment message to sign
        const paymentMessage = {
          from: account.address,
          to: payTo,
          amount: amount.toString(),
          token: token,
          timestamp: Date.now().toString(),
          nonce: Math.random().toString(36).substring(7),
        };

        console.log("[E2E] Creating payment signature...");

        // Sign the payment message
        const signature = await walletClient.signMessage({
          account,
          message: JSON.stringify(paymentMessage),
        });

        const payment = {
          ...paymentMessage,
          signature,
        };

        console.log("[E2E] Payment created, sending request with payment header...");

        // Make the request again with the payment header
        const paidResponse = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'x-payment': JSON.stringify(payment),
            'Content-Type': 'application/json',
          },
        });

        if (!paidResponse.ok) {
          const errorData = await paidResponse.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Request failed with status ${paidResponse.status}`);
        }

        const result = await paidResponse.json();

        if (!result.success) {
          throw new Error(result.error || 'Payment was not successful');
        }

        console.log("[E2E] Payment successful:", result);

        // Extract payment amount from bridge details
        const paymentAmount = result.bridge?.amount || "0.01";
        const targetChain = result.bridge?.toChain || "unknown";

        // Log transaction to database
        await db.logTransaction({
          guardId: dbGuardId,
          amount: paymentAmount,
          recipient: targetUrl,
          endpointUsed: targetUrl,
          status: 'success',
          txHash: result.bridge?.txHash || '0xe2e' + Date.now(),
        });

        // Update local state
        const newBalance = (parseFloat(guardData.balance) - parseFloat(paymentAmount)).toFixed(2);
        const newDailySpent = (parseFloat(guardData.dailySpent) + parseFloat(paymentAmount)).toFixed(2);
        const newTotalSpent = (parseFloat(guardData.totalSpent) + parseFloat(paymentAmount)).toFixed(2);

        setGuardData({
          ...guardData,
          balance: newBalance,
          dailySpent: newDailySpent,
          totalSpent: newTotalSpent,
          remainingBudget: (parseFloat(guardData.dailyLimit) - parseFloat(newDailySpent)).toFixed(2),
        });

        // Add transaction to list
        setTransactions(prev => [{
          wallet: guardAddress,
          recipient: targetUrl,
          amount: paymentAmount,
          endpoint: targetUrl,
          status: 'success',
          timestamp: Math.floor(Date.now() / 1000),
          txHash: result.bridge?.txHash,
          explorerUrl: result.bridge?.explorerUrl,
        }, ...prev]);

        return {
          success: true,
          result,
          txHash: result.bridge?.txHash,
          explorerUrl: result.bridge?.explorerUrl,
        };
      } catch (err: unknown) {
        console.error("[E2E] Payment failed:", err);
        const errorMessage = err instanceof Error ? err.message : "Payment failed";
        
        // Log failed transaction
        await db.logTransaction({
          guardId: dbGuardId,
          amount: "0.00",
          recipient: targetUrl,
          endpointUsed: targetUrl,
          status: 'failed',
          errorMessage,
          txHash: '0xfailed' + Date.now(),
        });

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [guardAddress, dbGuardId, guardData, walletClient]
  );

  return {
    guardData,
    pendingPayments,
    transactions,
    endpoints,
    isLoading,
    error,
    refetch: fetchGuardData,
    // Actions
    setPolicy,
    setAgent,
    addEndpoint,
    removeEndpoint,
    toggleAllowAllEndpoints,
    approvePayment,
    rejectPayment,
    fund,
    withdraw,
    withdrawAll,
    makeE2EPayment,
  };
}

// ===== useUserGuards Hook =====

export function useUserGuards() {
  const { address } = useWeb3();
  const [guards, setGuards] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGuards = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("[DB] Fetching guards for", address);
      
      // Get user from database
      let user = await db.getUser(undefined, address);
      if (!user) {
        // User doesn't exist yet - no guards
        setGuards([]);
        setIsLoading(false);
        return;
      }

      // Get all guards for this user
      const userGuards = await db.getGuards(user.id!);
      const guardAddresses = userGuards.map(g => g.guard_address as Address);
      
      console.log("[DB] Found", guardAddresses.length, "guards");
      setGuards(guardAddresses);
    } catch (err: unknown) {
      console.error("Error fetching guards:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch guards";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchGuards();
  }, [fetchGuards]);

  return { guards, isLoading, error, refetch: fetchGuards };
}

// ===== useCreateGuard Hook =====

export function useCreateGuard() {
  const { address, walletClient } = useWeb3();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGuard = useCallback(
    async (
      agent: Address,
      maxPerTx: string,
      dailyLimit: string,
      approvalThreshold: string
    ): Promise<Address | null> => {
      if (!address) {
        setError("Wallet not connected");
        return null;
      }

      if (!walletClient) {
        setError("Wallet client not available");
        return null;
      }

      setIsCreating(true);
      setError(null);

      try {
        console.log("[Guard] Creating guard - this would deploy a real contract");
        
        // TODO: Replace this with actual contract deployment
        // For now, using the connected wallet address as the guard address
        // In production, this would deploy a Guard contract and return its address
        const newGuardAddress = address; // Temporary: use user's address
        
        console.warn("[Guard] WARNING: Using wallet address as guard address (temporary)");
        console.warn("[Guard] In production, deploy a real Guard contract here");
        
        // Ensure user exists
        let user = await db.getUser(undefined, address);
        if (!user) {
          user = await db.createUser(`privy-${address}`, address);
        }
        
        // Create guard in database
        await db.createGuard({
          userId: user.id!,
          guardAddress: newGuardAddress,
          name: `Guard ${newGuardAddress.slice(0, 8)}`,
          dailyLimit,
          perTransactionLimit: maxPerTx,
          approvalThreshold,
        });
        
        console.log("[DB] Saved new guard to database:", newGuardAddress);
        
        return newGuardAddress;
      } catch (err: unknown) {
        console.error("Error creating guard:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to create guard";
        setError(errorMessage);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [address, walletClient]
  );

  return { createGuard, isCreating, error };
}