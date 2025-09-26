import { ethers } from "ethers";

// Fill these from deploy outputs later
export const OCCR_ADDRESS = process.env.NEXT_PUBLIC_OCCR_ADDRESS || "";
export const POOL_ADDRESS = process.env.NEXT_PUBLIC_POOL_ADDRESS || "";

export const OCCR_ABI = [
  "function getScore(address) view returns (uint32)",
  "function getMaxLTVbps(address, uint16) view returns (uint16)"
];
export const POOL_ABI = [
  "function collateralBalance(address) view returns (uint256)",
  "function debtBalance(address) view returns (uint256)",
  "function maxBorrowable(address,uint256) view returns (uint256)"
];

export function getProvider() {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    return new ethers.BrowserProvider((window as any).ethereum);
  }
  // fallback read RPC if needed
  return new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_SEPOLIA_RPC);
}
