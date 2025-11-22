import { NextRequest, NextResponse } from "next/server";

/**
 * Bitcoin price API endpoint handler
 *
 * @param {NextRequest} _ - The incoming request object
 * @returns JSON response with Bitcoin price data or error details
 */
const handler = async (_: NextRequest) => {
  try {
    const response = await fetch('https://coinapi.dev/api/price/bitcoin/2024-01-01');
    
    if (response.status === 402) {
      const errorText = await response.text();
      console.log('402 Payment Required error details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText,
      });
      return NextResponse.json(
        { error: 'Payment Required', details: errorText },
        { status: 402 }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching Bitcoin price:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
};

/**
 * Bitcoin price API endpoint
 * Returns payment request details when API requires payment
 */
export const GET = handler;