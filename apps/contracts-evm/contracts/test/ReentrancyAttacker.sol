// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../MatchEscrow.sol";

/// @title ReentrancyAttacker — Test contract that attempts reentrancy on settle
contract ReentrancyAttacker {
    MatchEscrow public target;
    bytes32 public matchId;
    uint256 public attackCount;

    constructor(address _target) {
        target = MatchEscrow(_target);
    }

    function setMatchId(bytes32 _matchId) external {
        matchId = _matchId;
    }

    function deposit(bytes32 _matchId) external payable {
        target.deposit{value: msg.value}(_matchId);
    }

    // Attempt reentrancy when receiving settlement payout
    receive() external payable {
        attackCount++;
        if (attackCount < 3) {
            // Try to call settle again during payout
            try target.settle(matchId, address(this)) {} catch {}
            // Try to call refund during payout
            try target.refund(matchId) {} catch {}
        }
    }
}
