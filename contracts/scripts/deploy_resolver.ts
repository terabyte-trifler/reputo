// scripts/deploy_resolver.ts
import * as dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import path from "node:path";

async function deploy() {
  const RPC = process.env.SEPOLIA_RPC_URL;
  const PK = process.env.PRIVATE_KEY;
  if (!RPC || !PK) throw new Error("Set SEPOLIA_RPC_URL and PRIVATE_KEY in .env");

  const { JsonRpcProvider, Wallet, ContractFactory } = await import("ethers");
  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(PK, provider);

  console.log("Deployer:", await wallet.getAddress());

  const artifactsPath = path.join(process.cwd(), "artifacts", "contracts", "CrosschainResolver.sol", "CrosschainResolver.json");
  if (!fs.existsSync(artifactsPath)) throw new Error("Compile first: artifacts not found: " + artifactsPath);

  const raw = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
  const factory = new ContractFactory(raw.abi, raw.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("CrosschainResolver deployed:", addr);
  console.log("Save to .env as RESOLVER_ADDRESS=" + addr);
}
deploy().catch((e)=>{ console.error(e); process.exit(1); });
