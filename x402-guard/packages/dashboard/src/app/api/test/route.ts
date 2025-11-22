import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint for x402 payment integration
 *
 * This endpoint demonstrates the x402 payment flow with a simple test response.
 * It's protected by the x402 middleware configured in src/middleware.ts
 *
 * Payment required: $0.001 USDC on Base Sepolia
 */
export async function GET(request: NextRequest) {
  // Extract query parameters
  const searchParams = request.nextUrl.searchParams;
  const message = searchParams.get('message') || 'Hello from x402 protected endpoint!';

  // Payment has been verified by middleware at this point
  // Return the protected content
  return NextResponse.json({
    success: true,
    data: message,
    timestamp: Date.now(),
    metadata: {
      network: 'base-sepolia',
      price: '$0.001',
      description: 'This response was delivered after successful x402 payment verification'
    }
  }, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    }
  });
}

/**
 * POST endpoint for testing with request body
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      data: {
        received: body,
        message: 'POST request processed successfully'
      },
      timestamp: Date.now(),
    }, {
      status: 200,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Invalid JSON in request body'
    }, {
      status: 400,
    });
  }
}
