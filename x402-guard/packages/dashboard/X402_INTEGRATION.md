# x402 Payment Integration

This document describes the x402 payment integration for the Next.js dashboard API endpoints.

## Overview

The dashboard now includes payment-protected API endpoints using the x402 protocol on Base Sepolia testnet. These endpoints require micro-payments in USDC before returning data.

## Setup

### Dependencies Added

- `@coinbase/x402@0.7.3` - Core x402 protocol library
- `x402-next@0.7.3` - Next.js middleware integration

### Files Created

1. **`src/middleware.ts`** - x402 payment middleware configuration
2. **`src/app/api/test/route.ts`** - Test/demo endpoint
3. **`src/app/api/mock/[...path]/route.ts`** - Mock API endpoints with dynamic routing

## Protected Endpoints

### 1. Test Endpoint
- **URL**: `GET /api/test`
- **Price**: $0.001 USDC
- **Description**: Simple test endpoint for demonstrating x402 payment flow
- **Query Parameters**: `?message=<string>` (optional)

### 2. Mock API Base
- **URL**: `GET /api/mock`
- **Price**: $0.01 USDC
- **Description**: Base mock API endpoint

### 3. Mock Weather API
- **URL**: `GET /api/mock/weather`
- **Price**: $0.01 USDC
- **Description**: Returns mock weather data
- **Response**: `{ success, message, data: { weather, temperature, humidity, windSpeed, timestamp } }`

### 4. Mock Data API
- **URL**: `GET /api/mock/data`
- **Price**: $0.01 USDC
- **Description**: Returns mock structured data
- **Response**: `{ success, message, data: { items[] } }`

## Testing

### 1. Start the Development Server

```bash
cd packages/dashboard
pnpm dev
```

The server will start on `http://localhost:3000`

### 2. Test Without Payment (Returns 402)

```bash
# Test endpoint
curl -i http://localhost:3000/api/test

# Weather endpoint
curl -i http://localhost:3000/api/mock/weather

# Data endpoint
curl -i http://localhost:3000/api/mock/data
```

**Expected Response**: HTTP 402 Payment Required with payment instructions in JSON format:

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "1000",
    "resource": "http://localhost:3000/api/test",
    "payTo": "0x1111111111111111111111111111111111111111",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    ...
  }]
}
```

### 3. Test With Payment

To make a successful request, you need to:

1. Use an x402-compatible client (see [Quickstart for Buyers](https://docs.cdp.coinbase.com/x402/quickstart-for-buyers))
2. Sign a payment transaction following the payment instructions
3. Include the payment proof in the `X-PAYMENT` header

```bash
curl -i http://localhost:3000/api/test \
  -H "X-PAYMENT: <payment-proof-here>"
```

## Configuration

### Network
- **Testnet**: Base Sepolia
- **Facilitator**: https://x402.org/facilitator
- **Token**: USDC (testnet)

### Receiving Wallet

⚠️ **IMPORTANT**: Update the placeholder wallet address in `src/middleware.ts`:

```typescript
export const middleware = paymentMiddleware(
  "0x1111111111111111111111111111111111111111", // ← Replace with your wallet
  { ... }
);
```

## Production Setup

To accept real payments on mainnet, see the [Running on Mainnet](https://docs.cdp.coinbase.com/x402/quickstart-for-sellers#running-on-mainnet) section of the x402 documentation. You'll need:

1. CDP API credentials
2. Update network from `base-sepolia` to `base`
3. Replace facilitator URL with CDP facilitator
4. Use a real mainnet wallet address

## Known Limitations

### Next.js 16 Compatibility

Next.js 16 has deprecated `middleware.ts` in favor of `proxy.ts`. While the x402-next middleware still works, you may see deprecation warnings:

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

The functionality works correctly despite this warning. The x402-next package will likely be updated to support Next.js 16's new conventions in a future release.

### Route Wildcards

The middleware currently requires explicit route definitions for each endpoint. Wildcard patterns like `/api/mock/:path*` in the route configuration don't work as expected in Next.js 16.

**Workaround**: Define each protected route explicitly in `src/middleware.ts`:

```typescript
{
  '/api/mock/weather': { price: '$0.01', ... },
  '/api/mock/data': { price: '$0.01', ... },
  '/api/mock/quote': { price: '$0.01', ... },
}
```

## API Endpoints Location

All API route handlers are in the Next.js App Router structure:
- `src/app/api/test/route.ts`
- `src/app/api/mock/[...path]/route.ts`

## Resources

- [x402 Documentation](https://docs.cdp.coinbase.com/x402/)
- [Quickstart for Sellers](https://docs.cdp.coinbase.com/x402/quickstart-for-sellers)
- [x402 Bazaar](https://docs.cdp.coinbase.com/x402/bazaar) - Discovery layer for x402 services
- [GitHub Examples](https://github.com/coinbase/x402/tree/main/examples)
