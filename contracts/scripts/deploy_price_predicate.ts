// scripts/deploy_price_predicate.ts
/// <reference types="hardhat" />
/**
 * Robust deploy script for PricePredicate.
 *
 * - Preferred path: use hre.ethers (when running via `hardhat run` and plugin is loaded)
 * - Fallback path: use ethers + compiled artifact under artifacts/ (works if hre.ethers isn't available)
 *
 * Required env:
 *   CHAINLINK_FEED (address of the chainlink feed to pass to PricePredicate constructor)
 *   SEPOLIA_RPC_URL & PRIVATE_KEY (only required for fallback direct-ethers path)
 *
 * Usage:
 *  pnpm exec hardhat run scripts/deploy_price_predicate.ts --network sepolia
 *  OR
 *  CHAINLINK_FEED=0x... SEPOLIA_RPC_URL=... PRIVATE_KEY=0x... pnpm exec ts-node scripts/deploy_price_predicate.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

import hre from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function readArtifactByName(name: string) {
  const artRoot = path.join(process.cwd(), "artifacts", "contracts");
  if (!fs.existsSync(artRoot)) throw new Error("artifacts/contracts not found — run `pnpm exec hardhat compile` first");

  const solFiles = fs.readdirSync(artRoot);
  for (const solFile of solFiles) {
    const candidate = path.join(artRoot, solFile, `${name}.json`);
    if (fs.existsSync(candidate)) {
      const raw = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (!raw.abi || !raw.bytecode) throw new Error(`artifact ${candidate} missing abi/bytecode`);
      return raw;
    }
  }

  throw new Error(`Artifact for ${name} not found under artifacts/contracts`);
}

async function deployUsingHardhat(feedAddr: string) {
  if (!(hre as any).ethers) throw new Error("hre.ethers not available");
  const ethers = (hre as any).ethers;

  const [deployer] = await ethers.getSigners();
  const deployerAddr = typeof deployer.getAddress === "function" ? await deployer.getAddress() : (deployer as any).address;
  console.log("Using hre.ethers. Deployer:", deployerAddr);

  const F = await ethers.getContractFactory("PricePredicate");
  const pred = await F.deploy(feedAddr);
  await pred.waitForDeployment?.();
  const addr = await pred.getAddress?.();
  console.log("PricePredicate deployed at (hardhat):", addr);
  return addr;
}

async function deployUsingDirectEthers(feedAddr: string) {
  const { JsonRpcProvider, Wallet, ContractFactory } = await import("ethers");

  const RPC = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
  const PK = process.env.PRIVATE_KEY;
  if (!RPC) throw new Error("No RPC URL set. Set SEPOLIA_RPC_URL or RPC_URL in .env (fallback path)");
  if (!PK) throw new Error("No PRIVATE_KEY set. Set PRIVATE_KEY in .env (fallback path)");

  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(PK, provider);
  console.log("Using direct ethers. Deployer:", await wallet.getAddress());

  const artifact = await readArtifactByName("PricePredicate");
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);

  // feedAddr is a single constructor arg; pass explicit empty overrides object to avoid ambiguity
  const contract = await factory.deploy(feedAddr, {});
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("PricePredicate deployed at (direct ethers):", addr);
  return addr;
}

async function main() {
  const feed = process.env.CHAINLINK_FEED || process.env.PRICE_FEED || process.env.FEED_ADDRESS;
  if (!feed) {
    console.error("Missing CHAINLINK_FEED (or PRICE_FEED / FEED_ADDRESS) in .env. Set it to the Chainlink feed address.");
    process.exit(1);
  }

  try {
    const addr = await deployUsingHardhat(feed);
    console.log("PricePredicate address:", addr);
    return;
  } catch (err) {
    console.warn("Hardhat deploy path failed — falling back to direct ethers. Reason:", (err as any)?.message || err);
  }

  try {
    const addr = await deployUsingDirectEthers(feed);
    console.log("PricePredicate address:", addr);
  } catch (err) {
    console.error("Direct ethers deploy failed:", err);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Unhandled error in deploy_price_predicate:", e);
  process.exit(1);
});
