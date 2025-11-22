"use client";

import { useState } from "react";

// Mock data for demo - in real app, this would come from contract reads
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

export default function Home() {
  const [activeTab, setActiveTab] = useState<"overview" | "policies" | "endpoints">("overview");

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-white">
      {/* CSS Variables for Coinbase Design System */}
      <style jsx global>{`
        :root {
          /* Coinbase Design System Colors */
          --cds-bg-primary: #0A0B0D;
          --cds-bg-secondary: #131416;
          --cds-bg-tertiary: #1E2025;
          --cds-bg-alternate: #252830;
          
          --cds-fg-primary: #FFFFFF;
          --cds-fg-secondary: #8A919E;
          --cds-fg-muted: #5B616E;
          
          --cds-accent-primary: #0052FF;
          --cds-accent-primary-hover: #0045D9;
          
          --cds-positive: #0E9F6E;
          --cds-positive-bg: rgba(14, 159, 110, 0.12);
          --cds-negative: #DC2626;
          --cds-negative-bg: rgba(220, 38, 38, 0.12);
          --cds-warning: #F59E0B;
          --cds-warning-bg: rgba(245, 158, 11, 0.12);
          
          --cds-line-primary: #252830;
          --cds-line-secondary: #1E2025;
          
          --cds-radius-sm: 8px;
          --cds-radius-md: 12px;
          --cds-radius-lg: 16px;
          --cds-radius-full: 9999px;
        }
        
        * {
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}</style>
      
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-white">
              Guard Wallet
            </h1>
            <p 
              className="mt-2 font-mono text-[13px] tracking-wide"
              style={{ color: 'var(--cds-fg-muted)' }}
            >
              {mockGuardData.address}
            </p>
          </div>
          <div className="text-right">
            <p 
              className="text-[13px] font-medium uppercase tracking-wider"
              style={{ color: 'var(--cds-fg-secondary)' }}
            >
              Balance
            </p>
            <p className="text-[32px] font-semibold tracking-tight mt-1">
              ${mockGuardData.balance}
              <span 
                className="text-[16px] font-medium ml-1"
                style={{ color: 'var(--cds-fg-secondary)' }}
              >
                USDC
              </span>
            </p>
          </div>
        </header>

        {/* Daily Spending Progress */}
        <section 
          className="p-6 rounded-2xl"
          style={{ backgroundColor: 'var(--cds-bg-secondary)', border: '1px solid var(--cds-line-primary)' }}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[16px] font-semibold">Today&apos;s Spending</h2>
            <span 
              className="text-[13px] font-medium"
              style={{ color: 'var(--cds-fg-secondary)' }}
            >
              Resets in {mockGuardData.timeUntilReset}
            </span>
          </div>
          
          <div 
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--cds-bg-alternate)' }}
          >
            <div 
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ 
                width: `${(parseFloat(mockGuardData.dailySpent) / parseFloat(mockGuardData.dailyLimit)) * 100}%`,
                backgroundColor: 'var(--cds-accent-primary)'
              }}
            />
          </div>
          
          <div className="flex justify-between mt-3">
            <span 
              className="text-[13px] font-medium"
              style={{ color: 'var(--cds-fg-secondary)' }}
            >
              ${mockGuardData.dailySpent} spent
            </span>
            <span 
              className="text-[13px] font-medium"
              style={{ color: 'var(--cds-fg-secondary)' }}
            >
              ${mockGuardData.remainingBudget} remaining of ${mockGuardData.dailyLimit}
            </span>
          </div>
        </section>

        {/* Pending Approvals */}
        {mockPendingApprovals.length > 0 && (
          <section 
            className="p-6 rounded-2xl"
            style={{ 
              backgroundColor: 'var(--cds-warning-bg)', 
              border: '1px solid rgba(245, 158, 11, 0.24)' 
            }}
          >
            <div className="flex items-center gap-2 mb-5">
              <div 
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--cds-warning)' }}
              />
              <h2 
                className="text-[16px] font-semibold"
                style={{ color: 'var(--cds-warning)' }}
              >
                Pending Approvals ({mockPendingApprovals.length})
              </h2>
            </div>
            
            {mockPendingApprovals.map((approval) => (
              <div 
                key={approval.id} 
                className="flex justify-between items-center p-4 rounded-xl"
                style={{ backgroundColor: 'var(--cds-bg-secondary)' }}
              >
                <div>
                  <p className="text-[16px] font-semibold">${approval.amount} USDC</p>
                  <p 
                    className="font-mono text-[13px] mt-1"
                    style={{ color: 'var(--cds-fg-secondary)' }}
                  >
                    {approval.endpoint}
                  </p>
                  <p 
                    className="text-[12px] mt-1"
                    style={{ color: 'var(--cds-fg-muted)' }}
                  >
                    Requested {approval.requestedAt}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    className="px-4 py-2.5 rounded-lg text-[14px] font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                    style={{ backgroundColor: 'var(--cds-positive)', color: 'white' }}
                  >
                    Approve
                  </button>
                  <button 
                    className="px-4 py-2.5 rounded-lg text-[14px] font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                    style={{ backgroundColor: 'var(--cds-negative)', color: 'white' }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Tabs */}
        <nav 
          className="flex gap-1 p-1 rounded-xl"
          style={{ backgroundColor: 'var(--cds-bg-secondary)' }}
        >
          {(["overview", "policies", "endpoints"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2.5 px-4 rounded-lg text-[14px] font-semibold capitalize transition-all duration-150"
              style={{ 
                backgroundColor: activeTab === tab ? 'var(--cds-bg-tertiary)' : 'transparent',
                color: activeTab === tab ? 'var(--cds-fg-primary)' : 'var(--cds-fg-secondary)'
              }}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <section 
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--cds-bg-secondary)', border: '1px solid var(--cds-line-primary)' }}
          >
            <div className="p-6 pb-4">
              <h2 className="text-[16px] font-semibold">Recent Transactions</h2>
            </div>
            
            <div>
              {mockTransactions.map((tx, index) => (
                <div 
                  key={tx.id} 
                  className="flex justify-between items-center px-6 py-4 transition-colors duration-150 hover:bg-[#1a1b1f]"
                  style={{ 
                    borderTop: index > 0 ? '1px solid var(--cds-line-secondary)' : 'none'
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[14px]"
                      style={{ 
                        backgroundColor: tx.status === "success" ? 'var(--cds-positive-bg)' : 'var(--cds-negative-bg)',
                        color: tx.status === "success" ? 'var(--cds-positive)' : 'var(--cds-negative)'
                      }}
                    >
                      {tx.status === "success" ? "✓" : "✕"}
                    </div>
                    <div>
                      <p className="font-mono text-[14px] font-medium">{tx.endpoint}</p>
                      <p 
                        className="text-[12px] mt-0.5"
                        style={{ color: 'var(--cds-fg-muted)' }}
                      >
                        {tx.time}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p 
                      className="text-[14px] font-semibold"
                      style={{ 
                        color: tx.status === "blocked" ? 'var(--cds-negative)' : 'var(--cds-fg-primary)',
                        textDecoration: tx.status === "blocked" ? 'line-through' : 'none'
                      }}
                    >
                      ${tx.amount}
                    </p>
                    {tx.status === "blocked" && (
                      <p 
                        className="text-[11px] font-medium mt-0.5"
                        style={{ color: 'var(--cds-negative)' }}
                      >
                        Over limit
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "policies" && (
          <section 
            className="p-6 rounded-2xl space-y-6"
            style={{ backgroundColor: 'var(--cds-bg-secondary)', border: '1px solid var(--cds-line-primary)' }}
          >
            <h2 className="text-[16px] font-semibold">Spending Policies</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { label: "Max Per Transaction", value: mockGuardData.maxPerTransaction },
                { label: "Daily Limit", value: mockGuardData.dailyLimit },
                { label: "Require Approval Above", value: mockGuardData.approvalThreshold }
              ].map((field) => (
                <div key={field.label}>
                  <label 
                    className="block text-[13px] font-medium mb-2"
                    style={{ color: 'var(--cds-fg-secondary)' }}
                  >
                    {field.label}
                  </label>
                  <div className="flex">
                    <span 
                      className="px-4 py-3 rounded-l-lg text-[14px] font-medium"
                      style={{ backgroundColor: 'var(--cds-bg-alternate)', color: 'var(--cds-fg-muted)' }}
                    >
                      $
                    </span>
                    <input
                      type="number"
                      defaultValue={field.value}
                      className="w-full px-4 py-3 rounded-r-lg text-[14px] font-medium outline-none transition-all duration-150 focus:ring-2"
                      style={{ 
                        backgroundColor: 'var(--cds-bg-tertiary)', 
                        color: 'var(--cds-fg-primary)',
                        border: 'none'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button 
              className="px-6 py-3 rounded-lg text-[14px] font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: 'var(--cds-accent-primary)', color: 'white' }}
            >
              Update Policies
            </button>
          </section>
        )}

        {activeTab === "endpoints" && (
          <section 
            className="p-6 rounded-2xl space-y-6"
            style={{ backgroundColor: 'var(--cds-bg-secondary)', border: '1px solid var(--cds-line-primary)' }}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-[16px] font-semibold">Allowed Endpoints</h2>
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded accent-[#0052FF]"
                />
                <span 
                  className="text-[13px] font-medium"
                  style={{ color: 'var(--cds-fg-secondary)' }}
                >
                  Allow all endpoints
                </span>
              </label>
            </div>
            
            <div className="space-y-2">
              {["api.openai.com", "api.anthropic.com", "weather.api", "news.api"].map((endpoint) => (
                <div 
                  key={endpoint} 
                  className="flex justify-between items-center p-4 rounded-xl transition-colors duration-150"
                  style={{ backgroundColor: 'var(--cds-bg-tertiary)' }}
                >
                  <span className="font-mono text-[14px]">{endpoint}/*</span>
                  <button 
                    className="text-[13px] font-semibold transition-colors duration-150 hover:opacity-80"
                    style={{ color: 'var(--cds-negative)' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                placeholder="api.example.com"
                className="flex-1 px-4 py-3 rounded-lg text-[14px] font-medium outline-none transition-all duration-150 focus:ring-2 placeholder:text-[#5B616E]"
                style={{ 
                  backgroundColor: 'var(--cds-bg-tertiary)', 
                  color: 'var(--cds-fg-primary)',
                  border: 'none'
                }}
              />
              <button 
                className="px-6 py-3 rounded-lg text-[14px] font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: 'var(--cds-accent-primary)', color: 'white' }}
              >
                Add Endpoint
              </button>
            </div>
          </section>
        )}

        {/* Proxy URL Box */}
        <section 
          className="p-6 rounded-2xl"
          style={{ backgroundColor: 'var(--cds-bg-secondary)', border: '1px solid var(--cds-line-primary)' }}
        >
          <h2 className="text-[16px] font-semibold">Your Proxy URL</h2>
          <p 
            className="text-[14px] mt-2 leading-relaxed"
            style={{ color: 'var(--cds-fg-secondary)' }}
          >
            Point your AI agent to this URL to route payments through your Guard wallet
          </p>
          
          <div className="flex gap-3 mt-5">
            <code 
              className="flex-1 px-4 py-3.5 rounded-lg font-mono text-[13px] break-all"
              style={{ backgroundColor: 'var(--cds-bg-primary)', color: 'var(--cds-positive)', border: '1px solid var(--cds-line-primary)' }}
            >
              https://guard.x402.io/{mockGuardData.address}/
            </code>
            <button 
              className="px-5 py-3 rounded-lg text-[14px] font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: 'var(--cds-bg-tertiary)', color: 'var(--cds-fg-primary)' }}
            >
              Copy
            </button>
          </div>
          
          <p 
            className="text-[13px] mt-4"
            style={{ color: 'var(--cds-fg-muted)' }}
          >
            Example:{" "}
            <code 
              className="font-mono"
              style={{ color: 'var(--cds-fg-secondary)' }}
            >
              https://guard.x402.io/{mockGuardData.address.slice(0, 10)}.../<span style={{ color: 'var(--cds-accent-primary)' }}>api.openai.com</span>/v1/chat
            </code>
          </p>
        </section>
      </div>
    </div>
  );
}