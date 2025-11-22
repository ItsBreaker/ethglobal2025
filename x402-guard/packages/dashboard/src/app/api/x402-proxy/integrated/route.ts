import { withX402, Network } from "x402-next";
import { Address } from "viem";
import { facilitator } from "@coinbase/x402";
import { NextRequest, NextResponse } from "next/server";

const payTo = process.env.NEXT_PUBLIC_PROXY_ADDRESS as Address;
const network = process.env.NETWORK as Network || "base";

// Mock CCTP bridging function (placeholder)
async function mockBridge(amount: string, fromChain: string, toChain: string, toAddress: Address): Promise<boolean> {
  // Simulate 15-sec delay
  await new Promise(resolve => setTimeout(resolve, 15000));
  console.log(`Mock bridged ${amount} USDC from ${fromChain} to ${toChain} address ${toAddress}`);
  return true; // Assume success
}

// Function to extract payment requirements from 402 response
async function extractPaymentRequirements(response: Response) {
  if (response.status !== 402) return null;
  const body = await response.json();
  // Assume body has { payTo: address, amount: string, ... }
  return body;
}

/**
 * Integrated x402 cross-chain payment handler
 * Accepts payment on Base, bridges to Polygon, pays target endpoint
 */
const handler = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('target');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing target URL' }, { status: 400 });
  }

  try {
    // Step 1: Fetch target to get payment requirements
    const initialResponse = await fetch(targetUrl);
    const requirements = await extractPaymentRequirements(initialResponse);

    if (!requirements) {
      // If not 402, just proxy the response
      const data = await initialResponse.json();
      return NextResponse.json(data, { status: initialResponse.status });
    }

    // Assume requirements.payTo is the Polygon address
    const targetPayTo = requirements.payTo as Address;
    const amount = requirements.amount || "0.01"; // Default

    // Step 2: Payment collected via withX402 (handled by wrapper)

    // Step 3: Mock bridge to Polygon
    const bridgeSuccess = await mockBridge(amount, 'base', 'polygon', targetPayTo);
    if (!bridgeSuccess) {
      return NextResponse.json({ error: 'Bridging failed' }, { status: 500 });
    }

    // Step 4: Now pay the target with proof (mock for now)
    // In real impl, generate X-Payment header with signed tx from Polygon wallet
    const finalResponse = await fetch(targetUrl, {
      headers: {
        'X-Payment': JSON.stringify({ proof: 'mock-proof' }), // Placeholder
      },
    });

    const data = await finalResponse.json();
    return NextResponse.json(data, { status: finalResponse.status });
  } catch (error) {
    console.error('Error in integrated handler:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};

/**
 * Protected integrated endpoint
 * User pays on Base, then bridging and target payment happen
 */
export const GET = withX402(
  handler,
  payTo,
  {
    price: "$0.01",
    network,
    config: {
      description: "Integrated cross-chain x402 payment",
    },
  },
  facilitator,
  {
    appName: "Next x402 Demo",
    appLogo: "/x402-icon-blue.png",
  },
);