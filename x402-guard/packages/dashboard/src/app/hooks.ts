"use client";

import { useState, useEffect, useCallback } from "react";
import { Address, parseUnits, formatUnits, keccak256, toBytes } from "viem";
import { useWeb3 } from "./providers";
import { GUARD_ABI, FACTORY_ABI, ERC20_ABI, CONTRACTS } from "@/lib/contracts";
import * as amp from "@/lib/amp";
import * as mock from "@/lib/mock-data";

// ===== MOCK MODE TOGGLE =====
// Set to true to use mock data (no contracts needed)
// Set to false to use real contracts
const USE_MOCK_MODE = process.env.NEXT_PUBLIC_USE_MOCK === "true" || true; // Default to mock for now

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
}

export interface Endpoint {
  wallet: string;
  endpoint: string;
  addedAt: number;
}

// ===== Helper Functions =====

export function hashEndpoint(url: string): `0x${string}` {
  return keccak256(toBytes(url));
}

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

  // Fetch guard data - MOCK or REAL
  const fetchGuardData = useCallback(async () => {
    if (!guardAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      if (USE_MOCK_MODE) {
        // === MOCK MODE ===
        console.log("[MOCK] Fetching guard data for", guardAddress);
        const mockData = mock.getMockGuardData(guardAddress);
        
        const dailyLimit = parseFloat(mockData.config.dailyLimit);
        const dailySpent = parseFloat(mockData.dailySpent);
        
        setGuardData({
          address: guardAddress,
          owner: address || "0x0000000000000000000000000000000000000000" as Address,
          agent: address || "0x0000000000000000000000000000000000000000" as Address,
          balance: mockData.balance,
          dailySpent: mockData.dailySpent,
          totalSpent: mockData.stats.totalSpent,
          dailyLimit: mockData.config.dailyLimit,
          maxPerTransaction: mockData.config.maxPerTransaction,
          approvalThreshold: mockData.config.approvalThreshold,
          remainingBudget: (dailyLimit - dailySpent).toFixed(2),
          timeUntilReset: getTimeUntilMidnight(),
          allowAllEndpoints: mockData.config.allowAllEndpoints,
        });
        
        setEndpoints(mockData.endpoints);
        setTransactions(mockData.transactions);
        
        // Convert pending approvals to pending payments format
        setPendingPayments(mockData.pendingApprovals.map((a, idx) => ({
          id: parseInt(a.approvalId),
          to: "0x0000000000000000000000000000000000000000" as Address,
          amount: a.amount,
          endpointHash: a.endpoint,
          expiry: a.requestedAt + 86400,
          executed: false,
          rejected: false,
        })));
        
      } else {
        // === REAL CONTRACT MODE ===
        if (!publicClient) {
          throw new Error("Public client not available");
        }

        // Batch read contract calls
        const [
          owner,
          agent,
          balance,
          dailySpent,
          totalSpent,
          dailyLimit,
          maxPerTransaction,
          approvalThreshold,
          remainingBudget,
          timeUntilReset,
          allowAllEndpoints,
        ] = await Promise.all([
          publicClient.readContract({
            address: guardAddress,
            abi: GUARD_ABI,
            functionName: "owner",
          }),
          publicClient.readContract({
            address: guardAddress,
            abi: GUARD_ABI,
            functionName: "agent",
          }),
          publicClient.readContract({
            address: guardAddress,
            abi: GUARD_ABI,
            functionName: "getBalance",
          }),
          publicClient.readContract({
            address: guardAddress,
            abi: GUARD_ABI,
            functionName: "dailySpent",
          }),
          publicClient.readContract({
            address: guardAddress,
            abi: GUARD_ABI,
            functionName: "totalSpent",
          }),
          publicClient.readContract({
            address: guardAddress,
            abi: GUARD_ABI,
            functionName: "dailyLimit",
          }),
          publicClient.readContract({
            address: guardAddress,
            abi: GUARD_ABI,
            functionName: "maxPerTransaction",
          }),
          publicClient.readContract({
            address: guardAddress,
            abi: GUARD_ABI,
            functionName: "approvalThreshold",
          }),
          publicClient.readContract({
            address: guardAddress,
            abi: GUARD_ABI,
            functionName: "getRemainingDailyBudget",
          }),
          publicClient.readContract({
            address: guardAddress,
            abi: GUARD_ABI,
            functionName: "getTimeUntilReset",
          }),
          publicClient.readContract({
            address: guardAddress,
            abi: GUARD_ABI,
            functionName: "allowAllEndpoints",
          }),
        ]);

        setGuardData({
          address: guardAddress,
          owner: owner as Address,
          agent: agent as Address,
          balance: formatUnits(balance as bigint, 6),
          dailySpent: formatUnits(dailySpent as bigint, 6),
          totalSpent: formatUnits(totalSpent as bigint, 6),
          dailyLimit: formatUnits(dailyLimit as bigint, 6),
          maxPerTransaction: formatUnits(maxPerTransaction as bigint, 6),
          approvalThreshold: formatUnits(approvalThreshold as bigint, 6),
          remainingBudget: formatUnits(remainingBudget as bigint, 6),
          timeUntilReset: formatTimeUntilReset(Number(timeUntilReset)),
          allowAllEndpoints: allowAllEndpoints as boolean,
        });

        // Fetch AMP data
        try {
          const [ampEndpoints, ampTransactions] = await Promise.all([
            amp.getEndpoints(guardAddress),
            amp.getTransactions(guardAddress),
          ]);
          setEndpoints(ampEndpoints);
          setTransactions(ampTransactions);
        } catch (ampErr) {
          console.warn("AMP data fetch failed (AMP may not be running):", ampErr);
        }
      }
    } catch (err: unknown) {
      console.error("Error fetching guard data:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch guard data";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, guardAddress, address]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (guardAddress) {
      fetchGuardData();
    }
  }, [guardAddress, fetchGuardData]);

  // Set policy
  const setPolicy = useCallback(
    async (maxPerTx: string, dailyLimit: string, approvalThreshold: string) => {
      if (USE_MOCK_MODE) {
        console.log("[MOCK] Setting policy");
        if (guardAddress) {
          mock.mockSetPolicy(guardAddress, maxPerTx, dailyLimit, approvalThreshold);
        }
        await fetchGuardData();
        return "0xmockhash";
      }

      if (!walletClient || !publicClient || !guardAddress || !address) {
        throw new Error("Wallet not connected");
      }

      const hash = await walletClient.writeContract({
        address: guardAddress,
        abi: GUARD_ABI,
        functionName: "setPolicy",
        args: [
          parseUnits(maxPerTx, 6),
          parseUnits(dailyLimit, 6),
          parseUnits(approvalThreshold, 6),
        ],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await fetchGuardData();
      return hash;
    },
    [walletClient, publicClient, guardAddress, address, fetchGuardData]
  );

  // Set agent
  const setAgent = useCallback(
    async (newAgent: Address) => {
      if (USE_MOCK_MODE) {
        console.log("[MOCK] Setting agent to", newAgent);
        await fetchGuardData();
        return "0xmockhash";
      }

      if (!walletClient || !publicClient || !guardAddress || !address) {
        throw new Error("Wallet not connected");
      }

      const hash = await walletClient.writeContract({
        address: guardAddress,
        abi: GUARD_ABI,
        functionName: "setAgent",
        args: [newAgent],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await fetchGuardData();
      return hash;
    },
    [walletClient, publicClient, guardAddress, address, fetchGuardData]
  );

  // Add endpoint
  const addEndpoint = useCallback(
    async (url: string) => {
      if (USE_MOCK_MODE) {
        console.log("[MOCK] Adding endpoint", url);
        if (guardAddress) {
          mock.mockAddEndpoint(guardAddress, url);
        }
        await fetchGuardData();
        return "0xmockhash";
      }

      if (!walletClient || !publicClient || !guardAddress || !address) {
        throw new Error("Wallet not connected");
      }

      const hash = await walletClient.writeContract({
        address: guardAddress,
        abi: GUARD_ABI,
        functionName: "setEndpointAllowedByUrl",
        args: [url, true],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await fetchGuardData();
      return hash;
    },
    [walletClient, publicClient, guardAddress, address, fetchGuardData]
  );

  // Remove endpoint
  const removeEndpoint = useCallback(
    async (url: string) => {
      if (USE_MOCK_MODE) {
        console.log("[MOCK] Removing endpoint", url);
        if (guardAddress) {
          mock.mockRemoveEndpoint(guardAddress, url);
        }
        await fetchGuardData();
        return "0xmockhash";
      }

      if (!walletClient || !publicClient || !guardAddress || !address) {
        throw new Error("Wallet not connected");
      }

      const hash = await walletClient.writeContract({
        address: guardAddress,
        abi: GUARD_ABI,
        functionName: "setEndpointAllowedByUrl",
        args: [url, false],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await fetchGuardData();
      return hash;
    },
    [walletClient, publicClient, guardAddress, address, fetchGuardData]
  );

  // Toggle allow all endpoints
  const toggleAllowAllEndpoints = useCallback(
    async (allowAll: boolean) => {
      if (USE_MOCK_MODE) {
        console.log("[MOCK] Toggle allow all endpoints:", allowAll);
        if (guardAddress) {
          mock.mockToggleAllowAllEndpoints(guardAddress, allowAll);
        }
        await fetchGuardData();
        return "0xmockhash";
      }

      if (!walletClient || !publicClient || !guardAddress || !address) {
        throw new Error("Wallet not connected");
      }

      const hash = await walletClient.writeContract({
        address: guardAddress,
        abi: GUARD_ABI,
        functionName: "setAllowAllEndpoints",
        args: [allowAll],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await fetchGuardData();
      return hash;
    },
    [walletClient, publicClient, guardAddress, address, fetchGuardData]
  );

  // Approve payment
  const approvePayment = useCallback(
    async (paymentId: number) => {
      if (USE_MOCK_MODE) {
        console.log("[MOCK] Approving payment", paymentId);
        if (guardAddress) {
          mock.mockApprovePayment(guardAddress, paymentId.toString());
        }
        await fetchGuardData();
        return "0xmockhash";
      }

      if (!walletClient || !publicClient || !guardAddress || !address) {
        throw new Error("Wallet not connected");
      }

      const hash = await walletClient.writeContract({
        address: guardAddress,
        abi: GUARD_ABI,
        functionName: "approvePayment",
        args: [BigInt(paymentId)],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await fetchGuardData();
      return hash;
    },
    [walletClient, publicClient, guardAddress, address, fetchGuardData]
  );

  // Reject payment
  const rejectPayment = useCallback(
    async (paymentId: number) => {
      if (USE_MOCK_MODE) {
        console.log("[MOCK] Rejecting payment", paymentId);
        if (guardAddress) {
          mock.mockRejectPayment(guardAddress, paymentId.toString());
        }
        await fetchGuardData();
        return "0xmockhash";
      }

      if (!walletClient || !publicClient || !guardAddress || !address) {
        throw new Error("Wallet not connected");
      }

      const hash = await walletClient.writeContract({
        address: guardAddress,
        abi: GUARD_ABI,
        functionName: "rejectPayment",
        args: [BigInt(paymentId)],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await fetchGuardData();
      return hash;
    },
    [walletClient, publicClient, guardAddress, address, fetchGuardData]
  );

  // Fund guard
  const fund = useCallback(
    async (amount: string) => {
      if (USE_MOCK_MODE) {
        console.log("[MOCK] Funding guard with", amount);
        if (guardAddress) {
          mock.mockFund(guardAddress, amount);
        }
        await fetchGuardData();
        return "0xmockhash";
      }

      if (!walletClient || !publicClient || !guardAddress || !address || !chainId) {
        throw new Error("Wallet not connected");
      }

      const contracts = CONTRACTS[chainId as keyof typeof CONTRACTS];
      if (!contracts?.usdc) {
        throw new Error("USDC contract not configured for this chain");
      }

      const amountWei = parseUnits(amount, 6);

      // First approve USDC
      const approveHash = await walletClient.writeContract({
        address: contracts.usdc as Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [guardAddress, amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Then fund
      const fundHash = await walletClient.writeContract({
        address: guardAddress,
        abi: GUARD_ABI,
        functionName: "fund",
        args: [amountWei],
      });

      await publicClient.waitForTransactionReceipt({ hash: fundHash });
      await fetchGuardData();
      return fundHash;
    },
    [walletClient, publicClient, guardAddress, address, chainId, fetchGuardData]
  );

  // Withdraw
  const withdraw = useCallback(
    async (amount: string) => {
      if (USE_MOCK_MODE) {
        console.log("[MOCK] Withdrawing", amount);
        if (guardAddress) {
          mock.mockWithdraw(guardAddress, amount);
        }
        await fetchGuardData();
        return "0xmockhash";
      }

      if (!walletClient || !publicClient || !guardAddress || !address) {
        throw new Error("Wallet not connected");
      }

      const hash = await walletClient.writeContract({
        address: guardAddress,
        abi: GUARD_ABI,
        functionName: "withdraw",
        args: [parseUnits(amount, 6)],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await fetchGuardData();
      return hash;
    },
    [walletClient, publicClient, guardAddress, address, fetchGuardData]
  );

  // Withdraw all
  const withdrawAll = useCallback(async () => {
    if (USE_MOCK_MODE) {
      console.log("[MOCK] Withdrawing all");
      if (guardAddress) {
        const mockData = mock.getMockGuardData(guardAddress);
        mock.mockWithdraw(guardAddress, mockData.balance);
      }
      await fetchGuardData();
      return "0xmockhash";
    }

    if (!walletClient || !publicClient || !guardAddress || !address) {
      throw new Error("Wallet not connected");
    }

    const hash = await walletClient.writeContract({
      address: guardAddress,
      abi: GUARD_ABI,
      functionName: "withdrawAll",
      args: [],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    await fetchGuardData();
    return hash;
  }, [walletClient, publicClient, guardAddress, address, fetchGuardData]);

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
  };
}

// ===== useUserGuards Hook =====

export function useUserGuards() {
  const { publicClient, address, chainId } = useWeb3();
  const [guards, setGuards] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGuards = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      if (USE_MOCK_MODE) {
        // === MOCK MODE ===
        console.log("[MOCK] Fetching guards for", address);
        const mockGuards = mock.getMockUserGuards(address);
        setGuards(mockGuards as Address[]);
      } else {
        // === REAL CONTRACT MODE ===
        if (!publicClient || !chainId) {
          throw new Error("Not connected");
        }

        const contracts = CONTRACTS[chainId as keyof typeof CONTRACTS];
        if (!contracts?.factory) {
          setError(`Factory contract not configured for chain ${chainId}. Please add it to CONTRACTS in lib/contracts.ts`);
          return;
        }

        const userGuards = await publicClient.readContract({
          address: contracts.factory as Address,
          abi: FACTORY_ABI,
          functionName: "getGuardsByOwner",
          args: [address],
        });

        setGuards(userGuards as Address[]);
      }
    } catch (err: unknown) {
      console.error("Error fetching guards:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch guards";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, address, chainId]);

  useEffect(() => {
    fetchGuards();
  }, [fetchGuards]);

  return { guards, isLoading, error, refetch: fetchGuards };
}

// ===== useCreateGuard Hook =====

export function useCreateGuard() {
  const { publicClient, walletClient, address, chainId } = useWeb3();
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

      setIsCreating(true);
      setError(null);

      try {
        if (USE_MOCK_MODE) {
          // === MOCK MODE ===
          console.log("[MOCK] Creating guard");
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 1500));
          const newGuard = mock.mockCreateGuard(
            address,
            agent,
            maxPerTx,
            dailyLimit,
            approvalThreshold
          );
          return newGuard as Address;
        }

        // === REAL CONTRACT MODE ===
        if (!walletClient || !publicClient || !chainId) {
          setError("Wallet not connected");
          return null;
        }

        const contracts = CONTRACTS[chainId as keyof typeof CONTRACTS];
        if (!contracts?.factory) {
          setError(`Factory contract not configured for chain ${chainId}. Please add it to CONTRACTS in lib/contracts.ts`);
          return null;
        }

        const hash = await walletClient.writeContract({
          address: contracts.factory as Address,
          abi: FACTORY_ABI,
          functionName: "createGuard",
          args: [
            agent,
            parseUnits(maxPerTx, 6),
            parseUnits(dailyLimit, 6),
            parseUnits(approvalThreshold, 6),
          ],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // Extract guard address from event logs
        const guardCreatedTopic = keccak256(toBytes("GuardCreated(address,address,address,uint256,uint256,uint256)"));
        const guardCreatedLog = receipt.logs.find((log: { topics: string[] }) => {
          return log.topics[0] === guardCreatedTopic;
        });

        if (guardCreatedLog && guardCreatedLog.topics[1]) {
          const guardAddress = `0x${guardCreatedLog.topics[1].slice(26)}` as Address;
          return guardAddress;
        }

        return null;
      } catch (err: unknown) {
        console.error("Error creating guard:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to create guard";
        setError(errorMessage);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [walletClient, publicClient, address, chainId]
  );

  return { createGuard, isCreating, error };
}