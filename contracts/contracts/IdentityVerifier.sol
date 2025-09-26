// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract IdentityVerifier is Ownable {
    mapping(address => bool) private _verified;

    event UserVerified(address indexed user, bool status);

    constructor() Ownable(msg.sender) {}

    // Day 5: replace this with Self zk verification call.
    function verifyIdentity(bytes calldata /*zkProof*/) external {
        _verified[msg.sender] = true;
        emit UserVerified(msg.sender, true);
    }

    function adminSetVerified(address user, bool ok) external onlyOwner {
        _verified[user] = ok;
        emit UserVerified(user, ok);
    }

    function isVerified(address user) external view returns (bool) {
        return _verified[user];
    }
}
