// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title CrosschainResolver — HTLC for 1inch LOP integration
/// @notice Minimal HTLC/resolver used as escrow by LOP's fillOrderArgs path.
///   - lockFromLOP: called when an order is filled so tokens are held here
///   - claim: reveal preimage to claim funds
///   - refund: after expiry, maker can refund
contract CrosschainResolver is Ownable {
    using SafeERC20 for IERC20;

    /// @notice 1inch Limit Order Protocol address (set once by owner)
    address public lop;

    event LOPSet(address lop);
    event HTLCLocked(
        bytes32 indexed h,
        address indexed maker,
        address token,
        uint256 amount,
        uint256 expiry,
        bytes metadata
    );
    event HTLCClaimed(
        bytes32 indexed h,
        address claimer,
        bytes secret,
        address token,
        uint256 amount
    );
    event HTLCRefunded(
        bytes32 indexed h,
        address maker,
        address token,
        uint256 amount
    );

    struct HTLC {
        address maker;
        address token;
        uint256 amount;
        uint256 expiry; // unix timestamp
        bool claimed;
        bytes metadata; // optional: non-EVM id, recipient, etc.
    }

    mapping(bytes32 => HTLC) public ht;

    modifier onlyLOP() {
        require(msg.sender == lop, "only LOP");
        _;
    }

    /// @notice Construct and set owner to deployer
    constructor() Ownable(msg.sender) {}

    /// @notice Set the LOP contract address (owner only)
    function setLOP(address _lop) external onlyOwner {
        require(_lop != address(0), "lop=0");
        lop = _lop;
        emit LOPSet(_lop);
    }

    /// @notice Called by LOP during fillOrderArgs to record escrowed tokens.
    /// @dev LOP usually transfers tokens to this resolver before calling interaction.
    ///      If not, resolver will attempt pull via transferFrom (maker must approve).
    /// @param h hashlock = sha256(secret)
    /// @param maker address of maker
    /// @param token ERC20 token address
    /// @param amount token amount (token decimals)
    /// @param expiry unix timestamp after which refund is allowed
    /// @param metadata optional metadata (e.g., non-EVM counterparty info)
    function lockFromLOP(
        bytes32 h,
        address maker,
        address token,
        uint256 amount,
        uint256 expiry,
        bytes calldata metadata
    ) external onlyLOP {
        require(h != bytes32(0), "h=0");
        require(amount > 0, "amount=0");
        HTLC storage e = ht[h];
        require(e.amount == 0 && !e.claimed, "exists");

        uint256 balBefore = IERC20(token).balanceOf(address(this));

        // If tokens not transferred yet, attempt pull
        if (balBefore < amount) {
            IERC20(token).safeTransferFrom(maker, address(this), amount);
        }

        uint256 balAfter = IERC20(token).balanceOf(address(this));
        require(balAfter >= amount, "insufficient received");

        ht[h] = HTLC({
            maker: maker,
            token: token,
            amount: amount,
            expiry: expiry,
            claimed: false,
            metadata: metadata
        });

        emit HTLCLocked(h, maker, token, amount, expiry, metadata);
    }

    /// @notice Claim locked funds by revealing secret preimage
    /// @param secret bytes where sha256(secret) == h
    /// @param recipient optional recipient address (if zero, defaults to msg.sender)
    function claim(bytes calldata secret, address recipient) external {
        bytes32 h = sha256(secret);
        HTLC storage e = ht[h];
        require(e.amount > 0 && !e.claimed, "no active lock");
        require(block.timestamp <= e.expiry, "expired");

        e.claimed = true;
        address to = recipient == address(0) ? msg.sender : recipient;

        IERC20(e.token).safeTransfer(to, e.amount);
        emit HTLCClaimed(h, msg.sender, secret, e.token, e.amount);
    }

    /// @notice Refund after expiry (only maker)
    function refund(bytes32 h) external {
        HTLC storage e = ht[h];
        require(e.amount > 0 && !e.claimed, "no active lock");
        require(block.timestamp > e.expiry, "not expired");
        require(msg.sender == e.maker, "only maker");

        uint256 amount = e.amount;
        e.amount = 0;
        e.claimed = true;

        IERC20(e.token).safeTransfer(e.maker, amount);
        emit HTLCRefunded(h, e.maker, e.token, amount);
    }
}
