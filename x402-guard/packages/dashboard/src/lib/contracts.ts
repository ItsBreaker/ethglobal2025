// Contract ABIs and addresses
// Update these after deployment

export const CONTRACTS = {
  84532: {
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
};

export const GUARD_ABI = [
  // Read functions
  "function owner() view returns (address)",
  "function agent() view returns (address)",
  "function usdc() view returns (address)",
  "function maxPerTransaction() view returns (uint256)",
  "function dailyLimit() view returns (uint256)",
  "function approvalThreshold() view returns (uint256)",
  "function dailySpent() view returns (uint256)",
  "function totalSpent() view returns (uint256)",
  "function allowAllEndpoints() view returns (bool)",
  "function getBalance() view returns (uint256)",
  "function getRemainingDailyBudget() view returns (uint256)",
  "function getTimeUntilReset() view returns (uint256)",
  "function allowedEndpoints(bytes32) view returns (bool)",
  "function isEndpointAllowed(bytes32 endpointHash) view returns (bool)",
  "function isEndpointAllowedByUrl(string url) view returns (bool)",
  "function checkPayment(uint256 amount, bytes32 endpointHash) view returns (bool allowed, bool needsApproval, string reason)",
  "function getPendingPayment(uint256 paymentId) view returns (tuple(address to, uint256 amount, bytes32 endpointHash, uint256 expiry, bool executed, bool rejected))",

  // Write functions
  "function setPolicy(uint256 maxPerTransaction, uint256 dailyLimit, uint256 approvalThreshold)",
  "function setAgent(address agent)",
  "function setEndpointAllowed(bytes32 endpointHash, bool allowed)",
  "function setEndpointAllowedByUrl(string url, bool allowed)",
  "function setAllowAllEndpoints(bool allowAll)",
  "function approvePayment(uint256 paymentId)",
  "function rejectPayment(uint256 paymentId)",
  "function fund(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function withdrawAll()",
  "function executePayment(address to, uint256 amount, bytes32 endpointHash) returns (bool success, uint256 paymentId)",

  // Events
  "event PolicyUpdated(uint256 maxPerTx, uint256 dailyLimit, uint256 approvalThreshold)",
  "event AgentUpdated(address indexed oldAgent, address indexed newAgent)",
  "event EndpointAllowed(bytes32 indexed endpointHash, bool allowed)",
  "event AllEndpointsToggled(bool allowAll)",
  "event PaymentExecuted(address indexed to, uint256 amount, bytes32 indexed endpointHash, uint256 dailySpentAfter)",
  "event PaymentBlocked(address indexed to, uint256 amount, bytes32 indexed endpointHash, string reason)",
  "event PaymentQueued(uint256 indexed paymentId, address indexed to, uint256 amount, bytes32 indexed endpointHash)",
  "event PaymentApproved(uint256 indexed paymentId)",
  "event PaymentRejected(uint256 indexed paymentId)",
  "event Funded(address indexed from, uint256 amount)",
  "event Withdrawn(address indexed to, uint256 amount)",
] as const;

export const FACTORY_ABI = [
  "function usdc() view returns (address)",
  "function createGuard(address agent, uint256 maxPerTransaction, uint256 dailyLimit, uint256 approvalThreshold) returns (address guard)",
  "function getGuardsByOwner(address owner) view returns (address[])",
  "function getGuardCount() view returns (uint256)",
  "function getAllGuards() view returns (address[])",
  "event GuardCreated(address indexed guard, address indexed owner, address indexed agent, uint256 maxPerTransaction, uint256 dailyLimit, uint256 approvalThreshold)",
] as const;

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;
