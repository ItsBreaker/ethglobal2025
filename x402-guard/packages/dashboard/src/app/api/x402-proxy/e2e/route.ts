import { withX402, Network } from "x402-next";
import { Address, formatUnits, createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { facilitator } from "@coinbase/x402";
import { NextRequest, NextResponse } from "next/server";
import { bridgeUSDC, extractBridgeAmount, getViemChain } from "@/lib/bridge";
import { wrapFetchWithPayment } from "x402-fetch";

const payTo = process.env.NEXT_PUBLIC_PROXY_ADDRESS as Address;
const network = process.env.NETWORK as Network || "base";
const isTestnet = network.includes("sepolia");

// Cache for wrapped handlers to maintain payment session consistency
// Key: targetUrl-price, Value: wrapped handler
const handlerCache = new Map<string, (request: NextRequest) => Promise<NextResponse>>();

/**
 * Parse target x402 response to extract payment details
 */
interface PaymentDetails {
  network: string;
  token: string;
  amount: string;
  payTo?: Address;
}

function parseTargetPaymentDetails(body: any): PaymentDetails | null {
  try {
    // Support both CoinAPI format and standard x402 format
    const accept = body.accepts?.[0] || body.payment;
    if (!accept) return null;

    return {
      network: accept.network || 'polygon',
      token: accept.asset || accept.token || 'USDC',
      amount: accept.amount || accept.maxAmountRequired || '0.01',
      payTo: accept.payTo as Address,
    };
  } catch (error) {
    console.error('[E2E] Failed to parse payment details:', error);
    return null;
  }
}

/**
 * Main GET handler - End-to-end proxy with payment verification
 * 
 * This route:
 * 1. Fetches the target URL to determine payment requirements
 * 2. Uses withX402 to verify payment before proxying
 * 3. After payment is verified, proxies the request to the target with payment proof
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('target');

  console.log('\n========== E2E Proxy Request ==========');
  console.log(`URL: ${request.url}`);
  console.log(`Target: ${targetUrl}`);
  console.log(`Has X-Payment header: ${!!request.headers.get('x-payment')}`);

  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Missing target URL parameter' },
      { status: 400 }
    );
  }

  // Step 1: Fetch target to get payment details
  console.log('[Step 1] Fetching target to extract payment details...');

  let dollarAmount = '$0.01'; // Default fallback
  let targetNetwork = 'polygon'; // Default target network

  try {
    const response = await fetch(targetUrl);
    console.log(`[Step 1] Target response status: ${response.status}`);

    if (response.status === 402) {
      // Target requires payment - extract the details
      const body = await response.json();
      const paymentDetails = parseTargetPaymentDetails(body);

      if (paymentDetails) {
        // Convert USDC units to dollar amount if needed
        let targetAmount = paymentDetails.amount.startsWith('$')
          ? paymentDetails.amount
          : `$${formatUnits(BigInt(paymentDetails.amount), 6)}`;

        // Enforce minimum price of $0.01
        const numericAmount = parseFloat(targetAmount.replace('$', ''));
        dollarAmount = numericAmount < 0.01 ? '$0.01' : targetAmount;

        targetNetwork = paymentDetails.network;
        console.log('[Step 1] Extracted payment details:');
        console.log(`  - Network: ${targetNetwork}`);
        console.log(`  - Token: ${paymentDetails.token}`);
        console.log(`  - Target Amount: ${targetAmount}`);
        console.log(`  - Our Price: ${dollarAmount} (min $0.01)`);
        console.log(`  - PayTo: ${paymentDetails.payTo}`);
      } else {
        console.warn('[Step 1] Could not parse payment details, using default: $0.01');
      }
    } else if (response.status < 400) {
      // Target doesn't require payment - just proxy the response
      console.log('[Step 1] Target does not require payment, proxying response');
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      console.error(`[Step 1] Target returned error status: ${response.status}`);
      return NextResponse.json(
        { error: 'Target API returned an error', status: response.status },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('[Step 1] Error fetching target:', error);
    return NextResponse.json(
      { error: 'Failed to fetch target API', details: String(error) },
      { status: 502 }
    );
  }

  // Step 2: Create handler that will be called AFTER payment verification
  const handler = async (req: NextRequest): Promise<NextResponse> => {
    console.log('[Step 3] Payment verified! Starting bridge...');

    try {
      const bridgeAmount = extractBridgeAmount(dollarAmount);

      // Bridge USDC to target chain (waits for completion)
      console.log(`[Step 3] Bridging ${bridgeAmount} USDC to ${targetNetwork}...`);
      const bridgeResult = await bridgeUSDC(bridgeAmount, targetNetwork, 'base', isTestnet);
      
      if (!bridgeResult.success) {
        throw new Error(`Bridge failed: ${bridgeResult.error}`);
      }
      
      console.log(`[Step 3] ✓ Bridge complete! Funds now on ${targetNetwork}`);

      // Create wallet client on target chain
      const privateKey = process.env.DEMO_SPENDER_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error("DEMO_SPENDER_PRIVATE_KEY not set");
      }

      const account = privateKeyToAccount(privateKey as `0x${string}`);
      const targetChain = getViemChain(targetNetwork, isTestnet);
      const client = createWalletClient({
        account,
        transport: http(),
        chain: targetChain,
      }).extend(publicActions);

      console.log(`[Step 3] Created wallet on ${targetNetwork}, calling target with payment...`);

      // Wrap fetch with payment on target chain
      const fetchWithPay = wrapFetchWithPayment(fetch, client);
      
      // Call target API with payment from target chain
      const targetResponse = await fetchWithPay(targetUrl, { method: 'GET' });
      
      console.log(`[Step 3] Target response status: ${targetResponse.status}`);

      if (!targetResponse.ok) {
        const errorText = await targetResponse.text();
        return NextResponse.json(
          { error: 'Target API error', details: errorText },
          { status: targetResponse.status }
        );
      }

      const data = await targetResponse.json();
      console.log('[Step 3] ✓ Complete! Bridge + Payment + Response');
      console.log('=======================================\n');

      return NextResponse.json({
        success: true,
        message: 'E2E proxy successful',
        target: targetUrl,
        bridge: {
          success: bridgeResult.success,
          amount: bridgeResult.amount,
          fromChain: bridgeResult.fromChain,
          toChain: bridgeResult.toChain,
          txHash: bridgeResult.txHash,
          explorerUrl: bridgeResult.explorerUrl,
        },
        targetResponse: data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Step 3] Error:', error);
      return NextResponse.json(
        { error: 'Failed to complete request', details: String(error) },
        { status: 500 }
      );
    }
  };

  // Step 2: Get or create cached wrapper for this target+price combination
  const cacheKey = `${targetUrl}:${dollarAmount}`;

  let wrappedHandler = handlerCache.get(cacheKey);

  if (!wrappedHandler) {
    console.log(`[Step 2] Creating NEW withX402 wrapper with price: ${dollarAmount}`);
    wrappedHandler = withX402(
      handler,
      payTo,
      {
        price: dollarAmount,
        network,
        config: {
          description: `E2E x402 proxy to ${targetUrl}`,
        },
      },
      facilitator,
      {
        appName: "x402 Guard",
        appLogo: "/x402-icon-blue.png",
      },
    );
    handlerCache.set(cacheKey, wrappedHandler);
    console.log(`[Step 2] Cached wrapper for key: ${cacheKey}`);
  } else {
    console.log(`[Step 2] Using CACHED wrapper for key: ${cacheKey}`);
  }

  console.log('[Step 2] Calling withX402 handler...');
  return wrappedHandler(request);
}
