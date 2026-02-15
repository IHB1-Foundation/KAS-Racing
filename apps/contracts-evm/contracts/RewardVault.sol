// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title RewardVault — FreeRun reward payout + Proof-of-Action registry
/// @notice Server (operator) calls payReward() to send KAS to players
/// @dev Uses (sessionId, seq) composite key for idempotent payouts
contract RewardVault is Ownable, ReentrancyGuard, Pausable {
    // ─── State ───────────────────────────────────────────────────
    mapping(address => bool) public operators;
    mapping(bytes32 => bool) public paidKeys; // keccak256(sessionId, seq) → paid

    uint256 public minReward;
    uint256 public maxRewardPerTx;
    uint256 public totalPaid;
    uint256 public totalPayouts;

    // ─── Events ──────────────────────────────────────────────────
    event RewardPaid(
        bytes32 indexed sessionId,
        uint256 indexed seq,
        address indexed recipient,
        uint256 amount,
        bytes32 proofHash
    );

    event ProofRecorded(
        bytes32 indexed sessionId,
        uint256 indexed seq,
        bytes32 proofHash,
        bytes payload
    );

    event Funded(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event OperatorUpdated(address indexed operator, bool status);

    // ─── Errors ──────────────────────────────────────────────────
    error NotOperator();
    error AlreadyPaid();
    error BelowMinReward();
    error AboveMaxReward();
    error InsufficientBalance();
    error TransferFailed();
    error ZeroAddress();

    // ─── Modifiers ───────────────────────────────────────────────
    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) revert NotOperator();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────
    constructor(uint256 _minReward, uint256 _maxRewardPerTx) Ownable(msg.sender) {
        minReward = _minReward;
        maxRewardPerTx = _maxRewardPerTx;
        operators[msg.sender] = true;
    }

    // ─── Admin ───────────────────────────────────────────────────
    function setOperator(address operator, bool status) external onlyOwner {
        operators[operator] = status;
        emit OperatorUpdated(operator, status);
    }

    function setMinReward(uint256 _minReward) external onlyOwner {
        minReward = _minReward;
    }

    function setMaxRewardPerTx(uint256 _maxRewardPerTx) external onlyOwner {
        maxRewardPerTx = _maxRewardPerTx;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Owner can withdraw excess funds
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        if (amount > address(this).balance) revert InsufficientBalance();
        emit Withdrawn(msg.sender, amount);
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // ─── Core ────────────────────────────────────────────────────

    /// @notice Fund the vault with KAS
    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Operator pays a reward to a player
    /// @param sessionId The game session identifier
    /// @param seq The checkpoint sequence number within the session
    /// @param recipient The player's address
    /// @param amount The reward amount in wei
    /// @param proofHash Hash of the game event data (for on-chain proof)
    /// @param payload Raw event data (stored in event log for verification)
    function payReward(
        bytes32 sessionId,
        uint256 seq,
        address recipient,
        uint256 amount,
        bytes32 proofHash,
        bytes calldata payload
    ) external onlyOperator nonReentrant whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount < minReward) revert BelowMinReward();
        if (amount > maxRewardPerTx) revert AboveMaxReward();
        if (address(this).balance < amount) revert InsufficientBalance();

        bytes32 idempotencyKey = keccak256(abi.encodePacked(sessionId, seq));
        if (paidKeys[idempotencyKey]) revert AlreadyPaid();

        paidKeys[idempotencyKey] = true;
        totalPaid += amount;
        totalPayouts += 1;

        emit RewardPaid(sessionId, seq, recipient, amount, proofHash);

        if (payload.length > 0) {
            emit ProofRecorded(sessionId, seq, proofHash, payload);
        }

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // ─── Views ───────────────────────────────────────────────────

    /// @notice Check if a reward has already been paid for (sessionId, seq)
    function isPaid(bytes32 sessionId, uint256 seq) external view returns (bool) {
        return paidKeys[keccak256(abi.encodePacked(sessionId, seq))];
    }

    /// @notice Get vault balance
    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
