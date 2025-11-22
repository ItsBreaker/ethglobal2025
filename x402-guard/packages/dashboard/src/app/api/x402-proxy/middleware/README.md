# X402 Guard - E2E Cross-Chain Payment Proxy

This endpoint implements an end-to-end cross-chain payment proxy using the x402 protocol, CCTP V2 bridging, and X402Guard spending policies.

## Overview

The E2E proxy enables users to pay for x402-protected services on any supported chain by paying with USDC on Base. The proxy handles:

1. **Payment discovery** - Fetches target endpoint to determine payment requirements
2. **EIP-3009 signature collection** - User signs permit for USDC transfer on Base
3. **Signature consumption** - Proxy uses `receiveWithAuthorization` to pull funds from user
4. **X402Guard policy checks** - Validates payments against spending policies (optional)
5. **Cross-chain bridging** - Bridges USDC to target chain using Circle's CCTP V2
6. **Payment settlement** - Transfers USDC to target endpoint's payTo address
7. **Proof submission** - Submits payment proof to target endpoint
8. **Response forwarding** - Returns target endpoint's response to user

### Key Innovation: EIP-3009 Signature-Based Transfers

Unlike traditional x402 implementations that use the `withX402` middleware (which settles payments but doesn't give the proxy access to funds), this implementation uses **EIP-3009's `receiveWithAuthorization`** to:

- Extract the signed permit from the x402 payment payload
- Call USDC's `receiveWithAuthorization` function to pull funds directly to the proxy
- Ensures proxy has funds available for immediate bridging
- No need for separate settlement or waiting for facilitator

## API Endpoint

```
GET /api/x402-proxy/e2e?target={TARGET_URL}
```

### Parameters

- `target` (required) - The x402-protected endpoint URL to proxy

### Example Request

```bash
# Example 1: CoinAPI Bitcoin Price (x402-protected endpoint)
curl -X GET "http://localhost:3000/api/x402-proxy/e2e?target=https://coinapi.dev/api/price/bitcoin/2024-01-01"

# Example 2: CoinAPI Ethereum Price
curl -X GET "http://localhost:3000/api/x402-proxy/e2e?target=https://coinapi.dev/api/price/ethereum/latest"

# Example 3: Any x402-protected endpoint
curl -X GET "http://localhost:3000/api/x402-proxy/e2e?target=https://api.example.com/data"
```

### Example Response Flow

**Step 1: Initial Request (Returns 402 with payment details)**
```bash
curl "http://localhost:3000/api/x402-proxy/e2e?target=https://coinapi.dev/api/price/bitcoin/2024-01-01"
```

Response (402 Payment Required):
```json
{
  "type": "payment-required",
  "message": "Payment required for https://coinapi.dev/api/price/bitcoin/2024-01-01",
  "targetPayment": {
    "network": "polygon",
    "token": "USDC",
    "amount": "0.01",
    "payTo": "0x547bdfFB7658F59232D7Db7af648B93a5f9e6814"
  },
  "payment": {
    "network": "base",
    "token": "USDC",
    "amount": "0.01",
    "payTo": "0xYourProxyAddress"
  }
}
```

**Step 2: Payment & Data Retrieval (Handled automatically by x402 client)**

After user pays on Base, the proxy:
- Bridges USDC to Polygon via CCTP
- Transfers to CoinAPI's payTo address
- Submits payment proof
- Returns the actual Bitcoin price data

Response (200 Success):
```json
{
  "success": true,
  "data": {
    "symbol": "BTC",
    "price": 42150.75,
    "timestamp": "2024-01-01T00:00:00Z",
    "currency": "USD"
  },
  "proof": {
    "transferTxHash": "0x1234...abcd",
    "bridgeResult": {
      "sourceChain": "Base",
      "destinationChain": "Polygon",
      "amount": "0.01"
    }
  }
}
```

## Flow Diagram

```
User Request
     |
     v
[E2E Proxy] --fetch--> [Target x402 Endpoint]
     |                         |
     | <----402 Payment---------+
     |
     v
Return 402 to user with Base payment details
     |
     v
User signs EIP-3009 permit (x402 client)
     |
     v
[E2E Proxy receives X-PAYMENT header with signature]
     |
     v
[Parse EIP-3009 signature from payload]
     |
     v
[Call USDC.receiveWithAuthorization()]
     |     (pulls funds from user to proxy)
     v
[Check X402Guard Policy] (optional)
     |
     v
[CCTP Bridge: Base -> Target Chain]
     |
     v
[Transfer USDC to target's payTo]
     |
     v
[Submit proof to target endpoint]
     |
     v
Return target's response to user
```

## Configuration

Set these environment variables in `.env.local`:

```bash
# Proxy wallet address (receives payments on Base)
NEXT_PUBLIC_PROXY_ADDRESS=0x...

# X402Guard contract address (optional, for spending policies)
GUARD_ADDRESS=0x...

# Private key for agent wallet (executes bridging)
DEMO_SPENDER_PRIVATE_KEY=0x...

# Network configuration (use 'base' for mainnet, 'base-sepolia' for testnet)
NETWORK=base
```

## X402Guard Integration

When `GUARD_ADDRESS` is configured, the proxy will check spending policies before executing payments:

### Policy Checks

1. **Per-transaction limit** - Rejects payments exceeding `maxPerTransaction`
2. **Daily spending limit** - Rejects payments that would exceed `dailyLimit`
3. **Endpoint allowlist** - Only allows payments to whitelisted endpoints (if enabled)
4. **Approval threshold** - Requires owner approval for payments above `approvalThreshold`

### Example Policy Check

```typescript
// Configure guard with spending limits
await guard.setPolicy(
  parseUnits("1", 6),   // Max $1 per transaction
  parseUnits("10", 6),  // Max $10 per day
  parseUnits("0.5", 6)  // Require approval above $0.50
);

// Whitelist specific endpoints
await guard.setEndpointAllowedByUrl("https://api.example.com/data", true);
```

## Security Features

1. **Payment verification** - All payments are verified by x402 facilitator before processing
2. **Guard policies** - Optional spending limits and endpoint allowlists prevent unauthorized payments
3. **On-chain proof** - All cross-chain transfers are recorded on-chain and provided as proof
4. **Non-custodial** - Proxy never holds user funds; payments flow directly to target

## Supported Networks

### Payment Network (User pays here)
- **Base Mainnet** (production)
- Base Sepolia (testnet)

### Target Networks (Where service providers receive payment)
- **Polygon Mainnet** (production)
- Polygon Amoy (testnet)
- Additional networks via CCTP V2 (coming soon)

## Error Handling

The proxy returns descriptive error messages for common failure scenarios:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Missing target parameter | No target URL provided |
| 403 | Payment blocked: {reason} | X402Guard policy rejected payment |
| 402 | Payment requires owner approval | Payment exceeds approval threshold |
| 500 | Target endpoint configuration error | Target didn't return expected 402 response |
| 502 | Target rejected payment proof | Target endpoint rejected the payment proof |

## Example Usage with x402 Client

```typescript
import { createX402Client } from "x402";

const client = createX402Client({
  wallet: myWallet,
  network: "base",
});

// Automatically handles payment flow
const response = await client.fetch(
  "http://localhost:3000/api/x402-proxy/e2e?target=https://api.example.com/data"
);

const data = await response.json();
console.log(data); // Target endpoint's response
```

## Limitations

1. **USDC only** - Only supports USDC payments (most common x402 asset)
2. **Synchronous flow** - User must wait for bridge completion (15-30 seconds)
3. **Single-hop bridging** - Only supports direct bridging between two chains
4. **Limited target chains** - Currently supports Base → Polygon bridging

## Future Enhancements

- [ ] Support for multiple assets (EURC, etc.)
- [ ] Async payment processing with webhooks
- [ ] Multi-hop bridging for unsupported chain pairs
- [ ] Gas optimization strategies
- [ ] Batch payment processing
- [ ] Payment streaming for recurring services

## Testing

### Start Development Server
```bash
cd packages/dashboard
pnpm dev
```

### Test with CoinAPI Endpoints

CoinAPI (https://coinapi.dev) is a real x402-protected API that provides cryptocurrency price data.

```bash
# Bitcoin price for a specific date
curl "http://localhost:3000/api/x402-proxy/e2e?target=https://coinapi.dev/api/price/bitcoin/2024-01-01"

# Ethereum latest price
curl "http://localhost:3000/api/x402-proxy/e2e?target=https://coinapi.dev/api/price/ethereum/latest"

# Solana price
curl "http://localhost:3000/api/x402-proxy/e2e?target=https://coinapi.dev/api/price/solana/latest"

# Historical BNB price
curl "http://localhost:3000/api/x402-proxy/e2e?target=https://coinapi.dev/api/price/bnb/2024-11-20"
```

### Test with x402 Client Library

```typescript
import { createX402Client } from "x402";

const client = createX402Client({
  wallet: myWallet,
  network: "base-sepolia",
});

// Get Bitcoin price (automatically handles payment)
const response = await client.fetch(
  "http://localhost:3000/api/x402-proxy/e2e?target=https://coinapi.dev/api/price/bitcoin/latest"
);

const data = await response.json();
console.log("BTC Price:", data.data.price);
```

### Browser Example

You can also test directly in the browser:

```
http://localhost:3000/api/x402-proxy/e2e?target=https://coinapi.dev/api/price/bitcoin/latest
```

The browser will show the 402 payment required response with payment details. Use an x402-compatible wallet extension to complete the payment.

## License

MIT
