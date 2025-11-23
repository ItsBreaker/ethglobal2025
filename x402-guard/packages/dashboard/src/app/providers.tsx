"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { createPublicClient, createWalletClient, custom, http, Address } from "viem";
import { baseSepolia, hardhat } from "viem/chains";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { baseSepolia as privyBaseSepolia } from "@privy-io/chains";

// ============================================
// TYPES
// ============================================

// Using 'any' for complex viem client types to avoid TypeScript generic issues
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
  // New Privy-specific fields
  user: any;
  isPrivyReady: boolean;
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
  user: null,
  isPrivyReady: false,
});

export const useWeb3 = () => useContext(Web3Context);

// ============================================
// CHAIN CONFIGURATION
// ============================================

const SUPPORTED_CHAINS = {
  31337: hardhat,
  84532: baseSepolia,
} as const;

const DEFAULT_CHAIN_ID = 84532; // Base Sepolia

// ============================================
// INNER PROVIDER (uses Privy hooks)
// ============================================

function Web3ProviderInner({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();

  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publicClient, setPublicClient] = useState<AnyPublicClient>(null);
  const [walletClient, setWalletClient] = useState<AnyWalletClient>(null);

  const isSupported = chainId !== null && chainId in SUPPORTED_CHAINS;

  // Get the active wallet (prefer embedded/Privy wallet, then external)
  const activeWallet = wallets.find(w => w.walletClientType === 'privy') || wallets[0];

  // Update address when wallet changes
  useEffect(() => {
    if (activeWallet?.address) {
      setAddress(activeWallet.address as Address);
    } else {
      setAddress(null);
    }
  }, [activeWallet?.address]);

  // Update chainId when wallet changes
  useEffect(() => {
    const updateChainId = async () => {
      if (activeWallet) {
        try {
          // Get chain ID from the wallet
          const provider = await activeWallet.getEthereumProvider();
          const chainIdHex = await provider.request({ method: 'eth_chainId' });
          const parsedChainId = parseInt(chainIdHex, 16);
          setChainId(parsedChainId);
        } catch (err) {
          console.error("Error getting chain ID:", err);
          // Default to Base Sepolia if we can't get chain ID
          setChainId(DEFAULT_CHAIN_ID);
        }
      } else {
        setChainId(null);
      }
    };

    updateChainId();
  }, [activeWallet]);

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

      // Create wallet client from Privy wallet
      const createWalletClientFromPrivy = async () => {
        if (!activeWallet) return;

        try {
          const provider = await activeWallet.getEthereumProvider();
          const walClient = createWalletClient({
            account: address,
            chain,
            transport: custom(provider),
          });
          setWalletClient(walClient);
          console.log("Wallet client created with account:", address);
        } catch (err) {
          console.error("Error creating wallet client:", err);
        }
      };

      createWalletClientFromPrivy();
    } else {
      console.warn("Unsupported chain:", chainId);
      setError(`Unsupported chain. Please switch to Base Sepolia (84532) or Hardhat (31337)`);
    }
  }, [chainId, address, activeWallet]);

  // Connect function - opens Privy modal
  const connect = useCallback(async () => {
    setError(null);
    try {
      login();
    } catch (err: unknown) {
      console.error("Connection error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(errorMessage);
    }
  }, [login]);

  // Disconnect function
  const disconnect = useCallback(() => {
    logout();
    setAddress(null);
    setChainId(null);
    setPublicClient(null);
    setWalletClient(null);
  }, [logout]);

  // Switch network if needed
  useEffect(() => {
    const switchToBaseSepolia = async () => {
      if (activeWallet && chainId && !(chainId in SUPPORTED_CHAINS)) {
        try {
          await activeWallet.switchChain(DEFAULT_CHAIN_ID);
        } catch (err) {
          console.error("Failed to switch chain:", err);
        }
      }
    };

    if (authenticated && activeWallet) {
      switchToBaseSepolia();
    }
  }, [authenticated, activeWallet, chainId]);

  return (
    <Web3Context.Provider
      value={{
        address,
        isConnected: authenticated && !!address,
        isConnecting: !ready,
        chainId,
        publicClient,
        walletClient,
        connect,
        disconnect,
        error,
        isSupported,
        user,
        isPrivyReady: ready,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

// ============================================
// MAIN PROVIDER (wraps with PrivyProvider)
// ============================================

interface Web3ProviderProps {
  children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Fallback to direct MetaMask if no Privy App ID configured
  if (!appId) {
    console.warn("NEXT_PUBLIC_PRIVY_APP_ID not set - falling back to MetaMask only mode");
    return <MetaMaskOnlyProvider>{children}</MetaMaskOnlyProvider>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          // Show these wallet options in this order
          walletList: [
            'metamask',           // MetaMask first (familiar to users)
            'coinbase_wallet',    // Coinbase Wallet
            'rainbow',            // Rainbow
            'wallet_connect',     // WalletConnect (for other wallets)
            'detected_wallets',   // Any other detected wallets
          ],
          // Show wallet options prominently, but also show social login
          showWalletLoginFirst: false,
          theme: 'light',
          accentColor: '#0052FF', // Base blue
          logo: '/logo.png',      // Your logo (optional)
        },
        // Login methods - wallet + social
        loginMethods: [
          'wallet',   // External wallets (MetaMask, etc.)
          'email',    // Email login
          'google',   // Google login
          'twitter',  // Twitter/X login
        ],
        // Target chain
        defaultChain: privyBaseSepolia,
        supportedChains: [privyBaseSepolia],
        // Embedded wallet config (for social logins)
        // New API requires ethereum nested object
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets', // Create wallet for social logins
          },
        },
      }}
    >
      <Web3ProviderInner>{children}</Web3ProviderInner>
    </PrivyProvider>
  );
}

// ============================================
// FALLBACK: MetaMask-only provider (if no Privy App ID)
// ============================================

function MetaMaskOnlyProvider({ children }: { children: ReactNode }) {
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
      }
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

    // Listen for account/chain changes
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
        user: null,
        isPrivyReady: true,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

// ============================================
// TYPE DECLARATIONS
// ============================================

// Extend Window interface for MetaMask fallback
// Using module augmentation to avoid conflicts
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: any;
  }
}