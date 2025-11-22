import { NextRequest, NextResponse } from 'next/server';

/**
 * Mock API Proxy Endpoint
 *
 * This endpoint simulates various API services protected by x402 payments.
 * It's protected by the x402 middleware configured in src/middleware.ts
 *
 * Payment required: $0.01 USDC on Base Sepolia
 *
 * Examples:
 * - /api/mock/weather - Returns weather data
 * - /api/mock/data - Returns generic data
 * - /api/mock/custom - Returns custom response
 */

interface RouteContext {
  params: Promise<{
    path: string[];
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { path } = await context.params;
  const endpoint = path.join('/');

  // Payment has been verified by x402 middleware at this point
  // Return different mock data based on the endpoint path

  switch (endpoint) {
    case 'weather':
      return NextResponse.json({
        success: true,
        message: "Here's your weather data!",
        data: {
          weather: "sunny",
          temperature: 72,
          humidity: 45,
          windSpeed: 8,
          timestamp: new Date().toISOString(),
        },
      });

    case 'data':
      return NextResponse.json({
        success: true,
        message: "Here's your data!",
        data: {
          items: [
            { id: 1, name: 'Item 1', value: 100 },
            { id: 2, name: 'Item 2', value: 200 },
            { id: 3, name: 'Item 3', value: 300 },
          ],
          timestamp: new Date().toISOString(),
        },
      });

    case 'quote':
      const quotes = [
        "The future of payments is programmable.",
        "Crypto enables permissionless innovation.",
        "Web3 empowers creators and builders.",
        "Decentralization creates resilience.",
      ];
      return NextResponse.json({
        success: true,
        message: "Here's your quote!",
        data: {
          quote: quotes[Math.floor(Math.random() * quotes.length)],
          author: "x402 Guard",
          timestamp: new Date().toISOString(),
        },
      });

    default:
      return NextResponse.json({
        success: true,
        message: `You've accessed the ${endpoint} endpoint`,
        data: {
          endpoint,
          method: request.method,
          timestamp: new Date().toISOString(),
          note: "This is a mock API response protected by x402 payment"
        },
      });
  }
}

/**
 * POST endpoint for mock API
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { path } = await context.params;
  const endpoint = path.join('/');

  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      message: `POST request to ${endpoint} processed`,
      data: {
        received: body,
        endpoint,
        timestamp: new Date().toISOString(),
      },
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

/**
 * Handle all other HTTP methods
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const { path } = await context.params;
  return handleOtherMethods(request, path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { path } = await context.params;
  return handleOtherMethods(request, path, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { path } = await context.params;
  return handleOtherMethods(request, path, 'PATCH');
}

function handleOtherMethods(request: NextRequest, path: string[], method: string) {
  const endpoint = path.join('/');
  return NextResponse.json({
    success: true,
    message: `${method} request to ${endpoint} received`,
    data: {
      endpoint,
      method,
      timestamp: new Date().toISOString(),
    },
  });
}
