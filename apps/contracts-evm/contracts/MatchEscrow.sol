// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title MatchEscrow — Duel escrow with deposit, settlement, and timeout refund
/// @notice Manages 1v1 match lifecycle: create → deposit → settle/refund
/// @dev operator = server wallet that creates matches and triggers settlements
contract MatchEscrow is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────
    enum MatchState {
        Created,       // match created, waiting for deposits
        Funded,        // both players deposited
        Settled,       // winner paid out
        Refunded,      // both players refunded (timeout or cancel)
        Cancelled      // cancelled before both deposits
    }

    struct Match {
        address player1;
        address player2;
        uint256 depositAmount;
        uint256 timeoutBlock;
        MatchState state;
        bool player1Deposited;
        bool player2Deposited;
    }

    // ─── State ───────────────────────────────────────────────────
    IERC20 public immutable fuelToken;
    mapping(bytes32 => Match) public matches;
    mapping(address => bool) public operators;
    uint256 public minDeposit;
    uint256 public timeoutBlocks;

    // ─── Events ──────────────────────────────────────────────────
    event MatchCreated(bytes32 indexed matchId, address player1, address player2, uint256 depositAmount, uint256 timeoutBlock);
    event Deposited(bytes32 indexed matchId, address indexed player, uint256 amount);
    event MatchFunded(bytes32 indexed matchId);
    event Settled(bytes32 indexed matchId, address indexed winner, uint256 payout);
    event Draw(bytes32 indexed matchId, address player1, address player2, uint256 refundEach);
    event Refunded(bytes32 indexed matchId, address indexed player, uint256 amount);
    event MatchCancelled(bytes32 indexed matchId);
    event OperatorUpdated(address indexed operator, bool status);

    // ─── Errors ──────────────────────────────────────────────────
    error NotOperator();
    error MatchExists();
    error MatchNotFound();
    error InvalidState(MatchState current, MatchState expected);
    error NotPlayer();
    error AlreadyDeposited();
    error InvalidWinner();
    error ZeroAddress();

    // ─── Modifiers ───────────────────────────────────────────────
    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) revert NotOperator();
        _;
    }

    modifier matchExists(bytes32 matchId) {
        if (matches[matchId].player1 == address(0)) revert MatchNotFound();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────
    constructor(address _fuelToken, uint256 _minDeposit, uint256 _timeoutBlocks) Ownable(msg.sender) {
        if (_fuelToken == address(0)) revert ZeroAddress();

        fuelToken = IERC20(_fuelToken);
        minDeposit = _minDeposit;
        timeoutBlocks = _timeoutBlocks;
        operators[msg.sender] = true;
    }

    // ─── Admin ───────────────────────────────────────────────────
    function setOperator(address operator, bool status) external onlyOwner {
        operators[operator] = status;
        emit OperatorUpdated(operator, status);
    }

    function setMinDeposit(uint256 _minDeposit) external onlyOwner {
        minDeposit = _minDeposit;
    }

    function setTimeoutBlocks(uint256 _timeoutBlocks) external onlyOwner {
        timeoutBlocks = _timeoutBlocks;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Match Lifecycle ─────────────────────────────────────────

    /// @notice Operator creates a match between two players
    function createMatch(
        bytes32 matchId,
        address player1,
        address player2,
        uint256 depositAmount
    ) external onlyOperator whenNotPaused {
        if (matches[matchId].player1 != address(0)) revert MatchExists();
        require(player1 != address(0) && player2 != address(0), "Zero address");
        require(player1 != player2, "Same player");
        require(depositAmount >= minDeposit, "Below min deposit");

        matches[matchId] = Match({
            player1: player1,
            player2: player2,
            depositAmount: depositAmount,
            timeoutBlock: block.number + timeoutBlocks,
            state: MatchState.Created,
            player1Deposited: false,
            player2Deposited: false
        });

        emit MatchCreated(matchId, player1, player2, depositAmount, block.number + timeoutBlocks);
    }

    /// @notice Player deposits their stake
    function deposit(bytes32 matchId) external nonReentrant whenNotPaused matchExists(matchId) {
        Match storage m = matches[matchId];

        if (m.state != MatchState.Created) revert InvalidState(m.state, MatchState.Created);

        if (msg.sender == m.player1) {
            if (m.player1Deposited) revert AlreadyDeposited();
            m.player1Deposited = true;
        } else if (msg.sender == m.player2) {
            if (m.player2Deposited) revert AlreadyDeposited();
            m.player2Deposited = true;
        } else {
            revert NotPlayer();
        }

        uint256 amount = m.depositAmount;
        fuelToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(matchId, msg.sender, amount);

        if (m.player1Deposited && m.player2Deposited) {
            m.state = MatchState.Funded;
            emit MatchFunded(matchId);
        }
    }

    /// @notice Operator settles the match — winner gets both deposits
    /// @param winner Must be player1 or player2 (theft-resistant)
    function settle(
        bytes32 matchId,
        address winner
    ) external onlyOperator nonReentrant matchExists(matchId) {
        Match storage m = matches[matchId];

        if (m.state != MatchState.Funded) revert InvalidState(m.state, MatchState.Funded);
        if (winner != m.player1 && winner != m.player2) revert InvalidWinner();

        m.state = MatchState.Settled;
        uint256 payout = m.depositAmount * 2;

        emit Settled(matchId, winner, payout);

        fuelToken.safeTransfer(winner, payout);
    }

    /// @notice Operator declares a draw — both players get refunded
    function settleDraw(bytes32 matchId) external onlyOperator nonReentrant matchExists(matchId) {
        Match storage m = matches[matchId];

        if (m.state != MatchState.Funded) revert InvalidState(m.state, MatchState.Funded);

        m.state = MatchState.Settled;
        uint256 refundEach = m.depositAmount;

        emit Draw(matchId, m.player1, m.player2, refundEach);

        fuelToken.safeTransfer(m.player1, refundEach);
        fuelToken.safeTransfer(m.player2, refundEach);
    }

    /// @notice Any player can reclaim their deposit after timeout
    function refund(bytes32 matchId) external nonReentrant matchExists(matchId) {
        Match storage m = matches[matchId];

        require(
            m.state == MatchState.Created || m.state == MatchState.Funded,
            "Not refundable"
        );
        require(block.number >= m.timeoutBlock, "Timeout not reached");

        if (msg.sender != m.player1 && msg.sender != m.player2) revert NotPlayer();

        uint256 refundAmount = 0;

        if (msg.sender == m.player1 && m.player1Deposited) {
            m.player1Deposited = false;
            refundAmount = m.depositAmount;
        } else if (msg.sender == m.player2 && m.player2Deposited) {
            m.player2Deposited = false;
            refundAmount = m.depositAmount;
        }

        require(refundAmount > 0, "Nothing to refund");

        // If both refunded, mark as refunded
        if (!m.player1Deposited && !m.player2Deposited) {
            m.state = MatchState.Refunded;
        }

        emit Refunded(matchId, msg.sender, refundAmount);

        fuelToken.safeTransfer(msg.sender, refundAmount);
    }

    /// @notice Operator can cancel a match before it's fully funded
    function cancel(bytes32 matchId) external onlyOperator matchExists(matchId) {
        Match storage m = matches[matchId];

        if (m.state != MatchState.Created) revert InvalidState(m.state, MatchState.Created);

        m.state = MatchState.Cancelled;

        // Refund any deposited amounts
        if (m.player1Deposited) {
            m.player1Deposited = false;
            fuelToken.safeTransfer(m.player1, m.depositAmount);
            emit Refunded(matchId, m.player1, m.depositAmount);
        }
        if (m.player2Deposited) {
            m.player2Deposited = false;
            fuelToken.safeTransfer(m.player2, m.depositAmount);
            emit Refunded(matchId, m.player2, m.depositAmount);
        }

        emit MatchCancelled(matchId);
    }

    // ─── Views ───────────────────────────────────────────────────

    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    function getMatchState(bytes32 matchId) external view returns (MatchState) {
        return matches[matchId].state;
    }

    function isDeposited(bytes32 matchId, address player) external view returns (bool) {
        Match storage m = matches[matchId];
        if (player == m.player1) return m.player1Deposited;
        if (player == m.player2) return m.player2Deposited;
        return false;
    }
}
