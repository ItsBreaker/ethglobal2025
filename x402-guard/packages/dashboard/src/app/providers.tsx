"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createPublicClient, createWalletClient, custom, http, Address } from "viem";
import { baseSepolia, hardhat } from "viem/chains";

// Types - using 'any' for complex viem client types to avoid TypeScript generic issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPublicClient = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWalletClient = any;

interface Web3ContextType {
  address: Address | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  publicClient: AnyPublicClient;
  walletClient: AnyWalletClient;
  connect: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
  isSupported: boolean;
}

const Web3Context = createContext<Web3ContextType>({
  address: null,
  isConnected: false,
  isConnecting: false,
  chainId: null,
  publicClient: null,
  walletClient: null,
  connect: async () => {},
  disconnect: () => {},
  error: null,
  isSupported: false,
});

export const useWeb3 = () => useContext(Web3Context);

// Chain configuration
const SUPPORTED_CHAINS = {
  31337: hardhat,
  84532: baseSepolia,
} as const;

interface Web3ProviderProps {
  children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicClient, setPublicClient] = useState<AnyPublicClient>(null);
  const [walletClient, setWalletClient] = useState<AnyWalletClient>(null);

  const isSupported = chainId !== null && chainId in SUPPORTED_CHAINS;

  // Initialize clients when chain AND address change
  useEffect(() => {
    if (!chainId || !address) {
      setPublicClient(null);
      setWalletClient(null);
      return;
    }

    if (chainId in SUPPORTED_CHAINS) {
      const chain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
      
      console.log("Creating clients for chain:", chainId, "address:", address);
      
      const pubClient = createPublicClient({
        chain,
        transport: http(),
      });
      setPublicClient(pubClient);

      if (typeof window !== "undefined" && window.ethereum) {
        const walClient = createWalletClient({
          account: address,
          chain,
          transport: custom(window.ethereum),
        });
        setWalletClient(walClient);
        console.log("Wallet client created with account:", address);
      }
    } else {
      console.warn("Unsupported chain:", chainId);
      setError(`Unsupported chain. Please switch to Base Sepolia (84532) or Hardhat (31337)`);
    }
  }, [chainId, address]);

  // Check for existing connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window === "undefined" || !window.ethereum) return;

      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[];
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0] as Address);
          const chainIdHex = await window.ethereum.request({ method: "eth_chainId" }) as string;
          setChainId(parseInt(chainIdHex, 16));
        }
      } catch (err) {
        console.error("Error checking connection:", err);
      }
    };

    checkConnection();

    // Listen for account changes
    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setAddress(null);
          setChainId(null);
        } else {
          setAddress(accounts[0] as Address);
        }
      };

      const handleChainChanged = (chainIdHex: string) => {
        setChainId(parseInt(chainIdHex, 16));
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
          window.ethereum.removeListener("chainChanged", handleChainChanged);
        }
      };
    }
  }, []);

  const connect = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("Please install MetaMask or another Web3 wallet");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      }) as string[];
      
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0] as Address);
        const chainIdHex = await window.ethereum.request({ method: "eth_chainId" }) as string;
        setChainId(parseInt(chainIdHex, 16));
      }
    } catch (err: unknown) {
      console.error("Connection error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setChainId(null);
    setPublicClient(null);
    setWalletClient(null);
  };

  return (
    <Web3Context.Provider
      value={{
        address,
        isConnected: !!address,
        isConnecting,
        chainId,
        publicClient,
        walletClient,
        connect,
        disconnect,
        error,
        isSupported,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      on: (event: string, callback: (...args: any[]) => void) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      removeListener?: (event: string, callback: (...args: any[]) => void) => void;
      removeAllListeners?: (event: string) => void;
    };
  }
}