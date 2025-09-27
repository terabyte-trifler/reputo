// scripts/createStopLoss.ts
import "dotenv/config";
import fs from "fs";
import { ethers } from "ethers";
import { LimitOrderBuilder, PrivateKeyProviderConnector, toDecimalString } from "@1inch/limit-order-protocol-utils";
// in scripts/createStopLoss.ts
import { encodeIsPriceLte } from "../lib/predicateEncode.ts";
 // <- exact TS module (ts-node --esm resolves this)
 
async function main() {
  const env = process.env as any;
  if (!env.PRIVATE_KEY || !env.LOP_ADDRESS || !env.CHAIN_ID || !env.MAKER_ASSET || !env.TAKER_ASSET || !env.SEPOLIA_RPC_URL || !env.PRICE_PREDICATE_ADDRESS) {
    throw new Error("Set PRIVATE_KEY, LOP_ADDRESS, CHAIN_ID, MAKER_ASSET, TAKER_ASSET, SEPOLIA_RPC_URL, PRICE_PREDICATE_ADDRESS in .env");
  }

  // provider & wallet (ethers v6)
  const provider = new ethers.JsonRpcProvider(env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);
  const maker = await wallet.getAddress();

  // example amounts - adapt decimals to your tokens
  const makingAmount = toDecimalString("0.10", 18); // sell 0.10 maker token (18 decimals)
  const takingAmount = toDecimalString("200", 18);  // want 200 taker token (18 decimals)

  // LIMIT ORDER BUILDER (1inch)
  const builder = new LimitOrderBuilder(env.LOP_ADDRESS, Number(env.CHAIN_ID), new PrivateKeyProviderConnector(env.PRIVATE_KEY, provider));

  // PRICE predicate: price <= threshold (example 2100 USD)
  // Important: use feed.decimals() from your Chainlink feed. For most Chainlink USD feeds decimals==8.
  const threshold = 2100n * 10n ** 8n; // 2100 * 10^8
  const predicateData = encodeIsPriceLte(threshold);

  const order = builder.buildLimitOrder({
    makerAsset: env.MAKER_ASSET,
    takerAsset: env.TAKER_ASSET,
    makingAmount,
    takingAmount,
    maker,
    receiver: maker,
    predicate: builder.predicate.arbitraryStaticCall(env.PRICE_PREDICATE_ADDRESS, predicateData),
    allowedSender: ethers.ZeroAddress,
    permit: "0x",
    interaction: "0x",
  });

  const { signature } = await builder.buildOrderData(order, new PrivateKeyProviderConnector(env.PRIVATE_KEY, provider));
  const payload = { order, signature };
  const out = "/tmp/order_stop.json";
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log("Order written to:", out);
  console.log("Preview order keys:", Object.keys(order).join(", "));
}

main().catch((e) => {
  console.error("createStopLoss failed:", e);
  process.exit(1);
});
