import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, parseUnits, formatUnits, createPublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const BASE_SEPOLIA_CHAIN_ID = 84532;
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC

// TODO: In production, use environment variables for the spender private key
// For demo purposes, you'll need to create a wallet and fund it with ETH for gas
const SPENDER_PRIVATE_KEY = process.env.DEMO_SPENDER_PRIVATE_KEY;

if (!SPENDER_PRIVATE_KEY) {
  console.warn('DEMO_SPENDER_PRIVATE_KEY not set. Backend spend functionality will not work.');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, chainId } = body;

    if (!userAddress) {
      return NextResponse.json(
        { error: 'Missing userAddress' },
        { status: 400 }
      );
    }

    if (!SPENDER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Server not configured with spender wallet. Please set DEMO_SPENDER_PRIVATE_KEY environment variable.' },
        { status: 500 }
      );
    }

    // Create spender wallet
    const account = privateKeyToAccount(SPENDER_PRIVATE_KEY as `0x${string}`);
    const spenderAddress = account.address;

    // Create wallet client for submitting transactions
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(),
    });

    // Create public client for reading
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    console.log('Spender address:', spenderAddress);
    console.log('User address:', userAddress);

    // Dynamic import for spend permissions
    const { fetchPermissions, prepareSpendCallData } = await import('@base-org/account/spend-permission');

    // Fetch permissions for this user
    // Note: fetchPermissions might need a different provider type
    // For now, let's skip fetching and assume permission exists
    // In production, you'd store the permission signature from the frontend
    
    // This is a simplified demo - in production, the frontend should send
    // the permission details to the backend
    const permissions = await fetchPermissions({
      account: userAddress as `0x${string}`,
      chainId: BASE_SEPOLIA_CHAIN_ID,
      spender: spenderAddress,
      provider: publicClient as any,
    });

    if (!permissions || permissions.length === 0) {
      return NextResponse.json(
        { error: 'No spend permission found for this user. Please grant permission first.' },
        { status: 400 }
      );
    }

    // Use the first permission
    const permission = permissions[0];

    // Prepare spend calls for 1 USDC
    const amount = parseUnits('1', 6); // 1 USDC (6 decimals)
    
    const spendCalls = await prepareSpendCallData(
      permission as any,
      amount
    );

    console.log('Prepared spend calls:', spendCalls.length);

    // Execute the spend calls
    const transactionHashes: string[] = [];
    
    for (const call of spendCalls) {
      const hash = await walletClient.sendTransaction({
        to: call.to as `0x${string}`,
        data: call.data as `0x${string}`,
        value: call.value ? BigInt(call.value) : BigInt(0),
      });
      
      console.log('Transaction sent:', hash);
      transactionHashes.push(hash);
    }

    // Now send 1 USDC back to the user as a demo
    // This demonstrates the spend permission in action
    // In production, the backend would use the spent funds for actual service delivery
    
    // For this demo, we'll just return success
    // To actually send back, you'd need USDC in the spender wallet
    return NextResponse.json({
      success: true,
      transactionHash: transactionHashes[transactionHashes.length - 1],
      message: `Successfully spent ${formatUnits(amount, 6)} USDC from user account`,
      spentAmount: formatUnits(amount, 6),
    });

  } catch (error) {
    console.error('Demo spend failed:', error);
    return NextResponse.json(
      { error: 'Failed to execute spend: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
