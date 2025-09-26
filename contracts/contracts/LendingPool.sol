pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 v) external returns (bool);
    function transferFrom(address from, address to, uint256 v) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
    function allowance(address o, address s) external view returns (uint256);
}

interface IOCCRScore {
    function getMaxLTVbps(address user, uint16 baseLTVbps) external view returns (uint16);
}

contract LendingPool {
    IERC20 public immutable collateral; // e.g., WETH
    IERC20 public immutable debtAsset;  // e.g., TestUSDC
    IOCCRScore public immutable occr;

    uint16 public baseLTVbps = 5000;      // 50%
    uint16 public liqThresholdBps = 5500; // 55%

    mapping(address => uint256) public collateralBalance;
    mapping(address => uint256) public debtBalance;

    event Deposit(address indexed user, uint256 amount);
    event Borrow(address indexed user, uint256 amount);
    event Repay(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    constructor(address _collateral, address _debtAsset, address _occr) {
        collateral = IERC20(_collateral);
        debtAsset = IERC20(_debtAsset);
        occr = IOCCRScore(_occr);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "amount");
        require(collateral.transferFrom(msg.sender, address(this), amount), "xfer");
        collateralBalance[msg.sender] += amount;
        emit Deposit(msg.sender, amount);
    }

    // price: collateral in terms of debt (1e18 scale). Day 1: pass manually.
    function maxBorrowable(address user, uint256 price) public view returns (uint256) {
        uint256 value = collateralBalance[user] * price / 1e18;
        uint16 ltvbps = occr.getMaxLTVbps(user, baseLTVbps);
        return value * ltvbps / 10_000;
    }

    function borrow(uint256 amount, uint256 price) external {
        require(amount > 0, "amount");
        uint256 limit = maxBorrowable(msg.sender, price);
        require(debtBalance[msg.sender] + amount <= limit, "exceeds LTV");
        require(debtAsset.transfer(msg.sender, amount), "xfer");
        debtBalance[msg.sender] += amount;
        emit Borrow(msg.sender, amount);
    }

    function repay(uint256 amount) external {
        require(amount > 0, "amount");
        require(debtAsset.transferFrom(msg.sender, address(this), amount), "xfer");
        if (amount > debtBalance[msg.sender]) amount = debtBalance[msg.sender];
        debtBalance[msg.sender] -= amount;
        emit Repay(msg.sender, amount);
    }

    function withdraw(uint256 amount, uint256 price) external {
        require(amount > 0, "amount");
        uint256 newColl = collateralBalance[msg.sender] - amount;
        uint256 value = newColl * price / 1e18;
        uint16 ltvbps = occr.getMaxLTVbps(msg.sender, baseLTVbps);
        uint256 limit = value * ltvbps / 10_000;
        require(debtBalance[msg.sender] <= limit, "would exceed LTV");
        collateralBalance[msg.sender] = newColl;
        require(collateral.transfer(msg.sender, amount), "xfer");
        emit Withdraw(msg.sender, amount);
    }
}