import { paymentMiddleware } from 'x402-next';

export const middleware = paymentMiddleware(
  "0x1111111111111111111111111111111111111111", // TODO: Replace with your receiving wallet address
  {
    '/api/test': {
      price: '$0.001',
      network: "base-sepolia",
      config: {
        description: 'Test endpoint demonstrating x402 payment integration',
      }
    },
    '/api/mock': {
      price: '$0.01',
      network: "base-sepolia",
      config: {
        description: 'Access to mock API base endpoint',
      }
    },
    '/api/mock/weather': {
      price: '$0.01',
      network: "base-sepolia",
      config: {
        description: 'Get mock weather data with x402 payment protection',
      }
    },
    '/api/mock/data': {
      price: '$0.01',
      network: "base-sepolia",
      config: {
        description: 'Get mock data with x402 payment protection',
      }
    }
  },
  {
    url: "https://x402.org/facilitator",
  }
);

export const config = {
  matcher: [
    '/api/test',
    '/api/mock',
    '/api/mock/weather',
    '/api/mock/data',
  ]
};