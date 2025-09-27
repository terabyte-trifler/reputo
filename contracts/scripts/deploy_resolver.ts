// scripts/deploy_resolver.ts
import * as dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import path from "node:path";

type EthersLike = {
  JsonRpcProvider?: any;
  Wallet?: any;
  ContractFactory?: any;
  providers?: { JsonRpcProvider?: any };
  default?: any;
  ethers?: any;
};

function pickEthers(mod: any): { E: EthersLike; usedPath: string } {
  // mod: whatever import("ethers") returned
  // possibilities to check (in order)
  if (!mod) throw new Error("empty module imported from 'ethers'");

  // 1) mod itself contains classes (ESM top-level)
  if (mod.JsonRpcProvider && mod.Wallet && mod.ContractFactory) {
    return { E: mod, usedPath: "mod" };
  }

  // 2) mod.providers.JsonRpcProvider exists (common in some builds)
  if (mod.providers && mod.providers.JsonRpcProvider && mod.Wallet && mod.ContractFactory) {
    return { E: mod, usedPath: "mod (providers)" };
  }

  // 3) mod.default contains the real namespace (CommonJS interop)
  if (mod.default) {
    const d = mod.default;
    if (d.JsonRpcProvider && d.Wallet && d.ContractFactory) {
      return { E: d, usedPath: "mod.default" };
    }
    if (d.providers && d.providers.JsonRpcProvider && d.Wallet && d.ContractFactory) {
      return { E: d, usedPath: "mod.default (providers)" };
    }
    // sometimes default.ethers
    if (d.ethers && d.ethers.JsonRpcProvider) {
      return { E: d.ethers, usedPath: "mod.default.ethers" };
    }
  }

  // 4) mod.ethers present
  if (mod.ethers) {
    const e = mod.ethers;
    if (e.JsonRpcProvider && e.Wallet && e.ContractFactory) {
      return { E: e, usedPath: "mod.ethers" };
    }
    if (e.providers && e.providers.JsonRpcProvider) {
      return { E: e, usedPath: "mod.ethers (providers)" };
    }
  }

  // 5) as a final fallback, try mod.default?.ethers
  if (mod.default?.ethers) {
    return { E: mod.default.ethers, usedPath: "mod.default.ethers" };
  }

  // give up with helpful message
  throw new Error(
    "Could not find JsonRpcProvider/Wallet/ContractFactory on imported ethers module. " +
      "Module keys: " +
      JSON.stringify(Object.keys(mod))
  );
}

async function deploy() {
  const RPC = process.env.SEPOLIA_RPC_URL;
  const PK = process.env.PRIVATE_KEY;
  if (!RPC || !PK) throw new Error("Set SEPOLIA_RPC_URL and PRIVATE_KEY in .env");

  // import ethers dynamically and pick the correct namespace
  const mod = await import("ethers");
  const { E, usedPath } = pickEthers(mod);
  console.log("Using ethers shape from:", usedPath);

  const JsonRpcProvider = E.JsonRpcProvider ?? E.providers?.JsonRpcProvider;
  const Wallet = E.Wallet;
  const ContractFactory = E.ContractFactory ?? E.ContractFactory; // ensure exists

  if (!JsonRpcProvider || !Wallet || !ContractFactory) {
    throw new Error("Selected ethers namespace is missing expected exports");
  }

  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(PK, provider);

  console.log("Deployer:", await wallet.getAddress());

  // artifact path
  const artifactsPath = path.join(
    process.cwd(),
    "artifacts",
    "contracts",
    "CrosschainResolver.sol",
    "CrosschainResolver.json"
  );
  if (!fs.existsSync(artifactsPath)) {
    throw new Error("Compile first: artifacts not found: " + artifactsPath);
  }

  const raw = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));

  const factory = new ContractFactory(raw.abi, raw.bytecode, wallet);
  const contract = await factory.deploy();

  // wait for deployment (try a few strategies)
  if (typeof (contract as any).waitForDeployment === "function") {
    await (contract as any).waitForDeployment();
  } else if (typeof (contract as any).deployed === "function") {
    await (contract as any).deployed();
  } else {
    // fallback: wait for transaction if available
    const txHash = (contract as any).deploymentTransaction?.()?.hash ?? (contract as any).deployTransaction?.hash;
    if (txHash) {
      await provider.waitForTransaction(txHash, 1, 120000);
    }
  }

  const addr =
    typeof (contract as any).getAddress === "function" ? await (contract as any).getAddress() : (contract as any).address;

  console.log("✅ CrosschainResolver deployed:", addr);
  console.log("👉 Save to .env: RESOLVER_ADDRESS=" + addr);
}

deploy().catch((err) => {
  console.error("deploy failed:", err);
  process.exitCode = 1;
});
