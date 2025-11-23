import { BridgeKit } from "@circle-fin/bridge-kit";
import { createAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { Chain, base, baseSepolia, polygon, polygonAmoy, mainnet, sepolia, arbitrum, arbitrumSepolia, optimism, optimismSepolia, avalanche, avalancheFuji } from "viem/chains";

// Initialize Bridge Kit SDK
const kit = new BridgeKit();

interface BridgeResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  amount?: string;
  fromChain?: string;
  toChain?: string;
  error?: string;
  steps?: any[];
}

/**
 * Map network names to Circle Bridge Kit chain identifiers
 */
function getChainIdentifier(network: string, isTestnet: boolean): string {
  const networkLower = network.toLowerCase();
  
  // Mainnet chains
  if (!isTestnet) {
    switch (networkLower) {
      case 'base':
        return 'Base';
      case 'polygon':
        return 'Polygon';
      case 'ethereum':
      case 'eth':
        return 'Ethereum';
      case 'arbitrum':
        return 'Arbitrum';
      case 'avalanche':
        return 'Avalanche';
      case 'optimism':
        return 'Optimism';
      default:
        throw new Error(`Unsupported mainnet network: ${network}`);
    }
  }
  
  // Testnet chains
  switch (networkLower) {
    case 'base':
    case 'base-sepolia':
      return 'Base_Sepolia';
    case 'polygon':
    case 'polygon-amoy':
      return 'Polygon_Amoy';
    case 'ethereum':
    case 'eth':
    case 'sepolia':
      return 'Ethereum_Sepolia';
    case 'arbitrum':
    case 'arbitrum-sepolia':
      return 'Arbitrum_Sepolia';
    case 'avalanche':
    case 'avalanche-fuji':
      return 'Avalanche_Fuji';
    case 'optimism':
    case 'optimism-sepolia':
      return 'Optimism_Sepolia';
    default:
      throw new Error(`Unsupported testnet network: ${network}`);
  }
}

/**
 * Bridge USDC from Base to target chain using Circle's Bridge Kit
 * @param amount Amount in USDC (e.g., "1.00" or "0.01")
 * @param targetNetwork Target network (e.g., "polygon", "ethereum", "arbitrum")
 * @param sourceNetwork Source network (default: "base")
 * @param isTestnet Whether to use testnet chains (default: false)
 * @returns Promise with bridge result including transaction details
 */
export async function bridgeUSDC(
  amount: string,
  targetNetwork: string,
  sourceNetwork: string = "base",
  isTestnet: boolean = false
): Promise<BridgeResult> {
  try {
    const privateKey = process.env.DEMO_SPENDER_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error("DEMO_SPENDER_PRIVATE_KEY environment variable is not set");
    }

    console.log(`[Bridge] Starting USDC bridge:`);
    console.log(`[Bridge]   Amount: ${amount}`);
    console.log(`[Bridge]   From: ${sourceNetwork} (${isTestnet ? 'testnet' : 'mainnet'})`);
    console.log(`[Bridge]   To: ${targetNetwork} (${isTestnet ? 'testnet' : 'mainnet'})`);

    // Create adapter from private key
    const adapter = createAdapterFromPrivateKey({
      privateKey: privateKey as `0x${string}`,
    });

    // Get chain identifiers
    const fromChain = getChainIdentifier(sourceNetwork, isTestnet);
    const toChain = getChainIdentifier(targetNetwork, isTestnet);

    console.log(`[Bridge] Bridge Kit chains: ${fromChain} → ${toChain}`);

    // Execute bridge transfer
    const result = await kit.bridge({
      from: { adapter, chain: fromChain as any },
      to: { adapter, chain: toChain as any },
      amount: amount,
    });

    console.log(`[Bridge] ✓ Bridge completed successfully`);
    console.log(`[Bridge]   Total steps: ${result.steps?.length || 0}`);

    // Extract transaction details from the steps
    const depositStep = result.steps?.find((s: any) => s.name === 'deposit');
    const txHash = depositStep?.txHash || (depositStep as any)?.data?.txHash;
    const explorerUrl = (depositStep as any)?.data?.explorerUrl;

    return {
      success: true,
      txHash,
      explorerUrl,
      amount,
      fromChain,
      toChain,
      steps: result.steps,
    };
  } catch (error) {
    console.error("[Bridge] ✗ Error bridging USDC:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Map network names to viem Chain objects
 */
export function getViemChain(network: string, isTestnet: boolean): Chain {
  const networkLower = network.toLowerCase();
  
  if (!isTestnet) {
    switch (networkLower) {
      case 'base': return base;
      case 'polygon': return polygon;
      case 'ethereum':
      case 'eth': return mainnet;
      case 'arbitrum': return arbitrum;
      case 'avalanche': return avalanche;
      case 'optimism': return optimism;
      default: throw new Error(`Unsupported mainnet network: ${network}`);
    }
  }
  
  switch (networkLower) {
    case 'base':
    case 'base-sepolia': return baseSepolia;
    case 'polygon':
    case 'polygon-amoy': return polygonAmoy;
    case 'ethereum':
    case 'eth':
    case 'sepolia': return sepolia;
    case 'arbitrum':
    case 'arbitrum-sepolia': return arbitrumSepolia;
    case 'avalanche':
    case 'avalanche-fuji': return avalancheFuji;
    case 'optimism':
    case 'optimism-sepolia': return optimismSepolia;
    default: throw new Error(`Unsupported testnet network: ${network}`);
  }
}

/**
 * Extract USDC amount from payment header or dollar amount string
 * @param dollarAmount Amount string (e.g., "$0.01" or "0.01")
 * @returns Formatted amount for bridge (e.g., "0.01")
 */
export function extractBridgeAmount(dollarAmount: string): string {
  // Remove $ sign if present
  const cleanAmount = dollarAmount.replace('$', '').trim();
  
  // Ensure it's a valid number
  const parsed = parseFloat(cleanAmount);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid amount: ${dollarAmount}`);
  }
  
  // Format to 2 decimal places for USDC
  return parsed.toFixed(2);
}
