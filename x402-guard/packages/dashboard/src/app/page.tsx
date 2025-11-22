"use client";

import { useState } from "react";

// Mock data for demo
const mockGuardData = {
  address: "0x1234567890123456789012345678901234567890",
  balance: "87.50",
  dailySpent: "12.50",
  dailyLimit: "50.00",
  maxPerTransaction: "5.00",
  approvalThreshold: "2.00",
  remainingBudget: "37.50",
  timeUntilReset: "11h 42m",
};

const mockTransactions = [
  { id: 1, amount: "0.10", endpoint: "weather.api/forecast", status: "success", time: "2 min ago" },
  { id: 2, amount: "0.50", endpoint: "api.openai.com/v1/chat", status: "success", time: "5 min ago" },
  { id: 3, amount: "0.25", endpoint: "news.api/headlines", status: "success", time: "12 min ago" },
  { id: 4, amount: "10.00", endpoint: "sketchy.api/data", status: "blocked", time: "15 min ago" },
  { id: 5, amount: "0.15", endpoint: "weather.api/forecast", status: "success", time: "1 hour ago" },
];

const mockPendingApprovals = [
  { id: 1, amount: "3.00", endpoint: "api.openai.com/v1/chat", requestedAt: "2 min ago" },
];

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

export default function Home() {
  const [activeTab, setActiveTab] = useState<"overview" | "policies" | "endpoints">("overview");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://guard.x402.io/${mockGuardData.address}/`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const spendingPercentage = (parseFloat(mockGuardData.dailySpent) / parseFloat(mockGuardData.dailyLimit)) * 100;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Guard Wallet</h1>
            <p className="mt-1.5 font-mono text-sm text-fg-muted truncate max-w-[300px] sm:max-w-none">
              {mockGuardData.address}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium text-fg-muted uppercase tracking-wider">Balance</p>
            <p className="text-3xl font-semibold tracking-tight mt-1">
              ${mockGuardData.balance}
              <span className="text-base font-medium text-fg-muted ml-1">USDC</span>
            </p>
          </div>
        </div>
      </div>

      {/* Daily Spending Progress */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Today&apos;s Spending</h2>
          <span className="text-sm text-fg-muted">
            Resets in {mockGuardData.timeUntilReset}
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
          <span className="text-fg-secondary">${mockGuardData.dailySpent} spent</span>
          <span className="text-fg-muted">
            ${mockGuardData.remainingBudget} remaining of ${mockGuardData.dailyLimit}
          </span>
        </div>
      </div>

      {/* Pending Approvals */}
      {mockPendingApprovals.length > 0 && (
        <div className="card border-warning/30 bg-warning-muted/30 p-6 animate-slide-up">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-2 h-2 rounded-full bg-warning animate-pulse-glow" />
            <h2 className="font-semibold text-warning">
              Pending Approval{mockPendingApprovals.length > 1 ? 's' : ''} ({mockPendingApprovals.length})
            </h2>
          </div>
          
          {mockPendingApprovals.map((approval) => (
            <div 
              key={approval.id} 
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-bg-secondary rounded-xl border border-border"
            >
              <div>
                <p className="text-lg font-semibold">${approval.amount} USDC</p>
                <p className="font-mono text-sm text-fg-secondary mt-0.5">{approval.endpoint}</p>
                <p className="text-xs text-fg-muted mt-1">Requested {approval.requestedAt}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-success flex items-center gap-1.5">
                  <CheckIcon />
                  Approve
                </button>
                <button className="btn-danger flex items-center gap-1.5">
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
          
          <div className="divide-y divide-border/50">
            {mockTransactions.map((tx) => (
              <div 
                key={tx.id} 
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
                    <p className="text-xs text-fg-muted mt-0.5">{tx.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p 
                    className={`text-sm font-semibold
                      ${tx.status === "blocked" ? 'text-error line-through' : ''}`}
                  >
                    ${tx.amount}
                  </p>
                  {tx.status === "blocked" && (
                    <span className="badge-error text-[10px]">Over limit</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "policies" && (
        <div className="card p-6 space-y-6 animate-fade-in">
          <h2 className="font-semibold">Spending Policies</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Max Per Transaction", value: mockGuardData.maxPerTransaction },
              { label: "Daily Limit", value: mockGuardData.dailyLimit },
              { label: "Require Approval Above", value: mockGuardData.approvalThreshold }
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-sm font-medium text-fg-secondary mb-2">
                  {field.label}
                </label>
                <div className="flex">
                  <span className="px-3.5 py-2.5 bg-bg-elevated border border-border border-r-0 rounded-l-lg text-fg-muted text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    defaultValue={field.value}
                    className="input rounded-l-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <button className="btn-primary">
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
                className="w-4 h-4 rounded bg-bg-tertiary border-border accent-accent"
              />
              <span className="text-sm text-fg-muted group-hover:text-fg-secondary transition-colors">
                Allow all endpoints
              </span>
            </label>
          </div>
          
          <div className="space-y-2">
            {["api.openai.com", "api.anthropic.com", "weather.api", "news.api"].map((endpoint) => (
              <div 
                key={endpoint} 
                className="flex items-center justify-between p-4 bg-bg-tertiary rounded-xl border border-border/50 group hover:border-border transition-colors"
              >
                <span className="font-mono text-sm">{endpoint}/*</span>
                <button className="text-sm font-medium text-error opacity-0 group-hover:opacity-100 transition-opacity">
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              placeholder="api.example.com"
              className="input flex-1"
            />
            <button className="btn-primary whitespace-nowrap">
              Add Endpoint
            </button>
          </div>
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
            https://guard.x402.io/{mockGuardData.address}/
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
            https://guard.x402.io/{mockGuardData.address.slice(0, 10)}.../<span className="text-accent">api.openai.com</span>/v1/chat
          </code>
        </p>
      </div>
    </div>
  );
}