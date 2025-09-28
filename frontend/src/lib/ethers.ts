import { BrowserProvider, JsonRpcProvider, Contract, formatUnits, parseUnits } from "ethers";
export { Contract, BrowserProvider, JsonRpcProvider, formatUnits, parseUnits };

export const getBrowserProvider = () => {
  if (typeof window === "undefined") return null;
  if (!(window as any).ethereum) return null;
  return new BrowserProvider((window as any).ethereum);
};
