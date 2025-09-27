// scripts/deploy_occr_predicate.ts
/// <reference types="hardhat" />
import hre from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  // prefer hre.ethers but guard for runtime missing plugin
  if (!(hre as any).ethers) {
    console.warn("hre.ethers not available — prefer running with `npx hardhat run` but will try direct fallback.");
  }

  const occrAddr = process.env.OCCR_ADDRESS;
  if (!occrAddr) {
    console.error("Missing OCCR_ADDRESS in .env");
    process.exit(1);
  }
  const maxRisk = process.env.OCCR_PREDICATE_MAX_RISK ? Number(process.env.OCCR_PREDICATE_MAX_RISK) : 350_000;

  // If hre.ethers exists, use it (preferred)
  if ((hre as any).ethers) {
    const ethers = (hre as any).ethers;
    const [deployer] = await ethers.getSigners();
    console.log("Using hre.ethers. Deployer:", await deployer.getAddress());
    const F = await ethers.getContractFactory("OCCRPredicate");
    const pred = await F.deploy(occrAddr, maxRisk);
    await pred.waitForDeployment?.();
    console.log("OCCRPredicate deployed at:", await pred.getAddress());
    return;
  }

  // Fallback: direct ethers
  const { Wallet, ContractFactory, JsonRpcProvider } = await import("ethers");
  const RPC = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
  const PK = process.env.PRIVATE_KEY;
  if (!RPC || !PK) {
    console.error("Missing SEPOLIA_RPC_URL or PRIVATE_KEY for fallback deploy");
    process.exit(1);
  }
  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(PK, provider);
  console.log("Using direct ethers. Deployer:", await wallet.getAddress());

  // load artifact
  const fs = await import("fs");
  const path = await import("path");
  const artRoot = path.join(process.cwd(), "artifacts", "contracts");
  const solFiles = fs.readdirSync(artRoot);
  let art: any = null;
  for (const s of solFiles) {
    const p = path.join(artRoot, s, `OCCRPredicate.json`);
    if (fs.existsSync(p)) {
      art = JSON.parse(fs.readFileSync(p, "utf8"));
      break;
    }
  }
  if (!art) throw new Error("OCCRPredicate artifact not found; run `pnpm exec hardhat compile` first");

  const factory = new ContractFactory(art.abi, art.bytecode, wallet);
  const pred = await factory.deploy(occrAddr, BigInt(maxRisk), {}); // BigInt + {} to avoid overrides ambiguity
  await pred.waitForDeployment();
  console.log("OCCRPredicate deployed at (direct):", await pred.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
