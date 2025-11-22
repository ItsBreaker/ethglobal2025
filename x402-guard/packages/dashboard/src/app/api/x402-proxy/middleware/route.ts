import { Network } from "x402-next";
import { Address, parseUnits, createPublicClient, createWalletClient, http, Hex } from "viem";
import { NextRequest, NextResponse } from "next/server";
import { polygon, polygonAmoy, baseSepolia, base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "viem";
import { GUARD_ABI } from "@/lib/contracts";

// EIP-3009 receiveWithAuthorization ABI
const EIP3009_ABI = [
  {
    "inputs": [
      { "name": "from", "type": "address" },
      { "name": "to", "type": "address" },
      { "name": "value", "type": "uint256" },
      { "name": "validAfter", "type": "uint256" },
      { "name": "validBefore", "type": "uint256" },
      { "name": "nonce", "type": "bytes32" },
      { "name": "v", "type": "uint8" },
      { "name": "r", "type": "bytes32" },
      { "name": "s", "type": "bytes32" }
    ],
    "name": "receiveWithAuthorization",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// Configuration
const PROXY_ADDRESS = process.env.NEXT_PUBLIC_PROXY_ADDRESS as Address;
const GUARD_ADDRESS = process.env.GUARD_ADDRESS as Address;
const PRIVATE_KEY = process.env.DEMO_SPENDER_PRIVATE_KEY as `0x${string}`;
const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base mainnet
const USDC_POLYGON_MAINNET = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // USDC on Polygon mainnet
const USDC_POLYGON_AMOY = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"; // USDC on Polygon Amoy testnet

const payTo = PROXY_ADDRESS;

/**
 * Helper: Parse target x402 response
 */
interface X402PaymentDetails {
  network: string;
  token: string;
  amount: string;
  payTo: Address;
}

function parseX402Response(body: any): X402PaymentDetails | null {
  try {
    // Support both CoinAPI format and standard x402 format
    const accept = body.accepts?.[0] || body.payment;
    if (!accept) return null;

    return {
      network: accept.network || 'polygon',
      token: accept.asset || accept.token || 'USDC',
      amount: accept.amount || accept.maxAmountRequired || '0.01',
      payTo: accept.payTo as Address,
    };
  } catch {
    return null;
  }
}

/**
 * Helper: Parse x402 payment payload (EIP-3009 signature)
 */
interface X402PaymentPayload {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
  v: number;
  r: Hex;
  s: Hex;
}

function parseX402PaymentPayload(paymentHeader: string): X402PaymentPayload | null {
  try {
    const payload = JSON.parse(paymentHeader);

    // x402 payment payload structure
    const auth = payload.payload?.authorization || payload.authorization;
    const sig = payload.payload?.signature || payload.signature;

    if (!auth || !sig) {
      console.error('[E2E] Missing authorization or signature in payment payload');
      return null;
    }

    // Parse signature (remove 0x prefix and split into v, r, s)
    const signature = sig.startsWith('0x') ? sig.slice(2) : sig;
    const r = `0x${signature.slice(0, 64)}` as Hex;
    const s = `0x${signature.slice(64, 128)}` as Hex;
    const v = parseInt(signature.slice(128, 130), 16);

    return {
      from: auth.from as Address,
      to: auth.to as Address,
      value: auth.value,
      validAfter: auth.validAfter,
      validBefore: auth.validBefore,
      nonce: auth.nonce as Hex,
      v,
      r,
      s,
    };
  } catch (error) {
    console.error('[E2E] Failed to parse payment payload:', error);
    return null;
  }
}

/**
 * Helper: Check payment with X402Guard
 */
async function checkGuardPayment(amount: string, endpointHash: string): Promise<{
  allowed: boolean;
  needsApproval: boolean;
  reason: string;
}> {
  if (!GUARD_ADDRESS) {
    console.log("[E2E] No guard configured, skipping check");
    return { allowed: true, needsApproval: false, reason: "" };
  }

  try {
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    const result = await publicClient.readContract({
      address: GUARD_ADDRESS,
      abi: GUARD_ABI,
      functionName: "checkPayment",
      args: [parseUnits(amount, 6), endpointHash as `0x${string}`],
    }) as [boolean, boolean, string];

    return {
      allowed: result[0],
      needsApproval: result[1],
      reason: result[2],
    };
  } catch (error) {
    console.error("[E2E] Guard check failed:", error);
    return { allowed: false, needsApproval: false, reason: "Guard check failed" };
  }
}

/**
 * Middleware x402 proxy handler
 * Flow:
 * 1. Request target x402 endpoint
 * 2. Get payment details from target
 * 3. Return 402 with Base payment details
 * 4. On retry with payment signature, use receiveWithAuthorization to pull funds to proxy
 * 5. Submit proof to target
 * 6. Return target's response
 */
const handler = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('target');

  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Missing target parameter' },
      { status: 400 }
    );
  }

  console.log(`[E2E] Processing request for target: ${targetUrl}`);

  try {
    const paymentHeader = request.headers.get('x-payment');

    if (paymentHeader) {
      // ========== STEP 4-7: Payment signature received, consume and process ==========
      console.log('[E2E] Payment signature received, processing...');

      // Parse the payment payload (EIP-3009 signature)
      const paymentPayload = parseX402PaymentPayload(paymentHeader);
      if (!paymentPayload) {
        return NextResponse.json(
          { error: 'Invalid payment payload' },
          { status: 400 }
        );
      }

      console.log('[E2E] Payment payload parsed:', {
        from: paymentPayload.from,
        to: paymentPayload.to,
        value: paymentPayload.value,
      });

      // Verify that payment is to our proxy
      if (paymentPayload.to.toLowerCase() !== PROXY_ADDRESS.toLowerCase()) {
        console.error('[E2E] Payment not addressed to proxy');
        return NextResponse.json(
          { error: 'Payment not addressed to proxy' },
          { status: 400 }
        );
      }

      // Fetch target payment details
      const targetRes = await fetch(targetUrl);
      if (targetRes.status !== 402) {
        console.error('[E2E] Target did not return 402');
        return NextResponse.json(
          { error: 'Target endpoint configuration error' },
          { status: 500 }
        );
      }

      const targetBody = await targetRes.json();
      const targetPayment = parseX402Response(targetBody);

      if (!targetPayment) {
        console.error('[E2E] Failed to parse target payment details');
        return NextResponse.json(
          { error: 'Invalid target payment format' },
          { status: 500 }
        );
      }

      console.log('[E2E] Target payment details:', targetPayment);

      // Check with X402Guard if configured
      if (GUARD_ADDRESS) {
        const endpointHash = `0x${Buffer.from(targetUrl).toString('hex').padStart(64, '0')}` as `0x${string}`;
        const guardCheck = await checkGuardPayment(targetPayment.amount, endpointHash);

        if (!guardCheck.allowed) {
          console.error(`[E2E] Payment blocked by guard: ${guardCheck.reason}`);
          return NextResponse.json(
            { error: `Payment blocked: ${guardCheck.reason}` },
            { status: 403 }
          );
        }

        if (guardCheck.needsApproval) {
          console.log('[E2E] Payment requires owner approval');
          return NextResponse.json(
            {
              error: 'Payment requires owner approval',
              needsApproval: true
            },
            { status: 402 }
          );
        }
      }

      // ========== STEP 4: Use receiveWithAuthorization to pull funds to proxy ==========
      console.log('[E2E] Calling receiveWithAuthorization to collect payment...');

      const walletClient = createWalletClient({
        account: privateKeyToAccount(PRIVATE_KEY),
        chain: base,
        transport: http(),
      });

      let receiveHash: `0x${string}`;
      try {
        receiveHash = await walletClient.writeContract({
          address: USDC_BASE_MAINNET,
          abi: EIP3009_ABI,
          functionName: 'receiveWithAuthorization',
          args: [
            paymentPayload.from,
            paymentPayload.to,
            BigInt(paymentPayload.value),
            BigInt(paymentPayload.validAfter),
            BigInt(paymentPayload.validBefore),
            paymentPayload.nonce,
            paymentPayload.v,
            paymentPayload.r,
            paymentPayload.s,
          ],
        });

        console.log('[E2E] Payment collected to proxy:', receiveHash);

        // Wait for confirmation
        const publicClient = createPublicClient({
          chain: base,
          transport: http(),
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: receiveHash });
        console.log('[E2E] Payment confirmed:', receipt.status);

        if (receipt.status !== 'success') {
          throw new Error('Payment collection failed');
        }
      } catch (error) {
        console.error('[E2E] Failed to collect payment:', error);
        return NextResponse.json(
          { error: 'Failed to collect payment', details: error instanceof Error ? error.message : String(error) },
          { status: 500 }
        );
      }





      // ========== STEP 5: Submit payment proof to target ==========
      const proof = JSON.stringify({
        receiveTxHash: receiveHash,
        from: PROXY_ADDRESS,
        to: targetPayment.payTo,
        amount: targetPayment.amount,
        timestamp: Date.now(),
      });

      console.log('[E2E] Submitting payment proof to target...');

      const finalRes = await fetch(targetUrl, {
        headers: { 'X-Payment': proof },
      });

      if (!finalRes.ok) {
        console.error(`[E2E] Target rejected payment proof: ${finalRes.status}`);
        return NextResponse.json(
          { error: 'Target rejected payment proof', status: finalRes.status },
          { status: 502 }
        );
      }

      const finalData = await finalRes.json();
      console.log('[E2E] Success! Returning target response');

      // Return target response to user
      return NextResponse.json({
        success: true,
        data: finalData,
        proof: {
          receiveTxHash: receiveHash,
        },
      });

    } else {
      // ========== STEP 1-3: Initial request, get payment details ==========
      console.log('[E2E] Initial request, fetching target...');

      const res = await fetch(targetUrl);
      console.log(`[E2E] Target response status: ${res.status}`);

      if (res.status !== 402) {
        // Target doesn't require payment, just proxy the response
        const data = await res.json();
        console.log('[E2E] Target does not require payment, proxying response');
        return NextResponse.json(data);
      }

      // Parse target's payment requirements
      const body = await res.json();
      const targetPayment = parseX402Response(body);

      if (!targetPayment) {
        console.error('[E2E] Failed to parse target payment requirements');
        return NextResponse.json(
          { error: 'Invalid x402 response from target' },
          { status: 502 }
        );
      }

      console.log('[E2E] Target requires payment:', targetPayment);

      // Check with X402Guard if configured
      if (GUARD_ADDRESS) {
        const endpointHash = `0x${Buffer.from(targetUrl).toString('hex').padStart(64, '0')}` as `0x${string}`;
        const guardCheck = await checkGuardPayment(targetPayment.amount, endpointHash);

        if (!guardCheck.allowed) {
          console.error(`[E2E] Payment would be blocked by guard: ${guardCheck.reason}`);
          return NextResponse.json(
            { error: `Payment not allowed: ${guardCheck.reason}` },
            { status: 403 }
          );
        }

        if (guardCheck.needsApproval) {
          console.log('[E2E] Payment will require owner approval');
        }
      }

      // ========== STEP 3: Return 402 with Base payment details ==========
      console.log('[E2E] Returning 402 with Base payment details');

      return NextResponse.json({
        type: 'payment-required',
        message: `Payment required for ${targetUrl}`,
        targetPayment: targetPayment,
        payment: {
          network: 'base',
          token: 'USDC',
          amount: targetPayment.amount,
          payTo: payTo,
        },
      }, { status: 402 });
    }
  } catch (err) {
    console.error('[E2E] Error:', err);
    return NextResponse.json(
      {
        error: 'Internal proxy error',
        details: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    );
  }
};




// Export as standard GET handler (no withX402 wrapper)
export const GET = handler;
