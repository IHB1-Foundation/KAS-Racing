// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Kas Racing Fuel (kFUEL)
/// @notice Utility token for racing rewards and betting
contract KasRacingFuel is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 10 * 1e18;
    mapping(address => bool) public minters;

    event MinterUpdated(address indexed minter, bool status);

    error NotMinter();
    error ZeroAddress();

    modifier onlyMinter() {
        if (!minters[msg.sender]) revert NotMinter();
        _;
    }

    constructor(uint256 initialSupply, address treasury) ERC20("Kas Racing Fuel", "kFUEL") Ownable(msg.sender) {
        if (treasury == address(0)) revert ZeroAddress();

        minters[msg.sender] = true;
        emit MinterUpdated(msg.sender, true);

        if (initialSupply > 0) {
            _mint(treasury, initialSupply);
        }
    }

    function setMinter(address minter, bool status) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        minters[minter] = status;
        emit MinterUpdated(minter, status);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        if (to == address(0)) revert ZeroAddress();
        _mint(to, amount);
    }

    function faucetMint() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
