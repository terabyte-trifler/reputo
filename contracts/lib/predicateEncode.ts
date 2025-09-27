// lib/predicateEncode.ts
import { Interface } from "ethers";

/**
 * Encode predicate calldata for PricePredicate.
 * The thresholdBigint must be already scaled to the feed decimals (e.g., feed decimals = 8 -> use 10**8).
 */

export function encodeIsPriceGte(thresholdBigint: bigint): string {
  const iface = new Interface(["function isPriceGte(int256) view returns (bool)"]);
  return iface.encodeFunctionData("isPriceGte", [thresholdBigint]);
}

export function encodeIsPriceLte(thresholdBigint: bigint): string {
  const iface = new Interface(["function isPriceLte(int256) view returns (bool)"]);
  return iface.encodeFunctionData("isPriceLte", [thresholdBigint]);
}
