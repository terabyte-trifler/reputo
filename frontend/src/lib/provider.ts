import { ethers } from "ethers";

export function makeJsonProvider(rpc: string) {
  return new ethers.JsonRpcProvider(rpc);
}

export function getBrowserProvider() {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    return new ethers.BrowserProvider((window as any).ethereum);
  }
  return null;
}
