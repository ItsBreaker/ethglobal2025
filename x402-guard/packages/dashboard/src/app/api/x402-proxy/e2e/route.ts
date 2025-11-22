import { withX402, Network } from "x402-next";
import { Address, formatUnits } from "viem";
import { facilitator } from "@coinbase/x402";
import { NextRequest, NextResponse } from "next/server";

const payTo = process.env.NEXT_PUBLIC_PROXY_ADDRESS as Address;
const network = process.env.NETWORK as Network || "base";

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
 * Simple handler - just return success after payment
 */
const handler = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('target');

  console.log('[E2E Handler] Payment collected by withX402');
  console.log(`[E2E Handler] Target: ${targetUrl}`);

  return NextResponse.json({
    success: true,
    message: 'Payment collected successfully',
    target: targetUrl,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Main GET handler
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('target');
  const hasPayment = !!request.headers.get('x-payment');

  console.log('\n========== E2E Proxy Request ==========');
  console.log(`URL: ${request.url}`);
  console.log(`Target: ${targetUrl}`);
  console.log(`Has payment: ${hasPayment}`);

  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Missing target URL parameter' },
      { status: 400 }
    );
  }

  // If payment header is present, skip middleware and use default withX402
  if (hasPayment) {
    console.log('[Payment Present] Skipping target fetch, using default withX402 wrapper');
    
    const wrappedHandler = withX402(
      handler,
      payTo,
      {
        price: "$0.01", // Default since we're skipping the fetch
        network,
        config: {
          description: "E2E x402 proxy",
        },
      },
      facilitator,
      {
        appName: "Next x402 Demo",
        appLogo: "/x402-icon-blue.png",
      },
    );
    
    return wrappedHandler(request);
  }

  // Step 1: Fetch target to get payment details (only on initial request)
  console.log('[Step 1] Fetching target to extract payment details...');
  
  try {
    const response = await fetch(targetUrl);
    console.log(`[Step 1] Target response status: ${response.status}`);

    if (response.status !== 402) {
      console.log('[Step 1] Target does not require payment, proxying response');
      const data = await response.json();
      return NextResponse.json(data);
    }

    const body = await response.json();
    const paymentDetails = parseTargetPaymentDetails(body);

    if (!paymentDetails) {
      console.error('[Step 1] Failed to parse payment details');
      return NextResponse.json(
        { error: 'Invalid x402 response from target' },
        { status: 502 }
      );
    }

    console.log('[Step 1] Extracted payment details:');
    console.log(`  - Network: ${paymentDetails.network}`);
    console.log(`  - Token: ${paymentDetails.token}`);
    console.log(`  - Amount (raw): ${paymentDetails.amount}`);
    console.log(`  - PayTo: ${paymentDetails.payTo}`);

    // Convert USDC units to dollar amount
    const dollarAmount = paymentDetails.amount.startsWith('$')
      ? paymentDetails.amount
      : `$${formatUnits(BigInt(paymentDetails.amount), 6)}`;

    console.log(`[Step 1] Converted to: ${dollarAmount}`);
    console.log('=======================================\n');

    // Step 2: Create withX402 wrapper with extracted amount
    console.log(`[Step 2] Creating withX402 wrapper with price: ${dollarAmount}`);
    
    const wrappedHandler = withX402(
      handler,
      payTo,
      {
        price: dollarAmount,
        network,
        config: {
          description: "E2E x402 proxy",
        },
      },
      facilitator,
      {
        appName: "Next x402 Demo",
        appLogo: "/x402-icon-blue.png",
      },
    );

    // Step 3: Call withX402 handler
    return wrappedHandler(request);
    
  } catch (error) {
    console.error('[E2E] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: String(error) },
      { status: 500 }
    );
  }
}
