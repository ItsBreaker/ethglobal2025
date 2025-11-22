import { paymentMiddleware } from 'x402-next';
// import { facilitator } from "@coinbase/x402"; // For mainnet

/**
 * x402 Payment Middleware Configuration
 *
 * This middleware protects API routes with crypto payments on Base Sepolia testnet.
 * Replace "0xYourAddress" with your actual wallet address to receive payments.
 */
export const middleware = paymentMiddleware(
  "0x1111111111111111111111111111111111111111", // TODO: Replace with your receiving wallet address
  {
    // Test/Demo endpoint - Simple demonstration of x402 payment flow
    '/api/test': {
      price: '$0.001',
      network: "base-sepolia",
      config: {
        description: 'Test endpoint demonstrating x402 payment integration',
        inputSchema: {
          queryParams: {
            message: "string"
          }
        },
        outputSchema: {
          success: "boolean",
          data: "string",
          timestamp: "number"
        }
      }
    },

    // Mock API endpoints - Individual routes for payment protection
    '/api/mock': {
      price: '$0.01',
      network: "base-sepolia",
      config: {
        description: 'Access to mock API base endpoint',
        outputSchema: {
          result: "object"
        }
      }
    },

    '/api/mock/weather': {
      price: '$0.01',
      network: "base-sepolia",
      config: {
        description: 'Get mock weather data with x402 payment protection',
        outputSchema: {
          success: "boolean",
          message: "string",
          data: {
            weather: "string",
            temperature: "number",
            humidity: "number",
            windSpeed: "number",
            timestamp: "string"
          }
        }
      }
    },

    '/api/mock/data': {
      price: '$0.01',
      network: "base-sepolia",
      config: {
        description: 'Get mock data with x402 payment protection',
        outputSchema: {
          success: "boolean",
          data: "object"
        }
      }
    }
  },
  {
    url: "https://x402.org/facilitator", // Testnet facilitator
  }
);

/**
 * Configure which paths the middleware should run on
 * This ensures the payment middleware only runs on our protected API routes
 */
export const config = {
  matcher: [
    '/api/test',
    '/api/mock',
    '/api/mock/weather',
    '/api/mock/data',
  ]
};
