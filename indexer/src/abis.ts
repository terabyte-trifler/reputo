// src/abis.ts
export const LENDING_POOL_ABI = [
    // views (for position/HF calc if needed)
    "function liqThresholdBps() view returns (uint16)",
    "function valueOfCollateral(address) view returns (uint256)",
    "function debtBalance(address) view returns (uint256)",
  
    // events
    "event Deposit(address indexed user, uint256 amount)",
    "event Borrow(address indexed user, uint256 amount, uint16 userLTVbps)",
    "event Repay(address indexed user, uint256 amount)",
    "event Liquidate(address indexed user, address indexed liquidator, uint256 repayAmount, uint256 collateralSeized)",
    "event BufferDeposit(address indexed user, uint256 amount)",
    "event BufferWithdraw(address indexed user, uint256 amount)",
    "event BufferRepay(address indexed user, uint256 amount)"
  ];
  
  export const OCCR_ABI = [
    "event CreditScoreUpdated(address indexed user, uint256 scoreMicro)"
  ];
  