// scripts/deploy_direct.ts
/**
 * Flexible deploy script for multiple networks.
 *
 * Usage:
 * 1) Set env in .env:
 *    - PRIVATE_KEY=0x...
 *    - SEPOLIA_RPC_URL=...
 *    - AMOY_RPC_URL=...
 *    - CELO_ALFA_RPC_URL=...
 *    - RPC_URL=http://127.0.0.1:8545   (optional, used for localhost)
 *    - OR set NETWORK env var (see below)
 *
 * 2) Run:
 *    # via env var
 *    NETWORK=sepolia pnpm exec ts-node scripts/deploy_direct.ts
 *
 *    # or via CLI flag (overrides env)
 *    pnpm exec ts-node scripts/deploy_direct.ts --network sepolia
 *
*/
/// <reference types="hardhat" />
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import {
  Wallet,
  parseEther,
  ContractFactory,
  JsonRpcProvider,
  type Contract,
} from "ethers";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ----------------- config / helpers -----------------
type Artifact = {
  abi: any;
  bytecode: string;
};

function readArtifactByName(name: string): Artifact {
  const artRoot = path.join(process.cwd(), "artifacts", "contracts");
  if (!fs.existsSync(artRoot)) {
    throw new Error(`artifacts/contracts not found. Run 'pnpm exec hardhat compile' first.`);
  }

  const solFiles = fs.readdirSync(artRoot);
  for (const solFile of solFiles) {
    const candidate = path.join(artRoot, solFile, `${name}.json`);
    if (fs.existsSync(candidate)) {
      const raw = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (!raw.abi || !raw.bytecode) throw new Error(`artifact ${candidate} missing abi/bytecode`);
      return { abi: raw.abi, bytecode: raw.bytecode };
    }
  }
  throw new Error(`Artifact for ${name} not found under artifacts/contracts`);
}

async function deployContract(name: string, deployer: Wallet, constructorArgs: any[] = []): Promise<Contract> {
  const art = readArtifactByName(name);
  const factory = new ContractFactory(art.abi, art.bytecode, deployer);
  console.log(`Deploying ${name}...`);
  const contract = await factory.deploy(...constructorArgs);
  await contract.waitForDeployment(); // ethers v6
  const addr = await contract.getAddress();
  console.log(`${name} deployed at: ${addr}`);
  return contract;
}

async function waitForProviderReady(provider: JsonRpcProvider, retries = 8, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await provider.getBlockNumber();
      return;
    } catch (e) {
      if (i === retries - 1) throw e;
      // wait and retry
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// ----------------- network selection -----------------
function parseCliNetwork(): string | undefined {
  // simple CLI flag parser: --network name
  const idx = process.argv.indexOf("--network");
  if (idx >= 0 && process.argv.length > idx + 1) return process.argv[idx + 1];
  // also support short -n name
  const idx2 = process.argv.indexOf("-n");
  if (idx2 >= 0 && process.argv.length > idx2 + 1) return process.argv[idx2 + 1];
  return undefined;
}

const cliNetwork = parseCliNetwork();
const envNetwork = process.env.NETWORK;
const networkName = (cliNetwork ?? envNetwork ?? "localhost").trim();

const rpcEnvMap: Record<string, string | undefined> = {
  sepolia: process.env.SEPOLIA_RPC_URL,
  polygonAmoy: process.env.AMOY_RPC_URL,
  celoAlfajores: process.env.CELO_ALFA_RPC_URL,
  localhost: process.env.RPC_URL, // prefer RPC_URL for localhost; fallback below if undefined
};

// Determine RPC URL
let rpcUrl = rpcEnvMap[networkName];
if (!rpcUrl && networkName === "localhost") {
  rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
}
if (!rpcUrl) {
  console.error(`No RPC URL provided for network '${networkName}'.`);
  console.error(
    `Provide one of the env vars: SEPOLIA_RPC_URL, AMOY_RPC_URL, CELO_ALFA_RPC_URL, or RPC_URL (for localhost).`
  );
  process.exit(1);
}

// ----------------- main -----------------
async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    console.error("Missing PRIVATE_KEY in .env. Add PRIVATE_KEY=0x....");
    process.exit(1);
  }

  console.log(`Network chosen: ${networkName}`);
  console.log(`RPC URL: ${rpcUrl}`);

  const provider = new JsonRpcProvider(rpcUrl);

  // wait for provider to respond (helps when node is still starting)
  try {
    await waitForProviderReady(provider, 12, 1000);
  } catch (e) {
    console.error("JsonRpcProvider failed to detect network. Check RPC URL and network connectivity.");
    console.error(e);
    process.exit(1);
  }

  const deployer = new Wallet(pk, provider);
  console.log("Deployer address:", await deployer.getAddress());

  // ---------- Deploy sequence (same order as original script) ----------
  const cWETH = await deployContract("TestToken", deployer, ["Collateral WETH", "cWETH", 18]);
  const tUSDC = await deployContract("TestToken", deployer, ["Test USDC", "tUSDC", 18]);

  const identity = await deployContract("IdentityVerifier", deployer);
  const occr = await deployContract("OCCRScore", deployer, [await deployer.getAddress()]);
  const pool = await deployContract("LendingPool", deployer, [await cWETH.getAddress(), await tUSDC.getAddress(), await deployer.getAddress()]);

  // ---------- Wire refs ----------
  console.log("Wiring refs (pool <-> occr, identity)...");
  await (await pool.setRefs(await occr.getAddress(), await identity.getAddress())).wait();
  await (await occr.setPool(await pool.getAddress(), await pool.getAddress())).wait();

  // ---------- Seed balances ----------
  console.log("Seeding balances...");
  await (await cWETH.mint(await deployer.getAddress(), parseEther("100"))).wait();
  await (await tUSDC.mint(await pool.getAddress(), parseEther("100000"))).wait();

  // ---------- Demo price ----------
  console.log("Setting demo price...");
  await (await pool.setPrice(parseEther("2000"))).wait();

  const addrs = {
    network: networkName,
    rpc: rpcUrl,
    deployer: await deployer.getAddress(),
    cWETH: await cWETH.getAddress(),
    tUSDC: await tUSDC.getAddress(),
    IdentityVerifier: await identity.getAddress(),
    OCCRScore: await occr.getAddress(),
    LendingPool: await pool.getAddress(),
  };

  const outDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `direct-${networkName}-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(addrs, null, 2));
  console.log("Saved addresses to:", outFile);

  console.log("Deployment finished.");
}

main().catch((e) => {
  console.error("Deployment failed:", e);
  process.exit(1);
});