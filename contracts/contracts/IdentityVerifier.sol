// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract IdentityVerifier is Ownable {
    mapping(address => bool) public isVerified;

    event UserVerified(address indexed user, bool verified);

    constructor() Ownable(msg.sender) {}

    // TEMP for hackathon Day-2: admin toggles a user as verified.
    // Day-5 will replace this with Self Protocol proof-based verification.
    function adminSetVerified(address user, bool verified) external onlyOwner {
        isVerified[user] = verified;
        emit UserVerified(user, verified);
    }
}
