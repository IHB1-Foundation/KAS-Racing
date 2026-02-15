// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../MatchEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ReentrancyAttacker — Test contract that attempts reentrancy on settle
contract ReentrancyAttacker {
    MatchEscrow public target;
    IERC20 public token;
    bytes32 public matchId;
    uint256 public attackCount;

    constructor(address _target, address _token) {
        target = MatchEscrow(_target);
        token = IERC20(_token);
        token.approve(_target, type(uint256).max);
    }

    function setMatchId(bytes32 _matchId) external {
        matchId = _matchId;
    }

    function deposit(bytes32 _matchId) external {
        target.deposit(_matchId);
    }

    // Attempt reentrancy via explicit calls
    function attemptReenter() external {
        attackCount++;
        if (attackCount < 3) {
            try target.settle(matchId, address(this)) {} catch {}
            try target.refund(matchId) {} catch {}
        }
    }
}
