# x402-Guard

🛡️ Budget controls for x402 payments. Protect your AI agents from overspending.

## Overview

x402-Guard adds a policy layer on top of x402 payments, allowing you to:

- **Set spending limits**: Daily caps, per-transaction maximums
- **Control access**: Allowlist specific API endpoints
- **Require approvals**: Human-in-the-loop for large payments
- **Monitor spending**: Real-time dashboard of agent activity

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    AI Agent     │────▶│  Guard Proxy    │────▶│   x402 API      │
│  (no wallet)    │     │  (policy check) │     │  (unchanged)    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Guard Wallet   │
                        │ (smart contract)│
                        └─────────────────┘
```

## Project Structure

```
x402-guard/
├── packages/
│   ├── contracts/     # Solidity smart contracts (Hardhat)
│   ├── proxy/         # x402 proxy server (Express)
│   └── dashboard/     # Management UI (Next.js)
└── pnpm-workspace.yaml
```

## Prerequisites

- Node.js >= 18
- pnpm >= 8
- Git

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd x402-guard
pnpm install
```

### 2. Start Local Blockchain

In terminal 1:

```bash
pnpm node
```

This starts a local Hardhat node on `http://127.0.0.1:8545`

### 3. Deploy Contracts

In terminal 2:

```bash
pnpm deploy:local
```

This will:
- Deploy MockUSDC token
- Deploy X402GuardFactory
- Create a sample Guard wallet
- Fund it with 100 USDC
- Save addresses to `packages/contracts/deployments.local.json`

### 4. Configure Proxy

```bash
cd packages/proxy
cp .env.example .env
```

Edit `.env` with the deployed addresses from step 3:

```env
PORT=3001
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337

# Copy from deployments.local.json
FACTORY_ADDRESS=0x...
USDC_ADDRESS=0x...
DEFAULT_GUARD_ADDRESS=0x...

# Use the first Hardhat test account private key
AGENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 5. Start Proxy Server

In terminal 2:

```bash
pnpm dev:proxy
```

Proxy runs on `http://localhost:3001`

### 6. Start Dashboard

In terminal 3:

```bash
pnpm dev:dashboard
```

Dashboard runs on `http://localhost:3000`

## Usage

### Check Guard Wallet Info

```bash
curl http://localhost:3001/guard/0xYOUR_GUARD_ADDRESS/info
```

### Check if Payment Would Be Allowed

```bash
curl -X POST http://localhost:3001/guard/0xYOUR_GUARD_ADDRESS/check \
  -H "Content-Type: application/json" \
  -d '{"amount": "1.00", "endpoint": "https://api.example.com"}'
```

### Make a Proxied Request (with Mock API)

```bash
# This will trigger 402 → policy check → payment → response
curl http://localhost:3001/guard/0xYOUR_GUARD_ADDRESS/localhost:3001/mock-api/data
```

### Agent Configuration

Point your AI agent to the proxy URL:

```javascript
// Before (direct to API)
const response = await fetch("https://api.openai.com/v1/chat");

// After (through Guard)
const GUARD = "http://localhost:3001/guard/0xYOUR_GUARD_ADDRESS";
const response = await fetch(`${GUARD}/api.openai.com/v1/chat`);
```

## Smart Contract Functions

### For Owners

```solidity
// Update spending policies
setPolicy(maxPerTransaction, dailyLimit, approvalThreshold)

// Manage endpoints
setEndpointAllowedByUrl("api.openai.com", true)
setAllowAllEndpoints(true)

// Approve pending payments
approvePayment(paymentId)
rejectPayment(paymentId)

// Withdraw funds
withdraw(amount)
withdrawAll()
```

### For Agents

```solidity
// Execute a payment (called by proxy)
executePayment(to, amount, endpointHash)

// Check if payment would be allowed (view)
checkPayment(amount, endpointHash)
```

## Testing

```bash
# Run contract tests
pnpm test

# Run specific test
pnpm --filter @x402-guard/contracts test
```

## Deployment to Base Sepolia

1. Get Base Sepolia ETH from a faucet
2. Get USDC from Circle's testnet faucet
3. Update `.env` in contracts package:

```env
PRIVATE_KEY=your_wallet_private_key
BASE_SEPOLIA_RPC=https://sepolia.base.org
```

4. Deploy:

```bash
pnpm --filter @x402-guard/contracts deploy:base-sepolia
```

## Hackathon Sponsors Alignment

| Sponsor | Integration |
|---------|-------------|
| **Coinbase** | Built on x402 protocol |
| **Circle** | USDC as payment token |
| **XMTP** | Approval notifications (stretch) |

## Demo Script

1. Show dashboard with Guard wallet
2. Agent makes small request → succeeds
3. Agent tries to exceed per-tx limit → blocked
4. Agent makes request above approval threshold → queued
5. Owner approves in dashboard → payment executes

## License

MIT
