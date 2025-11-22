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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Guard Wallet</h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">{mockGuardData.address}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-sm">Balance</p>
          <p className="text-3xl font-bold">${mockGuardData.balance} <span className="text-lg text-gray-400">USDC</span></p>
        </div>
      </div>

      {/* Daily Spending Progress */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Today&apos;s Spending</h2>
          <span className="text-gray-400 text-sm">Resets in: {mockGuardData.timeUntilReset}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
          <div 
            className="bg-blue-500 h-4 rounded-full transition-all duration-500"
            style={{ width: `${(parseFloat(mockGuardData.dailySpent) / parseFloat(mockGuardData.dailyLimit)) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">
            ${mockGuardData.dailySpent} spent
          </span>
          <span className="text-gray-400">
            ${mockGuardData.remainingBudget} remaining of ${mockGuardData.dailyLimit}
          </span>
        </div>
      </div>

      {/* Pending Approvals */}
      {mockPendingApprovals.length > 0 && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-yellow-400 mb-4">
            🔔 Pending Approvals ({mockPendingApprovals.length})
          </h2>
          {mockPendingApprovals.map((approval) => (
            <div key={approval.id} className="flex justify-between items-center bg-gray-800 rounded-lg p-4">
              <div>
                <p className="font-medium">${approval.amount} USDC</p>
                <p className="text-gray-400 text-sm">{approval.endpoint}</p>
                <p className="text-gray-500 text-xs">Requested: {approval.requestedAt}</p>
              </div>
              <div className="flex gap-2">
                <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium">
                  ✓ Approve
                </button>
                <button className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-medium">
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-8">
          {["overview", "policies", "endpoints"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Recent Transactions */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
            <div className="space-y-3">
              {mockTransactions.map((tx) => (
                <div key={tx.id} className="flex justify-between items-center py-3 border-b border-gray-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`text-lg ${tx.status === "success" ? "text-green-400" : "text-red-400"}`}>
                      {tx.status === "success" ? "✓" : "✕"}
                    </span>
                    <div>
                      <p className="font-medium">{tx.endpoint}</p>
                      <p className="text-gray-500 text-sm">{tx.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${tx.status === "blocked" ? "text-red-400 line-through" : ""}`}>
                      ${tx.amount}
                    </p>
                    {tx.status === "blocked" && (
                      <p className="text-red-400 text-xs">Over limit</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "policies" && (
        <div className="bg-gray-800 rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-semibold">Spending Policies</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Max Per Transaction
              </label>
              <div className="flex">
                <span className="bg-gray-700 px-3 py-2 rounded-l-lg text-gray-400">$</span>
                <input
                  type="number"
                  defaultValue={mockGuardData.maxPerTransaction}
                  className="bg-gray-700 px-4 py-2 rounded-r-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Daily Limit
              </label>
              <div className="flex">
                <span className="bg-gray-700 px-3 py-2 rounded-l-lg text-gray-400">$</span>
                <input
                  type="number"
                  defaultValue={mockGuardData.dailyLimit}
                  className="bg-gray-700 px-4 py-2 rounded-r-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Require Approval Above
              </label>
              <div className="flex">
                <span className="bg-gray-700 px-3 py-2 rounded-l-lg text-gray-400">$</span>
                <input
                  type="number"
                  defaultValue={mockGuardData.approvalThreshold}
                  className="bg-gray-700 px-4 py-2 rounded-r-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <button className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium">
            Update Policies
          </button>
        </div>
      )}

      {activeTab === "endpoints" && (
        <div className="bg-gray-800 rounded-xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Allowed Endpoints</h2>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded" />
              <span className="text-sm text-gray-400">Allow all endpoints</span>
            </label>
          </div>
          
          <div className="space-y-3">
            {["api.openai.com", "api.anthropic.com", "weather.api", "news.api"].map((endpoint) => (
              <div key={endpoint} className="flex justify-between items-center bg-gray-700 rounded-lg p-4">
                <span className="font-mono">{endpoint}/*</span>
                <button className="text-red-400 hover:text-red-300">Remove</button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="api.example.com"
              className="bg-gray-700 px-4 py-2 rounded-lg flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium">
              Add Endpoint
            </button>
          </div>
        </div>
      )}

      {/* Proxy URL Box */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-2">Your Proxy URL</h2>
        <p className="text-gray-400 text-sm mb-4">
          Point your AI agent to this URL to route payments through your Guard wallet
        </p>
        <div className="flex gap-2">
          <code className="bg-gray-900 px-4 py-3 rounded-lg flex-1 font-mono text-sm text-green-400">
            https://guard.x402.io/{mockGuardData.address}/
          </code>
          <button className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">
            Copy
          </button>
        </div>
        <p className="text-gray-500 text-sm mt-3">
          Example: <code className="text-gray-400">https://guard.x402.io/{mockGuardData.address.slice(0, 10)}.../<span className="text-blue-400">api.openai.com</span>/v1/chat</code>
        </p>
      </div>
    </div>
  );
}
