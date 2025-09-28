// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IOCCRScore {
    function onBorrow(address user) external;
    function onRepay(address user) external;
    function onLiquidation(address user) external;
    function getMaxLTVbps(address user, uint16 baseLTVbps) external view returns (uint16);
}

interface IIdentity {
    function isVerified(address user) external view returns (bool);
}

contract LendingPool is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateral; // e.g., cWETH (18d)
    IERC20 public immutable debtAsset;  // e.g., tUSDC (18d)
    IOCCRScore public occr;
    IIdentity public identity;

    // config
    uint16 public baseLTVbps = 5000;          // 50%
    uint16 public liqThresholdBps = 5500;     // 55%
    uint16 public liquidationBonusBps = 1000; // 10% bonus
    uint256 public price1e18 = 2000e18;       // collateral->debt price (1e18). Day-2: manual, Day-3+: oracle

    // user state
    mapping(address => uint256) public collateralBalance;
    mapping(address => uint256) public debtBalance;

    // NEW: repay buffer balances (stablecoin pre-deposited for automation)
    mapping(address => uint256) public repayBuffer;

    event Deposit(address indexed user, uint256 amount);
    event Borrow(address indexed user, uint256 amount, uint16 userLTVbps);
    event Repay(address indexed user, uint256 amount);
    event Liquidate(address indexed user, address indexed liquidator, uint256 repayAmount, uint256 collateralSeized);
    event PriceUpdated(uint256 newPrice1e18);
    event SetContracts(address occr, address identity);

    // NEW: buffer events
    event BufferDeposited(address indexed user, uint256 amount);
    event BufferWithdrawn(address indexed user, uint256 amount);
    event BufferRepaid(address indexed user, uint256 amount);
    event RepaidOnBehalf(address indexed payer, address indexed borrower, uint256 amount);

    constructor(address _collateral, address _debtAsset, address _owner) Ownable(_owner) {
        collateral = IERC20(_collateral);
        debtAsset = IERC20(_debtAsset);
    }

    // --- admin ---
    function setRefs(address _occr, address _identity) external onlyOwner {
        occr = IOCCRScore(_occr);
        identity = IIdentity(_identity);
        emit SetContracts(_occr, _identity);
    }

    function setPrice(uint256 newPrice1e18) external onlyOwner {
        require(newPrice1e18 > 0, "price=0");
        price1e18 = newPrice1e18;
        emit PriceUpdated(newPrice1e18);
    }

    // --- views ---
    function getUserPositions(address user) external view returns (uint256 coll, uint256 debt) {
        return (collateralBalance[user], debtBalance[user]);
    }

    function valueOfCollateral(address user) public view returns (uint256) {
        return collateralBalance[user] * price1e18 / 1e18;
    }

    function userMaxBorrowable(address user) public view returns (uint256) {
        uint256 value = valueOfCollateral(user);
        uint16 userLTV = address(occr) != address(0) ? occr.getMaxLTVbps(user, baseLTVbps) : baseLTVbps;
        return value * userLTV / 10_000;
    }

    // health factor (1e18 precision): (value * liqThreshold) / max(debt,1)
    function getHealthFactor(address user) public view returns (uint256) {
        uint256 value = valueOfCollateral(user);
        uint256 thresh = value * liqThresholdBps / 10_000; // threshold debt at which liquidation occurs
        uint256 d = debtBalance[user];
        if (d == 0) return type(uint256).max; // infinite HF if no debt
        return (thresh * 1e18) / d;
    }

    function isUnderwater(address user) public view returns (bool) {
        uint256 value = valueOfCollateral(user);
        uint256 thresh = value * liqThresholdBps / 10_000;
        return debtBalance[user] > thresh;
    }

    // --- actions ---
    function deposit(uint256 amount) external {
        require(amount > 0, "amount");
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        collateralBalance[msg.sender] += amount;
        emit Deposit(msg.sender, amount);

        if (address(occr) != address(0)) occr.onRepay(msg.sender); // nudge recompute (neutral)
    }

    function borrow(uint256 amount) external {
        require(amount > 0, "amount");
        require(address(identity) != address(0) && identity.isVerified(msg.sender), "identity");

        uint256 newDebt = debtBalance[msg.sender] + amount;
        require(newDebt <= userMaxBorrowable(msg.sender), "exceeds LTV");

        debtBalance[msg.sender] = newDebt;
        debtAsset.safeTransfer(msg.sender, amount);
        uint16 userLTV = address(occr) != address(0) ? occr.getMaxLTVbps(msg.sender, baseLTVbps) : baseLTVbps;
        emit Borrow(msg.sender, amount, userLTV);

        if (address(occr) != address(0)) occr.onBorrow(msg.sender);
    }

    function repay(uint256 amount) external {
        require(amount > 0, "amount");
        uint256 repayAmt = amount > debtBalance[msg.sender] ? debtBalance[msg.sender] : amount;
        debtAsset.safeTransferFrom(msg.sender, address(this), repayAmt);
        debtBalance[msg.sender] -= repayAmt;
        emit Repay(msg.sender, repayAmt);

        if (address(occr) != address(0)) occr.onRepay(msg.sender);
    }

    // NEW: anyone can repay someone else's debt (useful for agent flows)
    function repayOnBehalf(address borrower, uint256 amount) external {
        require(amount > 0, "amount");
        uint256 repayAmt = amount > debtBalance[borrower] ? debtBalance[borrower] : amount;
        debtAsset.safeTransferFrom(msg.sender, address(this), repayAmt);
        debtBalance[borrower] -= repayAmt;
        emit RepaidOnBehalf(msg.sender, borrower, repayAmt);

        if (address(occr) != address(0)) occr.onRepay(borrower);
    }

    // NEW: repay buffer UX
    function depositBuffer(uint256 amount) external {
        require(amount > 0, "amount");
        debtAsset.safeTransferFrom(msg.sender, address(this), amount);
        repayBuffer[msg.sender] += amount;
        emit BufferDeposited(msg.sender, amount);
    }

    function withdrawBuffer(uint256 amount) external {
        require(amount > 0 && repayBuffer[msg.sender] >= amount, "buffer");
        repayBuffer[msg.sender] -= amount;
        debtAsset.safeTransfer(msg.sender, amount);
        emit BufferWithdrawn(msg.sender, amount);
    }

    function repayFromBuffer(uint256 amount) external {
        uint256 available = repayBuffer[msg.sender];
        require(available > 0, "no buffer");
        uint256 use = amount > available ? available : amount;
        uint256 repayAmt = use > debtBalance[msg.sender] ? debtBalance[msg.sender] : use;

        repayBuffer[msg.sender] = available - repayAmt;
        debtBalance[msg.sender] -= repayAmt;
        emit BufferRepaid(msg.sender, repayAmt);
        emit Repay(msg.sender, repayAmt);

        if (address(occr) != address(0)) occr.onRepay(msg.sender);
    }

    // liquidation: liquidator repays for user and gets discounted collateral
    function liquidate(address user, uint256 repayAmount) external {
        require(isUnderwater(user), "not underwater");
        uint256 repayAmt = repayAmount > debtBalance[user] ? debtBalance[user] : repayAmount;

        // transfer debt from liquidator to pool
        debtAsset.safeTransferFrom(msg.sender, address(this), repayAmt);
        debtBalance[user] -= repayAmt;

        // seize collateral equivalent (+bonus)
        // collateralSeized = repayAmt / price * (1 + bonus)
        uint256 collNoBonus = repayAmt * 1e18 / price1e18;
        uint256 seized = collNoBonus * (10_000 + liquidationBonusBps) / 10_000;
        if (seized > collateralBalance[user]) seized = collateralBalance[user];

        collateralBalance[user] -= seized;
        collateral.safeTransfer(msg.sender, seized);

        emit Liquidate(user, msg.sender, repayAmt, seized);

        if (address(occr) != address(0)) occr.onLiquidation(user);
    }
}
