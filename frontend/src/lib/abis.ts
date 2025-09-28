export const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address a) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 value) returns (bool)"
  ];
  
  export const LENDING_POOL_ABI = [
    // views
    "function owner() view returns (address)",
    "function baseLTVbps() view returns (uint16)",
    "function liqThresholdBps() view returns (uint16)",
    "function price1e18() view returns (uint256)",
    "function getUserPositions(address) view returns (uint256,uint256)",
    "function valueOfCollateral(address) view returns (uint256)",
    "function userMaxBorrowable(address) view returns (uint256)",
    "function getHealthFactor(address) view returns (uint256)",
    // buffer + state
    "function repayBuffer(address) view returns (uint256)",
    // actions
    "function deposit(uint256 amount)",
    "function borrow(uint256 amount)",
    "function repay(uint256 amount)",
    "function depositBuffer(uint256 amount)",
    "function withdrawBuffer(uint256 amount)",
    "function repayFromBuffer(uint256 amount)",
    // admin
    "function setPrice(uint256 newPrice1e18)"
  ];
  
  export const OCCR_ABI = [
    "function scoreMicro(address user) view returns (uint32)"
  ];
  