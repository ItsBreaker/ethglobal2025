'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createBaseAccountSDK, pay, getPaymentStatus } from '@base-org/account';
import { BasePayButton } from '@base-org/account-ui/react';
import { BrowserProvider, Contract, formatUnits, parseUnits } from 'ethers';
import { CONTRACTS, ERC20_ABI } from '@/lib/contracts';

// Spend permission utilities - these will be dynamically imported  
type SpendPermission = any;
type PermissionStatus = any;

interface WalletState {
  address: string;
  isConnected: boolean;
  usdcBalance: string;
  isLoading: boolean;
  chainId: number;
}

interface PaymentState {
  status: string;
  id: string;
}

interface PermissionState {
  permissions: SpendPermission[];
  isLoading: boolean;
  error: string;
}

const BASE_SEPOLIA_CHAIN_ID = 84532;
const USDC_ADDRESS = CONTRACTS[BASE_SEPOLIA_CHAIN_ID].usdc;
const DEMO_SPENDER_ADDRESS = process.env.NEXT_PUBLIC_DEMO_SPENDER_ADDRESS || '0x0000000000000000000000000000000000000000';

export default function BaseAccountDemo() {
  const [wallet, setWallet] = useState<WalletState>({
    address: '',
    isConnected: false,
    usdcBalance: '0',
    isLoading: false,
    chainId: 0,
  });
  
  const [payment, setPayment] = useState<PaymentState>({
    status: '',
    id: '',
  });

  const [permissionState, setPermissionState] = useState<PermissionState>({
    permissions: [],
    isLoading: false,
    error: '',
  });

  const [demoSpendStatus, setDemoSpendStatus] = useState<string>('');

  // Initialize SDK in a ref to avoid SSR issues
  const sdkRef = useRef<ReturnType<typeof createBaseAccountSDK> | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined' && !sdkRef.current) {
      sdkRef.current = createBaseAccountSDK({
        appName: 'x402-Guard',
        appLogoUrl: 'https://x402.io/logo.png',
      });
    }
  }, []);

  const getSDK = () => {
    if (!sdkRef.current) {
      throw new Error('SDK not initialized');
    }
    return sdkRef.current;
  };

  // Fetch USDC balance using Base SDK provider
  const fetchUSDCBalance = useCallback(async (address: string) => {
    try {
      if (!sdkRef.current) return '0';
      const sdk = getSDK();
      const provider = sdk.getProvider();
      const ethersProvider = new BrowserProvider(provider as any);
      
      // Check network
      const network = await ethersProvider.getNetwork();
      console.log('Connected to network:', network.chainId);
      
      if (network.chainId !== BigInt(BASE_SEPOLIA_CHAIN_ID)) {
        console.warn('Not connected to Base Sepolia, switching...');
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x14a34' }], // Base Sepolia hex
          });
        } catch (switchError: any) {
          // Chain not added, try adding it
          if (switchError.code === 4902) {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x14a34',
                chainName: 'Base Sepolia',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://sepolia.base.org'],
                blockExplorerUrls: ['https://sepolia.basescan.org'],
              }],
            });
          }
        }
      }
      
      const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, ethersProvider);
      console.log('Fetching balance for address:', address);
      console.log('USDC contract address:', USDC_ADDRESS);
      
      const balance = await usdcContract.balanceOf(address);
      const decimals = await usdcContract.decimals();
      
      console.log('Raw balance:', balance.toString());
      console.log('Decimals:', decimals);
      
      const formattedBalance = formatUnits(balance, decimals);
      console.log('Formatted balance:', formattedBalance);
      
      return formattedBalance;
    } catch (error) {
      console.error('Failed to fetch USDC balance:', error);
      setPayment(prev => ({ ...prev, status: 'Balance fetch error: ' + (error as Error).message }));
      return '0';
    }
  }, []);

  // Refresh balance
  const refreshBalance = async () => {
    if (wallet.address) {
      const balance = await fetchUSDCBalance(wallet.address);
      setWallet(prev => ({ ...prev, usdcBalance: balance || '0' }));
    }
  };

  // Check if already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (!sdkRef.current) return;
        const sdk = getSDK();
        const provider = sdk.getProvider();
        const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
        
        if (accounts && accounts.length > 0) {
          const address = accounts[0];
          console.log('Wallet already connected:', address);
          
          setWallet(prev => ({
            ...prev,
            address,
            isConnected: true,
            isLoading: true,
          }));
          
          const balance = await fetchUSDCBalance(address);
          
          setWallet({
            address,
            isConnected: true,
            usdcBalance: balance || '0',
            isLoading: false,
            chainId: BASE_SEPOLIA_CHAIN_ID,
          });
        }
      } catch (error) {
        console.error('Failed to check connection:', error);
      }
    };

    checkConnection();
  }, [fetchUSDCBalance]);

  // Connect with Base
  const handleConnect = async () => {
    setWallet(prev => ({ ...prev, isLoading: true }));
    
    try {
      const sdk = getSDK();
      const provider = sdk.getProvider();
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      
      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        console.log('Connected to address:', address);
        
        const ethersProvider = new BrowserProvider(provider as any);
        const network = await ethersProvider.getNetwork();
        const chainId = Number(network.chainId);
        
        setWallet(prev => ({
          ...prev,
          address,
          isConnected: true,
          chainId,
        }));
        
        const balance = await fetchUSDCBalance(address);
        console.log('Balance fetched:', balance);
        
        setWallet({
          address,
          isConnected: true,
          usdcBalance: balance || '0',
          isLoading: false,
          chainId,
        });
      }
    } catch (error) {
      console.error('Connection failed:', error);
      setPayment({ status: 'Connection failed: ' + (error as Error).message, id: '' });
      setWallet(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Disconnect wallet
  const handleDisconnect = () => {
    setWallet({
      address: '',
      isConnected: false,
      usdcBalance: '0',
      isLoading: false,
      chainId: 0,
    });
    setPayment({ status: '', id: '' });
  };

  // One-tap USDC payment using the pay() function
  const handlePayment = async () => {
    try {
      const { id } = await pay({
        amount: '0.01',
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        testnet: true
      });

      setPayment({
        id,
        status: 'Payment initiated! Click "Check Status" to see the result.',
      });
      
      setTimeout(refreshBalance, 2000);
    } catch (error) {
      console.error('Payment failed:', error);
      setPayment({ status: 'Payment failed: ' + (error as Error).message, id: '' });
    }
  };

  // Check payment status
  const handleCheckStatus = async () => {
    if (!payment.id) {
      setPayment({ status: 'No payment ID found. Please make a payment first.', id: '' });
      return;
    }

    try {
      const { status } = await getPaymentStatus({ id: payment.id });
      setPayment(prev => ({ ...prev, status: `Payment status: ${status}` }));
    } catch (error) {
      console.error('Status check failed:', error);
      setPayment(prev => ({ ...prev, status: 'Status check failed: ' + (error as Error).message }));
    }
  };

  // Fetch spend permissions
  const fetchSpendPermissions = async () => {
    if (!wallet.address) return;

    setPermissionState(prev => ({ ...prev, isLoading: true, error: '' }));
    
    try {
      const sdk = getSDK();
      const provider = sdk.getProvider();
      
      // Dynamic import for spend permissions
      const { fetchPermissions } = await import('@base-org/account/spend-permission');
      
      const permissions = await fetchPermissions({
        account: wallet.address,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        spender: DEMO_SPENDER_ADDRESS,
        provider,
      });

      setPermissionState({
        permissions: permissions as SpendPermission[],
        isLoading: false,
        error: '',
      });
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      setPermissionState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to fetch permissions: ' + (error as Error).message,
      }));
    }
  };

  // Request new spend permission
  const handleRequestPermission = async () => {
    if (!wallet.address) return;

    setPermissionState(prev => ({ ...prev, isLoading: true, error: '' }));

    try {
      const sdk = getSDK();
      const provider = sdk.getProvider();

      // Dynamic import for spend permissions
      const { requestSpendPermission } = await import('@base-org/account/spend-permission');

      // Request permission for 1 USDC allowance per day for 30 days
      const permission = await requestSpendPermission({
        account: wallet.address,
        spender: DEMO_SPENDER_ADDRESS,
        token: USDC_ADDRESS,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        allowance: parseUnits('1', 6), // 1 USDC (6 decimals)
        periodInDays: 1, // 1 day period
        provider,
      });

      console.log('Permission granted:', permission);
      setPermissionState(prev => ({
        ...prev,
        isLoading: false,
        error: '',
      }));

      // Refresh permissions list
      await fetchSpendPermissions();
    } catch (error) {
      console.error('Failed to request permission:', error);
      setPermissionState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to request permission: ' + (error as Error).message,
      }));
    }
  };

  // Revoke spend permission
  const handleRevokePermission = async (permission: SpendPermission) => {
    setPermissionState(prev => ({ ...prev, isLoading: true, error: '' }));

    try {
      // Dynamic import for spend permissions
      const { requestRevoke } = await import('@base-org/account/spend-permission');
      
      const hash = await requestRevoke(permission);
      console.log('Permission revoked:', hash);
      
      setPermissionState(prev => ({
        ...prev,
        isLoading: false,
        error: '',
      }));

      // Refresh permissions list
      await fetchSpendPermissions();
    } catch (error) {
      console.error('Failed to revoke permission:', error);
      setPermissionState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to revoke permission: ' + (error as Error).message,
      }));
    }
  };

  // Trigger demo spend from backend
  const handleDemoSpend = async () => {
    if (!wallet.address) return;

    setDemoSpendStatus('Requesting backend to spend 1 USDC...');

    try {
      const response = await fetch('/api/demo/spend-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userAddress: wallet.address,
          chainId: BASE_SEPOLIA_CHAIN_ID,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Backend spend failed');
      }

      setDemoSpendStatus(`Success! Transaction: ${data.transactionHash}`);
      
      // Refresh balance after a delay
      setTimeout(refreshBalance, 2000);
    } catch (error) {
      console.error('Demo spend failed:', error);
      setDemoSpendStatus('Demo spend failed: ' + (error as Error).message);
    }
  };

  // Load permissions when wallet connects
  useEffect(() => {
    if (wallet.isConnected && wallet.address && !permissionState.isLoading && permissionState.permissions.length === 0) {
      fetchSpendPermissions();
    }
  }, [wallet.isConnected, wallet.address]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Base Account Demo</h1>
        <p className="mt-1.5 text-sm text-fg-secondary">
          Connect your wallet, view USDC balance, and manage spend permissions on Base Sepolia
        </p>
      </div>

      {/* Wallet Connection Section */}
      <div className="card p-6 space-y-4">
        <div>
          <h2 className="font-semibold mb-2">Step 1: Connect with Base</h2>
          <p className="text-sm text-fg-secondary mb-4">
            Connect using Base Wallet to view your USDC balance
          </p>
        </div>

        <div className="flex flex-col items-start gap-4">
          {!wallet.isConnected ? (
            <button
              onClick={handleConnect}
              disabled={wallet.isLoading}
              className="btn-primary"
            >
              {wallet.isLoading ? 'Connecting...' : 'Connect Base Wallet'}
            </button>
          ) : (
            <div className="w-full space-y-3">
              <div className="p-4 bg-success-muted/30 border border-success/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-success">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="font-semibold">Wallet Connected</span>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="text-xs px-3 py-1 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
                <p className="font-mono text-sm text-fg-secondary break-all">
                  {wallet.address}
                </p>
                {wallet.chainId > 0 && (
                  <p className="text-xs text-fg-muted mt-2">
                    Chain ID: {wallet.chainId} {wallet.chainId !== BASE_SEPOLIA_CHAIN_ID && '⚠️ Not Base Sepolia'}
                  </p>
                )}
              </div>

              {wallet.chainId !== BASE_SEPOLIA_CHAIN_ID && wallet.chainId > 0 && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <p className="text-sm text-yellow-600">
                    ⚠️ Please switch to Base Sepolia network to view USDC balance
                  </p>
                </div>
              )}

              {/* USDC Balance */}
              <div className="p-4 bg-bg-tertiary border border-border rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-fg-secondary mb-1">USDC Balance (Base Sepolia)</p>
                    <p className="text-2xl font-semibold">{wallet.usdcBalance} USDC</p>
                  </div>
                  <button
                    onClick={refreshBalance}
                    className="btn-secondary text-sm"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Section */}
      {wallet.isConnected && (
        <div className="card p-6 space-y-4">
          <div>
            <h2 className="font-semibold mb-2">Step 2: Test Base Pay</h2>
            <p className="text-sm text-fg-secondary mb-4">
              Send a test payment of $0.01 USDC (Base Sepolia testnet)
            </p>
          </div>

          <div className="flex flex-col items-start gap-4">
            <BasePayButton
              colorScheme="light"
              onClick={handlePayment}
            />

            {payment.id && (
              <button
                onClick={handleCheckStatus}
                className="btn-secondary"
              >
                Check Payment Status
              </button>
            )}
          </div>

          {payment.status && (
            <div className={`p-4 rounded-xl border ${payment.status.includes('failed')
              ? 'bg-error-muted/30 border-error/30 text-error'
              : 'bg-bg-tertiary border-border'
              }`}>
              <p className="text-sm font-medium">{payment.status}</p>
              {payment.id && (
                <p className="text-xs font-mono text-fg-muted mt-2">
                  Payment ID: {payment.id}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Spend Permissions Section */}
      {wallet.isConnected && (
        <div className="card p-6 space-y-4">
          <div>
            <h2 className="font-semibold mb-2">Step 3: Manage Spend Permissions</h2>
            <p className="text-sm text-fg-secondary mb-4">
              Grant permission for our demo server to spend USDC on your behalf
            </p>
          </div>

          {/* Request Permission Button */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleRequestPermission}
              disabled={permissionState.isLoading}
              className="btn-primary"
            >
              {permissionState.isLoading ? 'Processing...' : 'Grant Spend Permission (1 USDC/day)'}
            </button>

            {permissionState.error && (
              <div className="p-3 bg-error-muted/30 border border-error/30 rounded-xl">
                <p className="text-sm text-error">{permissionState.error}</p>
              </div>
            )}
          </div>

          {/* Existing Permissions List */}
          {permissionState.permissions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-fg-secondary">Active Permissions</h3>
              {permissionState.permissions.map((permission, index) => (
                <div key={index} className="p-4 bg-bg-tertiary border border-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Spender: {permission.spender.slice(0, 6)}...{permission.spender.slice(-4)}</p>
                      <p className="text-xs text-fg-secondary">
                        Allowance: {formatUnits(permission.allowance, 6)} USDC / {permission.period / 86400} days
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevokePermission(permission)}
                      disabled={permissionState.isLoading}
                      className="btn-secondary text-sm text-error"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Demo Spend Section */}
      {wallet.isConnected && permissionState.permissions.length > 0 && (
        <div className="card p-6 space-y-4">
          <div>
            <h2 className="font-semibold mb-2">Step 4: Test Automated Spend</h2>
            <p className="text-sm text-fg-secondary mb-4">
              Our backend will spend 1 USDC from your account and send it back to you
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleDemoSpend}
              className="btn-primary"
            >
              Trigger Demo Spend (Backend)
            </button>

            {demoSpendStatus && (
              <div className={`p-4 rounded-xl border ${demoSpendStatus.includes('failed')
                ? 'bg-error-muted/30 border-error/30 text-error'
                : demoSpendStatus.includes('Success')
                ? 'bg-success-muted/30 border-success/30 text-success'
                : 'bg-bg-tertiary border-border'
                }`}>
                <p className="text-sm font-medium">{demoSpendStatus}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Faucet & Resources */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold">Get Testnet USDC</h2>
        <div className="space-y-3">
          <p className="text-sm text-fg-secondary">
            You need testnet USDC on Base Sepolia to test payments. Use these faucets:
          </p>
          <div className="space-y-2">
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-bg-tertiary border border-border rounded-lg hover:border-border-hover transition-colors"
            >
              <div>
                <p className="font-medium text-sm">Circle USDC Faucet</p>
                <p className="text-xs text-fg-secondary">Get testnet USDC for Base Sepolia</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
            
            <a
              href="https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-bg-tertiary border border-border rounded-lg hover:border-border-hover transition-colors"
            >
              <div>
                <p className="font-medium text-sm">Coinbase Base Sepolia Faucet</p>
                <p className="text-xs text-fg-secondary">Get ETH for gas fees</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold">About This Demo</h2>
        <div className="space-y-3 text-sm text-fg-secondary">
          <p>
            <strong className="text-fg-primary">Wallet Connection:</strong> Connect your wallet to view
            your USDC balance and manage spend permissions on Base Sepolia testnet.
          </p>
          <p>
            <strong className="text-fg-primary">Spend Permissions:</strong> View which contracts have
            permission to spend your USDC, following the Base Account spend permissions model.
          </p>
          <p>
            <strong className="text-fg-primary">Base Pay:</strong> One-tap USDC payments on Base.
            The SDK automatically handles wallet connection, USDC quoting, and transaction execution.
          </p>
          <p>
            <strong className="text-fg-primary">Testnet:</strong> This demo uses Base Sepolia testnet.
            Use the faucets above to get testnet USDC and ETH for testing.
          </p>
        </div>
      </div>
    </div>
  );
}
