"use client";

import { useState, useEffect } from "react";
import { Address } from "viem";
import { useWeb3 } from "./providers";
import { useGuard, useUserGuards, useCreateGuard, Transaction } from "./hooks";


// Icons
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// Helper to format time ago
function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Not connected view
function NotConnectedView() {
  const { connect, isConnecting } = useWeb3();

  return (
    <div className="card p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-blue-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-accent/20">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <h2 className="text-2xl font-semibold mb-3">Welcome to x402-Guard</h2>
      <p className="text-fg-secondary mb-8 max-w-md mx-auto">
        Connect your wallet to manage your AI agent payment guards and set spending policies.
      </p>
      <button 
        onClick={connect}
        disabled={isConnecting}
        className="btn-primary text-base px-8 py-3"
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
    </div>
  );
}

// No guards view - prompt to create
function NoGuardsView() {
  const { createGuard, isCreating, error } = useCreateGuard();
  const { address, chainId, isSupported } = useWeb3();
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    agent: "",
    maxPerTransaction: "5",
    dailyLimit: "50",
    approvalThreshold: "2",
  });

  const handleCreate = async () => {
    const guardAddress = await createGuard(
      formData.agent as Address,
      formData.maxPerTransaction,
      formData.dailyLimit,
      formData.approvalThreshold
    );
    if (guardAddress) {
      window.location.reload();
    }
  };

  // Show chain warning if not on supported network
  if (!isSupported && chainId) {
    return (
      <div className="card p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-warning-muted flex items-center justify-center mx-auto mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold mb-3 text-warning">Wrong Network</h2>
        <p className="text-fg-secondary mb-4">
          You&apos;re connected to chain ID: <code className="bg-bg-elevated px-2 py-1 rounded">{chainId}</code>
        </p>
        <p className="text-fg-muted mb-8 max-w-md mx-auto">
          Please switch to Base Sepolia (84532) in your wallet to use x402-Guard.
        </p>
        <div className="text-sm text-fg-muted">
          <p>Supported networks:</p>
          <p className="font-mono mt-2">Base Sepolia (84532) • Hardhat (31337)</p>
        </div>
      </div>
    );
  }

  if (!showCreate) {
    return (
      <div className="card p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-bg-elevated flex items-center justify-center mx-auto mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fg-muted">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold mb-3">No Guards Yet</h2>
        <p className="text-fg-secondary mb-4 max-w-md mx-auto">
          Create your first Guard wallet to start protecting your AI agent payments with spending limits and endpoint controls.
        </p>
        {chainId && (
          <p className="text-xs text-fg-muted mb-8">
            Connected to chain: {chainId === 84532 ? "Base Sepolia" : chainId === 31337 ? "Hardhat" : chainId}
          </p>
        )}
        <button 
          onClick={() => setShowCreate(true)}
          className="btn-primary text-base px-8 py-3"
        >
          Create Guard
        </button>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-6 animate-fade-in">
      <h2 className="text-xl font-semibold">Create New Guard</h2>
      
      {error && (
        <div className="p-4 bg-error-muted rounded-lg text-error text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-2">
            Agent Address
          </label>
          <input
            type="text"
            placeholder="0x..."
            value={formData.agent}
            onChange={(e) => setFormData({ ...formData, agent: e.target.value })}
            className="input w-full font-mono"
          />
          <p className="text-xs text-fg-muted mt-1.5">
            The address authorized to execute payments (your AI agent)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-2">
              Max Per Transaction
            </label>
            <div className="flex">
              <span className="px-3.5 py-2.5 bg-bg-elevated border border-border border-r-0 rounded-l-lg text-fg-muted text-sm">
                $
              </span>
              <input
                type="number"
                value={formData.maxPerTransaction}
                onChange={(e) => setFormData({ ...formData, maxPerTransaction: e.target.value })}
                className="input rounded-l-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-2">
              Daily Limit
            </label>
            <div className="flex">
              <span className="px-3.5 py-2.5 bg-bg-elevated border border-border border-r-0 rounded-l-lg text-fg-muted text-sm">
                $
              </span>
              <input
                type="number"
                value={formData.dailyLimit}
                onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value })}
                className="input rounded-l-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-2">
              Approval Threshold
            </label>
            <div className="flex">
              <span className="px-3.5 py-2.5 bg-bg-elevated border border-border border-r-0 rounded-l-lg text-fg-muted text-sm">
                $
              </span>
              <input
                type="number"
                value={formData.approvalThreshold}
                onChange={(e) => setFormData({ ...formData, approvalThreshold: e.target.value })}
                className="input rounded-l-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button 
          onClick={() => setShowCreate(false)}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button 
          onClick={handleCreate}
          disabled={isCreating || !formData.agent}
          className="btn-primary flex items-center gap-2"
        >
          {isCreating && <LoadingSpinner />}
          {isCreating ? "Creating..." : "Create Guard"}
        </button>
      </div>
    </div>
  );
}

// Guard selector for users with multiple guards
function GuardSelector({ 
  guards, 
  selected, 
  onSelect 
}: { 
  guards: Address[]; 
  selected: Address | null; 
  onSelect: (addr: Address) => void;
}) {
  if (guards.length <= 1) return null;

  return (
    <div className="card p-4 mb-6">
      <label className="block text-sm font-medium text-fg-secondary mb-2">
        Select Guard
      </label>
      <select 
        value={selected || ""}
        onChange={(e) => onSelect(e.target.value as Address)}
        className="input w-full"
      >
        {guards.map((guard) => (
          <option key={guard} value={guard}>
            {guard.slice(0, 10)}...{guard.slice(-8)}
          </option>
        ))}
      </select>
    </div>
  );
}

// Main dashboard component
function GuardDashboard({ guardAddress }: { guardAddress: Address }) {
  const {
    guardData,
    transactions,
    endpoints,
    isLoading,
    error,
    refetch,
    setPolicy,
    addEndpoint,
    removeEndpoint,
    toggleAllowAllEndpoints,
    approvePayment,
    rejectPayment,
    fund,
    withdraw,
  } = useGuard(guardAddress);

  const [activeTab, setActiveTab] = useState<"overview" | "policies" | "endpoints">("overview");
  const [copied, setCopied] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState("");
  const [policyForm, setPolicyForm] = useState({
    maxPerTransaction: "",
    dailyLimit: "",
    approvalThreshold: "",
  });
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false);
  const [isAddingEndpoint, setIsAddingEndpoint] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [isFunding, setIsFunding] = useState(false);

  // Update form when guard data loads
  useEffect(() => {
    if (guardData) {
      setPolicyForm({
        maxPerTransaction: guardData.maxPerTransaction,
        dailyLimit: guardData.dailyLimit,
        approvalThreshold: guardData.approvalThreshold,
      });
    }
  }, [guardData]);

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://guard.x402.io/${guardAddress}/`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdatePolicy = async () => {
    setIsUpdatingPolicy(true);
    try {
      await setPolicy(
        policyForm.maxPerTransaction,
        policyForm.dailyLimit,
        policyForm.approvalThreshold
      );
    } catch (err) {
      console.error("Failed to update policy:", err);
    } finally {
      setIsUpdatingPolicy(false);
    }
  };

  const handleAddEndpoint = async () => {
    if (!newEndpoint) return;
    setIsAddingEndpoint(true);
    try {
      await addEndpoint(newEndpoint);
      setNewEndpoint("");
    } catch (err) {
      console.error("Failed to add endpoint:", err);
    } finally {
      setIsAddingEndpoint(false);
    }
  };

  const handleFund = async () => {
    if (!fundAmount) return;
    setIsFunding(true);
    try {
      await fund(fundAmount);
      setFundAmount("");
    } catch (err) {
      console.error("Failed to fund:", err);
    } finally {
      setIsFunding(false);
    }
  };

  if (isLoading && !guardData) {
    return (
      <div className="card p-12 text-center">
        <LoadingSpinner />
        <p className="text-fg-muted mt-4">Loading guard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-12 text-center">
        <div className="text-error mb-4">Error: {error}</div>
        <button onClick={refetch} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (!guardData) {
    return (
      <div className="card p-12 text-center">
        <p className="text-fg-muted">No guard data available</p>
      </div>
    );
  }

  const spendingPercentage = Math.min(
    (parseFloat(guardData.dailySpent) / parseFloat(guardData.dailyLimit)) * 100,
    100
  );

  // Get pending approvals from transactions (those in "pending" state)
  const pendingApprovals: Transaction[] = []; // TODO: fetch from contract pending payments

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Guard Wallet</h1>
            <p className="mt-1.5 font-mono text-sm text-fg-muted truncate max-w-[300px] sm:max-w-none">
              {guardData.address}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium text-fg-muted uppercase tracking-wider">Balance</p>
            <p className="text-3xl font-semibold tracking-tight mt-1">
              ${parseFloat(guardData.balance).toFixed(2)}
              <span className="text-base font-medium text-fg-muted ml-1">USDC</span>
            </p>
          </div>
        </div>

        {/* Quick fund */}
        <div className="flex gap-3 mt-4 pt-4 border-t border-border">
          <div className="flex flex-1">
            <span className="px-3 py-2 bg-bg-elevated border border-border border-r-0 rounded-l-lg text-fg-muted text-sm">
              $
            </span>
            <input
              type="number"
              placeholder="Amount"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              className="input rounded-l-none flex-1"
            />
          </div>
          <button 
            onClick={handleFund}
            disabled={isFunding || !fundAmount}
            className="btn-primary flex items-center gap-2"
          >
            {isFunding && <LoadingSpinner />}
            Fund
          </button>
        </div>
      </div>

      {/* Daily Spending Progress */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Today&apos;s Spending</h2>
          <span className="text-sm text-fg-muted">
            Resets in {guardData.timeUntilReset}
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="relative h-2 bg-bg-elevated rounded-full overflow-hidden">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-blue-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${spendingPercentage}%` }}
          />
        </div>
        
        <div className="flex justify-between mt-3 text-sm">
          <span className="text-fg-secondary">${parseFloat(guardData.dailySpent).toFixed(2)} spent</span>
          <span className="text-fg-muted">
            ${parseFloat(guardData.remainingBudget).toFixed(2)} remaining of ${parseFloat(guardData.dailyLimit).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="card border-warning/30 bg-warning-muted/30 p-6 animate-slide-up">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-2 h-2 rounded-full bg-warning animate-pulse-glow" />
            <h2 className="font-semibold text-warning">
              Pending Approval{pendingApprovals.length > 1 ? 's' : ''} ({pendingApprovals.length})
            </h2>
          </div>
          
          {pendingApprovals.map((approval, idx) => (
            <div 
              key={idx} 
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-bg-secondary rounded-xl border border-border"
            >
              <div>
                <p className="text-lg font-semibold">${approval.amount} USDC</p>
                <p className="font-mono text-sm text-fg-secondary mt-0.5">{approval.endpoint}</p>
                <p className="text-xs text-fg-muted mt-1">Requested {timeAgo(approval.timestamp)}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => approvePayment(idx)}
                  className="btn-success flex items-center gap-1.5"
                >
                  <CheckIcon />
                  Approve
                </button>
                <button 
                  onClick={() => rejectPayment(idx)}
                  className="btn-danger flex items-center gap-1.5"
                >
                  <XIcon />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-bg-secondary rounded-xl border border-border">
        {(["overview", "policies", "endpoints"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium capitalize transition-all duration-200
              ${activeTab === tab 
                ? 'bg-bg-elevated text-fg-primary shadow-sm' 
                : 'text-fg-muted hover:text-fg-secondary'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="card overflow-hidden animate-fade-in">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold">Recent Transactions</h2>
          </div>
          
          {transactions.length === 0 ? (
            <div className="px-6 py-12 text-center text-fg-muted">
              No transactions yet
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {transactions.map((tx, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between px-6 py-4 hover:bg-bg-tertiary/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className={`w-8 h-8 rounded-full flex items-center justify-center
                        ${tx.status === "success" 
                          ? 'bg-success-muted text-success' 
                          : 'bg-error-muted text-error'
                        }`}
                    >
                      {tx.status === "success" ? <CheckIcon /> : <XIcon />}
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium">{tx.endpoint}</p>
                      <p className="text-xs text-fg-muted mt-0.5">{timeAgo(tx.timestamp)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p 
                      className={`text-sm font-semibold
                        ${tx.status === "blocked" ? 'text-error line-through' : ''}`}
                    >
                      ${tx.amount}
                    </p>
                    {tx.status === "blocked" && tx.blockReason && (
                      <span className="badge-error text-[10px]">{tx.blockReason}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "policies" && (
        <div className="card p-6 space-y-6 animate-fade-in">
          <h2 className="font-semibold">Spending Policies</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Max Per Transaction", key: "maxPerTransaction" as const },
              { label: "Daily Limit", key: "dailyLimit" as const },
              { label: "Require Approval Above", key: "approvalThreshold" as const }
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-fg-secondary mb-2">
                  {field.label}
                </label>
                <div className="flex">
                  <span className="px-3.5 py-2.5 bg-bg-elevated border border-border border-r-0 rounded-l-lg text-fg-muted text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    value={policyForm[field.key]}
                    onChange={(e) => setPolicyForm({ ...policyForm, [field.key]: e.target.value })}
                    className="input rounded-l-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleUpdatePolicy}
            disabled={isUpdatingPolicy}
            className="btn-primary flex items-center gap-2"
          >
            {isUpdatingPolicy && <LoadingSpinner />}
            Update Policies
          </button>
        </div>
      )}

      {activeTab === "endpoints" && (
        <div className="card p-6 space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="font-semibold">Allowed Endpoints</h2>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={guardData.allowAllEndpoints}
                onChange={(e) => toggleAllowAllEndpoints(e.target.checked)}
                className="w-4 h-4 rounded bg-bg-tertiary border-border accent-accent"
              />
              <span className="text-sm text-fg-muted group-hover:text-fg-secondary transition-colors">
                Allow all endpoints
              </span>
            </label>
          </div>
          
          {!guardData.allowAllEndpoints && (
            <>
              <div className="space-y-2">
                {endpoints.length === 0 ? (
                  <p className="text-fg-muted text-sm py-4">No endpoints configured</p>
                ) : (
                  endpoints.map((ep) => (
                    <div 
                      key={ep.endpoint} 
                      className="flex items-center justify-between p-4 bg-bg-tertiary rounded-xl border border-border/50 group hover:border-border transition-colors"
                    >
                      <span className="font-mono text-sm">{ep.endpoint}/*</span>
                      <button 
                        onClick={() => removeEndpoint(ep.endpoint)}
                        className="text-sm font-medium text-error opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="api.example.com"
                  value={newEndpoint}
                  onChange={(e) => setNewEndpoint(e.target.value)}
                  className="input flex-1"
                />
                <button 
                  onClick={handleAddEndpoint}
                  disabled={isAddingEndpoint || !newEndpoint}
                  className="btn-primary whitespace-nowrap flex items-center gap-2"
                >
                  {isAddingEndpoint && <LoadingSpinner />}
                  Add Endpoint
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Proxy URL */}
      <div className="card p-6">
        <h2 className="font-semibold">Your Proxy URL</h2>
        <p className="text-sm text-fg-secondary mt-1.5 leading-relaxed">
          Point your AI agent to this URL to route payments through your Guard wallet
        </p>
        
        <div className="flex gap-3 mt-5">
          <code className="flex-1 px-4 py-3 bg-bg-primary border border-border rounded-lg font-mono text-sm text-success break-all">
            https://guard.x402.io/{guardData.address}/
          </code>
          <button 
            onClick={handleCopy}
            className="btn-secondary flex items-center gap-2 shrink-0"
          >
            <CopyIcon />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        
        <p className="text-sm text-fg-muted mt-4">
          Example:{" "}
          <code className="font-mono text-fg-secondary">
            https://guard.x402.io/{guardData.address.slice(0, 10)}.../<span className="text-accent">api.openai.com</span>/v1/chat
          </code>
        </p>
      </div>
    </div>
  );
}

function DebugChainInfo() {
  const { chainId, address, isConnected, publicClient, walletClient } = useWeb3();
  const [rawChainId, setRawChainId] = useState<string | null>(null);

  useEffect(() => {
    const getDirectChainId = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const hex = await window.ethereum.request({ method: "eth_chainId" });
          setRawChainId(`${hex} (${parseInt(hex, 16)})`);
        } catch (e) {
          setRawChainId("error fetching");
        }
      }
    };
    getDirectChainId();
  }, []);

  return (
    <div className="card p-4 mb-4 bg-yellow-900/20 border-yellow-500/50 text-sm font-mono">
      <p><strong>DEBUG INFO</strong></p>
      <p>Context chainId: {chainId ?? "null"}</p>
      <p>Direct from wallet: {rawChainId ?? "loading..."}</p>
      <p>Address: {address ?? "null"}</p>
      <p>isConnected: {String(isConnected)}</p>
      <p>publicClient: {publicClient ? "✓" : "✗"}</p>
      <p>walletClient: {walletClient ? "✓" : "✗"}</p>
    </div>
  );
}

// Main page component
export default function Home() {
  const { isConnected, address } = useWeb3();
  const { guards, isLoading: isLoadingGuards } = useUserGuards();
  const [selectedGuard, setSelectedGuard] = useState<Address | null>(null);

  // Auto-select first guard when loaded
  useEffect(() => {
    if (guards.length > 0 && !selectedGuard) {
      setSelectedGuard(guards[0]);
    }
  }, [guards, selectedGuard]);

  if (!isConnected) {
    return <NotConnectedView />;
  }

  if (isLoadingGuards) {
    return (
      <div className="card p-12 text-center">
        <LoadingSpinner />
        <p className="text-fg-muted mt-4">Loading your guards...</p>
      </div>
    );
  }

  if (guards.length === 0) {
    return <NoGuardsView />;
  }

  return (
    <>
      <DebugChainInfo /> 
      <GuardSelector 
        guards={guards} 
        selected={selectedGuard} 
        onSelect={setSelectedGuard} 
      />
      {selectedGuard && <GuardDashboard guardAddress={selectedGuard} />}
    </>
  );
}