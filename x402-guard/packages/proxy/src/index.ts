import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// ABI for X402Guard (minimal interface we need)
const GUARD_ABI = [
  "function checkPayment(uint256 amount, bytes32 endpointHash) view returns (bool allowed, bool needsApproval, string reason)",
  "function executePayment(address to, uint256 amount, bytes32 endpointHash) returns (bool success, uint256 paymentId)",
  "function getBalance() view returns (uint256)",
  "function dailySpent() view returns (uint256)",
  "function dailyLimit() view returns (uint256)",
  "function maxPerTransaction() view returns (uint256)",
  "function approvalThreshold() view returns (uint256)",
  "function getRemainingDailyBudget() view returns (uint256)",
  "function agent() view returns (address)",
  "function owner() view returns (address)",
] as const;

const app = express();
app.use(cors());
app.use(express.json());

// Provider and wallet setup
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:8545");
const agentWallet = process.env.AGENT_PRIVATE_KEY 
  ? new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider)
  : null;

// ============ Types ============

interface X402PaymentRequired {
  amount: string;
  token: string;
  address: string;
  network: string;
}

interface ProxyRequest extends Request {
  guardAddress?: string;
  targetUrl?: string;
}

// ============ Helper ============

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getGuardContract(address: string, signerOrProvider?: ethers.Wallet | ethers.JsonRpcProvider): any {
  return new ethers.Contract(address, GUARD_ABI, signerOrProvider || provider);
}

// ============ Middleware ============

/**
 * Parse the proxy URL format:
 * /guard/{guardAddress}/{targetHost}/{path}
 * 
 * Example:
 * /guard/0x1234.../api.openai.com/v1/chat/completions
 */
function parseProxyUrl(req: ProxyRequest, res: Response, next: NextFunction) {
  const path = req.path;
  
  // Expected format: /guard/{guardAddress}/{targetHost}/...
  const match = path.match(/^\/guard\/(0x[a-fA-F0-9]{40})\/([^\/]+)(\/.*)?$/);
  
  if (!match) {
    return res.status(400).json({
      error: "invalid_url",
      message: "URL must be in format: /guard/{guardAddress}/{targetHost}/{path}",
      example: "/guard/0x1234.../api.example.com/v1/endpoint"
    });
  }

  req.guardAddress = match[1];
  const targetHost = match[2];
  const targetPath = match[3] || "/";
  req.targetUrl = `https://${targetHost}${targetPath}`;

  next();
}

// ============ Routes ============

/**
 * Health check
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Get guard wallet info
 */
app.get("/guard/:guardAddress/info", async (req, res) => {
  try {
    const { guardAddress } = req.params;
    const guard = getGuardContract(guardAddress);

    const [balance, dailySpent, dailyLimit, maxPerTx, approvalThreshold, remaining, agent, owner] = 
      await Promise.all([
        guard.getBalance(),
        guard.dailySpent(),
        guard.dailyLimit(),
        guard.maxPerTransaction(),
        guard.approvalThreshold(),
        guard.getRemainingDailyBudget(),
        guard.agent(),
        guard.owner(),
      ]);

    res.json({
      address: guardAddress,
      balance: ethers.formatUnits(balance, 6),
      dailySpent: ethers.formatUnits(dailySpent, 6),
      dailyLimit: ethers.formatUnits(dailyLimit, 6),
      remainingDailyBudget: ethers.formatUnits(remaining, 6),
      maxPerTransaction: ethers.formatUnits(maxPerTx, 6),
      approvalThreshold: ethers.formatUnits(approvalThreshold, 6),
      agent,
      owner,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: "contract_error", message });
  }
});

/**
 * Check if a payment would be allowed
 */
app.post("/guard/:guardAddress/check", async (req, res) => {
  try {
    const { guardAddress } = req.params;
    const { amount, endpoint } = req.body;

    if (!amount || !endpoint) {
      return res.status(400).json({ 
        error: "missing_params", 
        message: "Required: amount, endpoint" 
      });
    }

    const guard = getGuardContract(guardAddress);
    const amountWei = ethers.parseUnits(amount.toString(), 6);
    const endpointHash = ethers.keccak256(ethers.toUtf8Bytes(endpoint));

    const [allowed, needsApproval, reason] = await guard.checkPayment(amountWei, endpointHash);

    res.json({
      allowed,
      needsApproval,
      reason: reason || null,
      amount,
      endpoint,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: "contract_error", message });
  }
});

/**
 * Main proxy endpoint
 * Forwards requests to target API, handles x402 payments
 */
app.all("/guard/:guardAddress/*", parseProxyUrl, async (req: ProxyRequest, res) => {
  const { guardAddress, targetUrl } = req as { guardAddress: string; targetUrl: string };
  
  console.log(`\n📨 Proxy request:`);
  console.log(`   Guard: ${guardAddress}`);
  console.log(`   Target: ${targetUrl}`);
  console.log(`   Method: ${req.method}`);

  try {
    // Build headers for target request
    const targetHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (req.headers.authorization) {
      targetHeaders["Authorization"] = req.headers.authorization as string;
    }

    // Step 1: Forward request to target API
    const targetResponse = await fetch(targetUrl, {
      method: req.method,
      headers: targetHeaders,
      body: ["POST", "PUT", "PATCH"].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });

    console.log(`   Target response: ${targetResponse.status}`);

    // Step 2: If not 402, just forward the response
    if (targetResponse.status !== 402) {
      const contentType = targetResponse.headers.get("content-type");
      
      if (contentType?.includes("application/json")) {
        const data = await targetResponse.json();
        return res.status(targetResponse.status).json(data);
      } else {
        const text = await targetResponse.text();
        return res.status(targetResponse.status).send(text);
      }
    }

    // Step 3: Handle 402 Payment Required
    console.log(`   💰 Payment required!`);
    
    const paymentInfo = await targetResponse.json() as X402PaymentRequired;
    console.log(`   Amount: ${paymentInfo.amount} ${paymentInfo.token}`);
    console.log(`   Pay to: ${paymentInfo.address}`);

    // Step 4: Check if payment is allowed by guard policy
    const guard = getGuardContract(guardAddress);
    const amountWei = ethers.parseUnits(paymentInfo.amount, 6);
    const endpointHash = ethers.keccak256(ethers.toUtf8Bytes(targetUrl));

    const [allowed, needsApproval, reason] = await guard.checkPayment(amountWei, endpointHash);

    if (!allowed) {
      console.log(`   ❌ Payment blocked: ${reason}`);
      return res.status(403).json({
        error: "x402_guard_policy_violation",
        reason,
        requested: {
          amount: paymentInfo.amount,
          endpoint: targetUrl,
        },
        policy: {
          maxPerTransaction: ethers.formatUnits(await guard.maxPerTransaction(), 6),
          dailyLimit: ethers.formatUnits(await guard.dailyLimit(), 6),
          remainingDailyBudget: ethers.formatUnits(await guard.getRemainingDailyBudget(), 6),
        },
      });
    }

    if (needsApproval) {
      console.log(`   ⏳ Payment requires approval`);
      // In a full implementation, we'd queue this and notify the owner
      return res.status(202).json({
        status: "pending_approval",
        message: "Payment exceeds approval threshold. Owner must approve.",
        requested: {
          amount: paymentInfo.amount,
          endpoint: targetUrl,
        },
      });
    }

    // Step 5: Execute payment via guard contract
    if (!agentWallet) {
      return res.status(500).json({
        error: "configuration_error",
        message: "Agent wallet not configured on proxy server",
      });
    }

    console.log(`   ✅ Policy check passed, executing payment...`);
    
    const guardWithSigner = getGuardContract(guardAddress, agentWallet);
    
    try {
      const tx = await guardWithSigner.executePayment(
        paymentInfo.address,
        amountWei,
        endpointHash
      );
      const receipt = await tx.wait();
      console.log(`   💸 Payment executed: ${receipt?.hash}`);
    } catch (paymentError: unknown) {
      const message = paymentError instanceof Error ? paymentError.message : "Unknown error";
      console.log(`   ❌ Payment failed: ${message}`);
      return res.status(500).json({
        error: "payment_failed",
        message,
      });
    }

    // Step 6: Retry the original request with payment proof
    // In a real x402 implementation, we'd include the X-PAYMENT header
    // For this demo, we'll simulate the API accepting the payment
    console.log(`   🔄 Retrying request after payment...`);
    
    const retryHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "X-PAYMENT": "payment-proof-would-go-here", // Simplified for demo
    };
    if (req.headers.authorization) {
      retryHeaders["Authorization"] = req.headers.authorization as string;
    }

    const retriedResponse = await fetch(targetUrl, {
      method: req.method,
      headers: retryHeaders,
      body: ["POST", "PUT", "PATCH"].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });

    const finalData = await retriedResponse.json() as Record<string, unknown>;
    console.log(`   ✅ Request completed`);
    
    res.status(retriedResponse.status).json({
      ...finalData,
      _x402Guard: {
        paymentExecuted: true,
        amount: paymentInfo.amount,
        guardAddress,
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`   ❌ Error:`, message);
    res.status(500).json({
      error: "proxy_error",
      message,
    });
  }
});

// ============ Mock x402 API for Testing ============

/**
 * A mock API endpoint that returns 402 and accepts payment
 * Use this for local testing
 */
let mockApiPaid = false;

app.all("/mock-api/*", (req, res) => {
  const paymentHeader = req.headers["x-payment"];
  
  if (paymentHeader || mockApiPaid) {
    mockApiPaid = false; // Reset for next request
    return res.json({
      success: true,
      message: "Here's your data!",
      data: {
        weather: "sunny",
        temperature: 72,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Return 402 Payment Required
  mockApiPaid = true; // Will accept next request
  res.status(402).json({
    amount: "0.50",
    token: "USDC",
    address: "0x0000000000000000000000000000000000000001", // Mock recipient
    network: "base",
  });
});

// ============ Start Server ============

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n🛡️  x402-Guard Proxy Server`);
  console.log(`   Running on: http://localhost:${PORT}`);
  console.log(`\n   Endpoints:`);
  console.log(`   - GET  /health`);
  console.log(`   - GET  /guard/{address}/info`);
  console.log(`   - POST /guard/{address}/check`);
  console.log(`   - ALL  /guard/{address}/{targetHost}/{path}`);
  console.log(`   - ALL  /mock-api/* (for testing)`);
  console.log(`\n   Example usage:`);
  console.log(`   curl http://localhost:${PORT}/guard/0x.../api.example.com/v1/data`);
  console.log("");
});