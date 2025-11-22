import { withX402 } from "x402-next";
import { Address } from "viem";
import { facilitator } from "@coinbase/x402";
import { NextRequest, NextResponse } from "next/server";

const payTo = process.env.NEXT_PUBLIC_PROXY_ADDRESS as Address;
const network = "base";

/**
 * Simple handler that returns hello world after payment
 */
const handler = async (_: NextRequest) => {
  console.log('[Hello] Payment received, returning hello world');

  return NextResponse.json(
    {
      message: "Hello World!",
      paid: true,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
};

/**
 * Protected hello world endpoint
 * Requires $0.01 payment before returning response
 */
export const GET = withX402(
  handler,
  payTo,
  {
    price: "$0.01",
    network,
    config: {
      description: "Simple hello world with payment",
    },
  },
  facilitator,
  {
    appName: "Next x402 Demo",
    appLogo: "/x402-icon-blue.png",
  },
);
