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
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Optional message parameter"
            }
          }
        },
        outputSchema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "string" },
            timestamp: { type: "number" }
          }
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
          type: "object",
          properties: {
            result: { type: "object" }
          }
        }
      }
    },

    '/api/mock/weather': {
      price: '$0.01',
      network: "base-sepolia",
      config: {
        description: 'Get mock weather data with x402 payment protection',
        outputSchema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                weather: { type: "string" },
                temperature: { type: "number" },
                humidity: { type: "number" },
                windSpeed: { type: "number" },
                timestamp: { type: "string" }
              }
            }
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
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "object" }
          }
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
