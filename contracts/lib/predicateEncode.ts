// lib/predicateEncode.ts
import { Interface } from "ethers";

export function encodeIsPriceGte(thresholdBigint: bigint) {
  const iface = new Interface(["function isPriceGte(int256) view returns (bool)"]);
  return iface.encodeFunctionData("isPriceGte", [thresholdBigint]);
}

export function encodeIsPriceLte(thresholdBigint: bigint) {
  const iface = new Interface(["function isPriceLte(int256) view returns (bool)"]);
  return iface.encodeFunctionData("isPriceLte", [thresholdBigint]);
}
