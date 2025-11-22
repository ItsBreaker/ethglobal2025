import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  
  webpack: (config, { isServer }) => {
    // Fix for WalletConnect / Pino logger issues with SSR
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        'pino-pretty': false,
      };
    }
    
    // Externalize problematic packages during SSR
    if (isServer) {
      config.externals = [...(config.externals as string[] || []), 'pino', 'pino-pretty'];
    }

    return config;
  },
  
  transpilePackages: ['@privy-io/react-auth'],
};

export default nextConfig;