
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Placeholder. Day 5 we'll connect Self Protocol proof verification.
contract IdentityVerifier {
    mapping(address => bool) public verifiedHuman;

    event UserVerified(address indexed user);

    function adminMarkVerified(address user, bool ok) external {
        verifiedHuman[user] = ok;
        if (ok) emit UserVerified(user);
    }
}
