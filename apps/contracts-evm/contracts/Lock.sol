// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Lock — Placeholder contract for workspace validation
/// @notice Will be replaced by MatchEscrow and RewardVault in T-311/T-312
contract Lock {
    uint256 public unlockTime;
    address payable public owner;

    event Withdrawal(uint256 amount, uint256 when);

    constructor(uint256 _unlockTime) payable {
        require(block.timestamp < _unlockTime, "Unlock time must be in the future");
        unlockTime = _unlockTime;
        owner = payable(msg.sender);
    }

    function withdraw() public {
        require(block.timestamp >= unlockTime, "Too early");
        require(msg.sender == owner, "Not the owner");
        emit Withdrawal(address(this).balance, block.timestamp);
        owner.transfer(address(this).balance);
    }
}
