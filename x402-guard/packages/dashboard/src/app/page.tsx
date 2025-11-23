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

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
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
    <div className="max-w-3xl mx-auto">
      <div className="card p-12 text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-blue-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-accent/20">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <h1 className="text-3xl font-bold mb-4">Welcome to x402 Guard</h1>
        <p className="text-lg text-fg-secondary mb-2">
          Protect your AI agent&apos;s spending with smart payment controls
        </p>
        <p className="text-fg-muted mb-8 max-w-xl mx-auto">
          Set spending limits, whitelist endpoints, and require approvals for large payments - 
          all before your AI agent can spend a single dollar.
        </p>
        <button 
          onClick={connect}
          disabled={isConnecting}
          className="btn-primary text-lg px-10 py-4 mx-auto"
        >
          {isConnecting ? "Connecting..." : "Connect Wallet to Get Started"}
        </button>
        
        <div className="mt-12 grid grid-cols-3 gap-6 text-left">
          <div className="p-4 bg-bg-elevated rounded-lg">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h3 className="font-semibold mb-1">Set Limits</h3>
            <p className="text-sm text-fg-muted">Control daily spending and max transaction amounts</p>
          </div>
          
          <div className="p-4 bg-bg-elevated rounded-lg">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">Whitelist APIs</h3>
            <p className="text-sm text-fg-muted">Only allow approved API endpoints</p>
          </div>
          
          <div className="p-4 bg-bg-elevated rounded-lg">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">Review First</h3>
            <p className="text-sm text-fg-muted">Require approval for large payments</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Setup wizard for creating a guard
function GuardSetupWizard() {
  const { createGuard, isCreating, error } = useCreateGuard();
  const { address } = useWeb3();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    agent: address || "",
    maxPerTransaction: "10",
    dailyLimit: "100",
    approvalThreshold: "50",
  });

  useEffect(() => {
    if (address && !formData.agent) {
      setFormData(prev => ({ ...prev, agent: address }));
    }
  }, [address, formData.agent]);

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

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step >= s ? 'bg-accent text-white' : 'bg-bg-elevated text-fg-muted'
              }`}>
                {s}
              </div>
              {s < 3 && (
                <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-accent' : 'bg-bg-elevated'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm">
          <span className={step >= 1 ? 'text-fg-primary font-medium' : 'text-fg-muted'}>What is a Guard?</span>
          <span className={step >= 2 ? 'text-fg-primary font-medium' : 'text-fg-muted'}>Set Limits</span>
          <span className={step >= 3 ? 'text-fg-primary font-medium' : 'text-fg-muted'}>Review & Create</span>
        </div>
      </div>

      <div className="card p-8">
        {error && (
          <div className="p-4 bg-error-muted rounded-lg text-error text-sm mb-6">
            {error}
          </div>
        )}

        {/* Step 1: Explanation */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold mb-4">What is a Guard Wallet?</h2>
              <p className="text-lg text-fg-secondary mb-6">
                A Guard is a smart wallet that protects your AI agent&apos;s spending. Think of it as a bouncer for your money.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-bg-elevated rounded-lg">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Without a Guard</h3>
                  <p className="text-sm text-fg-muted">
                    Your AI agent has direct access to your wallet. It could spend $1,000 on API calls by mistake, 
                    call unauthorized endpoints, or drain your funds if compromised.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-accent/5 border-2 border-accent/20 rounded-lg">
                <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                  <CheckIcon />
                  <span className="sr-only">Check</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">With a Guard</h3>
                  <p className="text-sm text-fg-secondary">
                    The Guard enforces spending limits ($10/transaction, $100/day), only allows whitelisted APIs, 
                    and requires your approval for large payments. Your agent can&apos;t overspend even if it wants to.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
              <div className="flex gap-3">
                <InfoIcon />
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">How it works</p>
                  <p className="text-sm text-fg-muted">
                    You&apos;ll fund the Guard wallet with USDC. When your AI agent needs to call an API, 
                    it requests payment from the Guard. The Guard checks if the request is allowed, 
                    then either approves or blocks it based on your rules.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                onClick={() => setStep(2)}
                className="btn-primary px-8"
              >
                Got it! Set Up My Guard →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Set Limits */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold mb-2">Set Spending Limits</h2>
              <p className="text-fg-secondary">
                These limits protect you from unexpected costs. You can change them anytime.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-2">
                  Maximum Per Transaction
                </label>
                <div className="flex items-start gap-4">
                  <div className="flex flex-1">
                    <span className="px-4 py-3 bg-bg-elevated border border-border border-r-0 rounded-l-lg text-fg-muted">
                      $
                    </span>
                    <input
                      type="number"
                      value={formData.maxPerTransaction}
                      onChange={(e) => setFormData({ ...formData, maxPerTransaction: e.target.value })}
                      className="input rounded-l-none flex-1 text-lg"
                    />
                  </div>
                </div>
                <p className="text-sm text-fg-muted mt-2">
                  💡 <strong>Recommended: $5-10</strong> - Most API calls cost $0.01-1.00
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-2">
                  Daily Spending Limit
                </label>
                <div className="flex items-start gap-4">
                  <div className="flex flex-1">
                    <span className="px-4 py-3 bg-bg-elevated border border-border border-r-0 rounded-l-lg text-fg-muted">
                      $
                    </span>
                    <input
                      type="number"
                      value={formData.dailyLimit}
                      onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value })}
                      className="input rounded-l-none flex-1 text-lg"
                    />
                  </div>
                </div>
                <p className="text-sm text-fg-muted mt-2">
                  💡 <strong>Recommended: $50-100</strong> - Resets every 24 hours at midnight
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-2">
                  Approval Required Above
                </label>
                <div className="flex items-start gap-4">
                  <div className="flex flex-1">
                    <span className="px-4 py-3 bg-bg-elevated border border-border border-r-0 rounded-l-lg text-fg-muted">
                      $
                    </span>
                    <input
                      type="number"
                      value={formData.approvalThreshold}
                      onChange={(e) => setFormData({ ...formData, approvalThreshold: e.target.value })}
                      className="input rounded-l-none flex-1 text-lg"
                    />
                  </div>
                </div>
                <p className="text-sm text-fg-muted mt-2">
                  💡 <strong>Recommended: $5-20</strong> - You&apos;ll approve expensive calls manually
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setStep(1)}
                className="btn-secondary"
              >
                ← Back
              </button>
              <button 
                onClick={() => setStep(3)}
                className="btn-primary flex-1"
              >
                Continue to Review →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Create */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold mb-2">Review Your Guard Setup</h2>
              <p className="text-fg-secondary">
                Double-check everything looks good, then create your Guard wallet.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between p-4 bg-bg-elevated rounded-lg">
                <span className="text-fg-muted">AI Agent Address</span>
                <span className="font-mono text-sm">{formData.agent.slice(0, 10)}...{formData.agent.slice(-8)}</span>
              </div>
              <div className="flex justify-between p-4 bg-bg-elevated rounded-lg">
                <span className="text-fg-muted">Max Per Transaction</span>
                <span className="font-semibold">${formData.maxPerTransaction}</span>
              </div>
              <div className="flex justify-between p-4 bg-bg-elevated rounded-lg">
                <span className="text-fg-muted">Daily Limit</span>
                <span className="font-semibold">${formData.dailyLimit}</span>
              </div>
              <div className="flex justify-between p-4 bg-bg-elevated rounded-lg">
                <span className="text-fg-muted">Approval Threshold</span>
                <span className="font-semibold">${formData.approvalThreshold}</span>
              </div>
            </div>

            <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
              <p className="font-semibold text-sm mb-2">✅ What happens next:</p>
              <ol className="text-sm text-fg-secondary space-y-1 list-decimal list-inside">
                <li>We&apos;ll create your Guard wallet</li>
                <li>You&apos;ll fund it with USDC (next step)</li>
                <li>You can whitelist API endpoints your agent can call</li>
                <li>Your AI agent will request payments from the Guard</li>
                <li>The Guard enforces your limits automatically</li>
              </ol>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setStep(2)}
                className="btn-secondary"
              >
                ← Back
              </button>
              <button 
                onClick={handleCreate}
                disabled={isCreating}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {isCreating && <LoadingSpinner />}
                {isCreating ? "Creating Your Guard..." : "Create My Guard Wallet"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Test Payment Component
interface Endpoint {
  endpoint: string;
  addedAt: number;
}

function TestPaymentSection({ guardAddress, endpoints }: { 
  guardAddress: Address;
  endpoints: Endpoint[];
}) {
  const [selectedEndpoint, setSelectedEndpoint] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  const handleTest = async () => {
    let targetUrl = customUrl || selectedEndpoint;
    if (!targetUrl) return;

    // Clean up the URL - remove any double https:// prefixes
    targetUrl = targetUrl.replace(/^https?:\/\/https?:\/\//, 'https://');
    
    // Ensure it has a protocol
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    console.log("[Test] Navigating to E2E proxy for:", targetUrl);
    
    // Navigate to the E2E proxy - it will handle the full x402 payment flow
    const proxyUrl = `/api/x402-proxy/e2e?target=${encodeURIComponent(targetUrl)}`;
    window.location.href = proxyUrl;
  };

  return (
    <div className="card p-6 border-2 border-accent/30">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-2">Test Guard Payment</h2>
          <p className="text-fg-secondary text-sm">
            Try calling one of your whitelisted endpoints. You'll be taken to the payment page, 
            and after payment, the Guard will automatically bridge USDC and call the API.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Quick Select */}
        <div>
          <label className="block text-sm font-medium mb-2">Quick Select Endpoint</label>
          <select 
            value={selectedEndpoint}
            onChange={(e) => {
              setSelectedEndpoint(e.target.value);
              setCustomUrl("");
            }}
            className="input w-full"
          >
            <option value="">Choose a whitelisted endpoint...</option>
            {endpoints.map((ep) => (
              <option key={ep.endpoint} value={ep.endpoint}>
                {ep.endpoint}
              </option>
            ))}
          </select>
        </div>

        {/* Or Custom URL */}
        <div>
          <label className="block text-sm font-medium mb-2">Or Enter Full URL</label>
          <input
            type="text"
            placeholder="https://coinapi.dev/api/price/bitcoin/2024-01-01"
            value={customUrl}
            onChange={(e) => {
              setCustomUrl(e.target.value);
              setSelectedEndpoint("");
            }}
            className="input w-full font-mono text-sm"
          />
          <p className="text-xs text-fg-muted mt-1">
            Example x402 endpoint: <code className="bg-bg-tertiary px-1 py-0.5 rounded">https://coinapi.dev/api/price/bitcoin/2024-01-01</code>
          </p>
        </div>

        {/* Test Button */}
        <button 
          onClick={handleTest}
          disabled={!selectedEndpoint && !customUrl}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          Make Payment & Call API
        </button>

        {/* Info Box */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 text-sm">
          <p className="font-semibold mb-2">ℹ️ How this works:</p>
          <ol className="text-fg-secondary space-y-1 list-decimal list-inside text-xs">
            <li>Click "Make Payment & Call API"</li>
            <li>You'll see the x402 payment interface</li>
            <li>Complete the payment (your wallet will prompt you)</li>
            <li>E2E proxy detects the target chain (e.g., Polygon)</li>
            <li>Bridges USDC from Base → Target chain (~5-10 min)</li>
            <li>Makes payment to the API with x402</li>
            <li>You'll see the API response as JSON</li>
          </ol>
          <p className="text-fg-muted text-xs mt-2">
            <strong>Note:</strong> The bridging process happens after payment and can take several minutes.
          </p>
        </div>
      </div>
    </div>
  );
}

// Main dashboard - simplified and clearer
function GuardDashboard({ guardAddress }: { guardAddress: Address }) {
  const {
    guardData,
    transactions,
    endpoints,
    isLoading,
    error,
    refetch,
    fund,
    addEndpoint,
    removeEndpoint,
    setPolicy,
  } = useGuard(guardAddress);

  const [fundAmount, setFundAmount] = useState("");
  const [isFunding, setIsFunding] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState("");
  const [isAddingEndpoint, setIsAddingEndpoint] = useState(false);

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

  if (isLoading && !guardData) {
    return (
      <div className="card p-12 text-center">
        <LoadingSpinner />
        <p className="text-fg-muted mt-4">Loading your Guard...</p>
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
    return null;
  }

  const needsFunding = parseFloat(guardData.balance) === 0;
  const spendingPercentage = Math.min(
    (parseFloat(guardData.dailySpent) / parseFloat(guardData.dailyLimit)) * 100,
    100
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Status Banner */}
      {needsFunding && (
        <div className="card p-6 bg-warning-muted/20 border-2 border-warning">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">⚠️ Your Guard needs funding</h3>
              <p className="text-fg-secondary mb-4">
                Add USDC to your Guard wallet so it can pay for API calls on your AI agent&apos;s behalf.
              </p>
              <div className="flex gap-3">
                <div className="flex flex-1 max-w-xs">
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
                  Fund Guard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guard Overview */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Your Guard Wallet</h1>
            <p className="text-sm text-fg-muted mt-1 font-mono">{guardAddress}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-fg-muted">Current Balance</p>
            <p className="text-3xl font-bold">
              ${parseFloat(guardData.balance).toFixed(2)}
              <span className="text-lg text-fg-muted ml-1">USDC</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-bg-elevated rounded-lg">
            <p className="text-xs text-fg-muted mb-1">Max Per Transaction</p>
            <p className="text-xl font-semibold">${guardData.maxPerTransaction}</p>
          </div>
          <div className="p-4 bg-bg-elevated rounded-lg">
            <p className="text-xs text-fg-muted mb-1">Daily Limit</p>
            <p className="text-xl font-semibold">${guardData.dailyLimit}</p>
          </div>
          <div className="p-4 bg-bg-elevated rounded-lg">
            <p className="text-xs text-fg-muted mb-1">Spent Today</p>
            <p className="text-xl font-semibold">${guardData.dailySpent}</p>
          </div>
        </div>

        {/* Spending Progress */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Daily Spending</p>
            <p className="text-sm text-fg-muted">Resets in {guardData.timeUntilReset}</p>
          </div>
          <div className="relative h-3 bg-bg-elevated rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-blue-400 rounded-full transition-all"
              style={{ width: `${spendingPercentage}%` }}
            />
          </div>
          <p className="text-xs text-fg-muted mt-1">
            ${guardData.remainingBudget} remaining of ${guardData.dailyLimit}
          </p>
        </div>
      </div>

      {/* Whitelist Endpoints */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-2">Whitelisted API Endpoints</h2>
        <p className="text-fg-secondary text-sm mb-6">
          Only these APIs can receive payments from your Guard. Add endpoints your AI agent needs to call.
        </p>

        <div className="p-4 bg-bg-elevated rounded-lg mb-4">
          <label className="block text-sm font-medium mb-2">Add New Endpoint</label>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="api.openai.com"
              value={newEndpoint}
              onChange={(e) => setNewEndpoint(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newEndpoint) {
                  handleAddEndpoint();
                }
              }}
              className="input flex-1"
            />
            <button 
              onClick={handleAddEndpoint}
              disabled={isAddingEndpoint || !newEndpoint}
              className="btn-primary flex items-center gap-2"
            >
              {isAddingEndpoint && <LoadingSpinner />}
              Add
            </button>
          </div>
          <p className="text-xs text-fg-muted mt-2">
            Example: <code className="bg-bg-tertiary px-1 py-0.5 rounded">api.openai.com</code>, <code className="bg-bg-tertiary px-1 py-0.5 rounded">api.anthropic.com</code>
          </p>
        </div>

        {endpoints.length === 0 ? (
          <div className="text-center py-8 bg-bg-elevated rounded-lg border border-dashed border-border">
            <p className="text-fg-muted">No endpoints whitelisted yet</p>
            <p className="text-sm text-fg-muted mt-1">Add your first endpoint above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {endpoints.map((ep) => (
              <div key={ep.endpoint} className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckIcon />
                  <span className="font-mono text-sm">{ep.endpoint}</span>
                </div>
                <button 
                  onClick={() => removeEndpoint(ep.endpoint)}
                  className="text-sm text-error hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Payment to Whitelisted Endpoint */}
      {endpoints.length > 0 && (
        <TestPaymentSection guardAddress={guardAddress} endpoints={endpoints} />
      )}

      {/* Recent Activity */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-fg-muted">
            No transactions yet. Once your AI agent makes API calls, they&apos;ll appear here.
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    tx.status === "success" ? 'bg-success-muted text-success' : 'bg-error-muted text-error'
                  }`}>
                    {tx.status === "success" ? <CheckIcon /> : <XIcon />}
                  </div>
                  <div>
                    <p className="font-medium">{tx.endpoint}</p>
                    <p className="text-sm text-fg-muted">{timeAgo(tx.timestamp)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${tx.amount}</p>
                  {tx.status === "blocked" && tx.blockReason && (
                    <p className="text-xs text-error">{tx.blockReason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Main page component
export default function Home() {
  const { isConnected } = useWeb3();
  const { guards, isLoading } = useUserGuards();

  if (!isConnected) {
    return <NotConnectedView />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (guards.length === 0) {
    return <GuardSetupWizard />;
  }

  return <GuardDashboard guardAddress={guards[0]} />;
}