// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title X402Guard
 * @notice A smart contract wallet with spending policies for x402 payments
 * @dev Owner sets policies, agent executes payments within those limits
 */
contract X402Guard is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public immutable usdc;
    address public agent;

    // Policy settings
    uint256 public maxPerTransaction;    // Max USDC per single payment (6 decimals)
    uint256 public dailyLimit;           // Max USDC per day (6 decimals)
    uint256 public approvalThreshold;    // Require approval above this amount (6 decimals)

    // Spending tracking
    uint256 public dailySpent;
    uint256 public lastResetTimestamp;
    uint256 public totalSpent;

    // Endpoint allowlist (keccak256 hash of endpoint URL => allowed)
    mapping(bytes32 => bool) public allowedEndpoints;
    bool public allowAllEndpoints;

    // Pending approvals
    struct PendingPayment {
        address to;
        uint256 amount;
        bytes32 endpointHash;
        uint256 expiry;
        bool executed;
        bool rejected;
    }
    
    mapping(uint256 => PendingPayment) public pendingPayments;
    uint256 public nextPaymentId;

    // Spending per endpoint (for analytics)
    mapping(bytes32 => uint256) public spentPerEndpoint;

    // ============ Events ============

    event PolicyUpdated(uint256 maxPerTx, uint256 dailyLimit, uint256 approvalThreshold);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);
    event EndpointAllowed(bytes32 indexed endpointHash, bool allowed);
    event AllEndpointsToggled(bool allowAll);
    event PaymentExecuted(
        address indexed to,
        uint256 amount,
        bytes32 indexed endpointHash,
        uint256 dailySpentAfter
    );
    event PaymentBlocked(
        address indexed to,
        uint256 amount,
        bytes32 indexed endpointHash,
        string reason
    );
    event PaymentQueued(
        uint256 indexed paymentId,
        address indexed to,
        uint256 amount,
        bytes32 indexed endpointHash
    );
    event PaymentApproved(uint256 indexed paymentId);
    event PaymentRejected(uint256 indexed paymentId);
    event DailySpendingReset(uint256 timestamp);
    event Funded(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    // ============ Errors ============

    error NotAgent();
    error NotOwnerOrAgent();
    error ExceedsPerTransactionLimit(uint256 requested, uint256 limit);
    error ExceedsDailyLimit(uint256 wouldSpend, uint256 limit);
    error EndpointNotAllowed(bytes32 endpointHash);
    error RequiresApproval(uint256 paymentId);
    error PaymentNotFound(uint256 paymentId);
    error PaymentExpired(uint256 paymentId);
    error PaymentAlreadyExecuted(uint256 paymentId);
    error PaymentAlreadyRejected(uint256 paymentId);
    error InsufficientBalance(uint256 requested, uint256 available);
    error ZeroAddress();
    error ZeroAmount();

    // ============ Modifiers ============

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    modifier onlyOwnerOrAgent() {
        if (msg.sender != owner() && msg.sender != agent) revert NotOwnerOrAgent();
        _;
    }

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _owner,
        address _agent,
        uint256 _maxPerTransaction,
        uint256 _dailyLimit,
        uint256 _approvalThreshold
    ) Ownable(_owner) {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_agent == address(0)) revert ZeroAddress();

        usdc = IERC20(_usdc);
        agent = _agent;
        maxPerTransaction = _maxPerTransaction;
        dailyLimit = _dailyLimit;
        approvalThreshold = _approvalThreshold;
        lastResetTimestamp = block.timestamp;
        allowAllEndpoints = false;
    }

    // ============ Agent Functions ============

    /**
     * @notice Execute a payment (called by agent via proxy)
     * @param to Recipient address
     * @param amount Amount in USDC (6 decimals)
     * @param endpointHash keccak256 hash of the endpoint URL
     * @return success Whether payment was executed immediately
     * @return paymentId If queued for approval, the payment ID (0 if executed)
     */
    function executePayment(
        address to,
        uint256 amount,
        bytes32 endpointHash
    ) external onlyAgent nonReentrant returns (bool success, uint256 paymentId) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        // Reset daily spending if new day
        _resetDailyIfNeeded();

        // Check balance
        uint256 balance = usdc.balanceOf(address(this));
        if (amount > balance) revert InsufficientBalance(amount, balance);

        // Check per-transaction limit
        if (amount > maxPerTransaction) {
            emit PaymentBlocked(to, amount, endpointHash, "Exceeds per-transaction limit");
            revert ExceedsPerTransactionLimit(amount, maxPerTransaction);
        }

        // Check endpoint allowlist
        if (!allowAllEndpoints && !allowedEndpoints[endpointHash]) {
            emit PaymentBlocked(to, amount, endpointHash, "Endpoint not allowed");
            revert EndpointNotAllowed(endpointHash);
        }

        // Check daily limit
        if (dailySpent + amount > dailyLimit) {
            emit PaymentBlocked(to, amount, endpointHash, "Exceeds daily limit");
            revert ExceedsDailyLimit(dailySpent + amount, dailyLimit);
        }

        // Check if needs approval
        if (amount > approvalThreshold) {
            paymentId = _queueForApproval(to, amount, endpointHash);
            revert RequiresApproval(paymentId);
        }

        // Execute transfer
        _executeTransfer(to, amount, endpointHash);
        
        return (true, 0);
    }

    /**
     * @notice Check if a payment would be allowed (view function for proxy)
     */
    function checkPayment(
        uint256 amount,
        bytes32 endpointHash
    ) external view returns (
        bool allowed,
        bool needsApproval,
        string memory reason
    ) {
        // Check balance
        if (amount > usdc.balanceOf(address(this))) {
            return (false, false, "Insufficient balance");
        }

        // Check per-tx limit
        if (amount > maxPerTransaction) {
            return (false, false, "Exceeds per-transaction limit");
        }

        // Check endpoint
        if (!allowAllEndpoints && !allowedEndpoints[endpointHash]) {
            return (false, false, "Endpoint not allowed");
        }

        // Check daily limit (accounting for potential reset)
        uint256 effectiveDailySpent = _shouldResetDaily() ? 0 : dailySpent;
        if (effectiveDailySpent + amount > dailyLimit) {
            return (false, false, "Exceeds daily limit");
        }

        // Check if needs approval
        if (amount > approvalThreshold) {
            return (true, true, "Requires owner approval");
        }

        return (true, false, "");
    }

    // ============ Owner Functions ============

    /**
     * @notice Update spending policies
     */
    function setPolicy(
        uint256 _maxPerTransaction,
        uint256 _dailyLimit,
        uint256 _approvalThreshold
    ) external onlyOwner {
        maxPerTransaction = _maxPerTransaction;
        dailyLimit = _dailyLimit;
        approvalThreshold = _approvalThreshold;
        emit PolicyUpdated(_maxPerTransaction, _dailyLimit, _approvalThreshold);
    }

    /**
     * @notice Update agent address
     */
    function setAgent(address _agent) external onlyOwner {
        if (_agent == address(0)) revert ZeroAddress();
        address oldAgent = agent;
        agent = _agent;
        emit AgentUpdated(oldAgent, _agent);
    }

    /**
     * @notice Allow or disallow an endpoint
     */
    function setEndpointAllowed(bytes32 endpointHash, bool allowed) external onlyOwner {
        allowedEndpoints[endpointHash] = allowed;
        emit EndpointAllowed(endpointHash, allowed);
    }

    /**
     * @notice Allow or disallow an endpoint by URL string
     */
    function setEndpointAllowedByUrl(string calldata url, bool allowed) external onlyOwner {
        bytes32 endpointHash = keccak256(abi.encodePacked(url));
        allowedEndpoints[endpointHash] = allowed;
        emit EndpointAllowed(endpointHash, allowed);
    }

    /**
     * @notice Toggle allowing all endpoints
     */
    function setAllowAllEndpoints(bool _allowAll) external onlyOwner {
        allowAllEndpoints = _allowAll;
        emit AllEndpointsToggled(_allowAll);
    }

    /**
     * @notice Approve a pending payment
     */
    function approvePayment(uint256 paymentId) external onlyOwner nonReentrant {
        PendingPayment storage p = pendingPayments[paymentId];
        
        if (p.to == address(0)) revert PaymentNotFound(paymentId);
        if (p.executed) revert PaymentAlreadyExecuted(paymentId);
        if (p.rejected) revert PaymentAlreadyRejected(paymentId);
        if (block.timestamp > p.expiry) revert PaymentExpired(paymentId);

        p.executed = true;
        _executeTransfer(p.to, p.amount, p.endpointHash);
        
        emit PaymentApproved(paymentId);
    }

    /**
     * @notice Reject a pending payment
     */
    function rejectPayment(uint256 paymentId) external onlyOwner {
        PendingPayment storage p = pendingPayments[paymentId];
        
        if (p.to == address(0)) revert PaymentNotFound(paymentId);
        if (p.executed) revert PaymentAlreadyExecuted(paymentId);
        if (p.rejected) revert PaymentAlreadyRejected(paymentId);

        p.rejected = true;
        emit PaymentRejected(paymentId);
    }

    /**
     * @notice Withdraw USDC from the wallet
     */
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 balance = usdc.balanceOf(address(this));
        if (amount > balance) revert InsufficientBalance(amount, balance);
        
        usdc.safeTransfer(owner(), amount);
        emit Withdrawn(owner(), amount);
    }

    /**
     * @notice Withdraw all USDC from the wallet
     */
    function withdrawAll() external onlyOwner nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();
        
        usdc.safeTransfer(owner(), balance);
        emit Withdrawn(owner(), balance);
    }

    // ============ View Functions ============

    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function getRemainingDailyBudget() external view returns (uint256) {
        uint256 effectiveDailySpent = _shouldResetDaily() ? 0 : dailySpent;
        if (effectiveDailySpent >= dailyLimit) return 0;
        return dailyLimit - effectiveDailySpent;
    }

    function getTimeUntilReset() external view returns (uint256) {
        uint256 nextReset = lastResetTimestamp + 1 days;
        if (block.timestamp >= nextReset) return 0;
        return nextReset - block.timestamp;
    }

    function getPendingPayment(uint256 paymentId) external view returns (PendingPayment memory) {
        return pendingPayments[paymentId];
    }

    function isEndpointAllowed(bytes32 endpointHash) external view returns (bool) {
        return allowAllEndpoints || allowedEndpoints[endpointHash];
    }

    function isEndpointAllowedByUrl(string calldata url) external view returns (bool) {
        bytes32 endpointHash = keccak256(abi.encodePacked(url));
        return allowAllEndpoints || allowedEndpoints[endpointHash];
    }

    // ============ Internal Functions ============

    function _executeTransfer(address to, uint256 amount, bytes32 endpointHash) internal {
        usdc.safeTransfer(to, amount);
        
        dailySpent += amount;
        totalSpent += amount;
        spentPerEndpoint[endpointHash] += amount;
        
        emit PaymentExecuted(to, amount, endpointHash, dailySpent);
    }

    function _queueForApproval(
        address to,
        uint256 amount,
        bytes32 endpointHash
    ) internal returns (uint256 paymentId) {
        paymentId = nextPaymentId++;
        
        pendingPayments[paymentId] = PendingPayment({
            to: to,
            amount: amount,
            endpointHash: endpointHash,
            expiry: block.timestamp + 1 days,
            executed: false,
            rejected: false
        });

        emit PaymentQueued(paymentId, to, amount, endpointHash);
    }

    function _resetDailyIfNeeded() internal {
        if (_shouldResetDaily()) {
            dailySpent = 0;
            lastResetTimestamp = block.timestamp;
            emit DailySpendingReset(block.timestamp);
        }
    }

    function _shouldResetDaily() internal view returns (bool) {
        return block.timestamp >= lastResetTimestamp + 1 days;
    }

    // ============ Receive USDC ============

    /**
     * @notice Fund the wallet by transferring USDC directly
     * @dev Users should approve this contract first, then call fund()
     */
    function fund(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
    }
}
