// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract IdentityVerifier is Ownable {
    // direct flag (admin-attested or proven via merkle)
    mapping(address => bool) public verifiedHuman;

    // optional Merkle allowlist root of verified addresses
    bytes32 public merkleRoot;

    event UserVerified(address indexed user, bool verified);
    event MerkleRootUpdated(bytes32 root);

    constructor(address _owner) Ownable(_owner) {}

    // -------- Path 1: admin attestation (hackathon-simple) --------
    function setVerified(address user, bool v) external onlyOwner {
        verifiedHuman[user] = v;
        emit UserVerified(user, v);
    }

    // -------- Path 2: Merkle allowlist (users self-serve after you update root) --------
    function setMerkleRoot(bytes32 root) external onlyOwner {
        merkleRoot = root;
        emit MerkleRootUpdated(root);
    }

    /// @notice Proves msg.sender is included in the current merkleRoot.
    function prove(bytes32[] calldata proof) external {
        require(merkleRoot != bytes32(0), "root not set");
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        bool ok = MerkleProof.verify(proof, merkleRoot, leaf);
        require(ok, "invalid proof");
        verifiedHuman[msg.sender] = true;
        emit UserVerified(msg.sender, true);
    }

    // -------- View API consumed by LendingPool --------
    function isVerified(address user) external view returns (bool) {
        return verifiedHuman[user];
    }
}
