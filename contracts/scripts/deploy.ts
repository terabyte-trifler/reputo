/// <reference types="hardhat" />
import hre from "hardhat";
import fs from "node:fs";
import path from "node:path";
import type { Signer } from "ethers";

async function main() {
  console.log("Starting deploy script under Hardhat:", true);

  console.log("hre keys:", Object.keys(hre));
  console.log("typeof hre.ethers:", typeof (hre as any).ethers);

  if (!(hre as any).ethers) {
    console.error("ERROR: hre.ethers is undefined. Ensure @nomicfoundation/hardhat-ethers is installed and imported.");
    process.exit(1);
  }

  const ethers = (hre as any).ethers;
  const network = hre.network;

  // ---------- helpers ----------
  const writeDeployment = (net: string, data: Record<string, string>) => {
    const dir = path.join(process.cwd(), "deployments");
    const file = path.join(dir, `${net}.json`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`\nSaved addresses to: ${file}`);
  };

  const one = (n: string) => ethers.parseEther(n);

  const signers = await ethers.getSigners();
  const [deployer]: Signer[] = signers;
  console.log(`Network: ${(network as any).name ?? "unknown"}`);
  console.log(`Deployer: ${(deployer as any)?.address}\n`);

  // ---------- 1) Tokens ----------
  const Token = await ethers.getContractFactory("TestToken");

  const cWETH = await Token.deploy("Collateral WETH", "cWETH", 18);
  await cWETH.waitForDeployment();
  const cWETHAddr = await cWETH.getAddress();
  console.log("cWETH:", cWETHAddr);

  const tUSDC = await Token.deploy("Test USDC", "tUSDC", 18);
  await tUSDC.waitForDeployment();
  const tUSDCAddr = await tUSDC.getAddress();
  console.log("tUSDC:", tUSDCAddr);

  // ---------- 2) Identity + OCCR + Pool ----------
  const Identity = await ethers.getContractFactory("IdentityVerifier");
  const identity = await Identity.deploy();
  await identity.waitForDeployment();
  const identityAddr = await identity.getAddress();
  console.log("IdentityVerifier:", identityAddr);

  const OCCR = await ethers.getContractFactory("OCCRScore");
  const occr = await OCCR.deploy((deployer as any).address);
  await occr.waitForDeployment();
  const occrAddr = await occr.getAddress();
  console.log("OCCRScore:", occrAddr);

  const Pool = await ethers.getContractFactory("LendingPool");
  const pool = await Pool.deploy(cWETHAddr, tUSDCAddr, (deployer as any).address);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("LendingPool:", poolAddr);

  // ---------- 3) Wire references ----------
  await (await pool.setRefs(occrAddr, identityAddr)).wait();
  await (await occr.setPool(poolAddr, poolAddr)).wait();
  console.log("Refs wired (pool <-> occr, identity).");

  // ---------- 4) Seed balances for demo ----------
  await (await cWETH.mint((deployer as any).address, one("100"))).wait();
  await (await tUSDC.mint(poolAddr, one("100000"))).wait();
  console.log("Seeded: 100 cWETH to user, 100k tUSDC to pool.");

  // ---------- 5) Set demo price (collateral -> debt) ----------
  await (await pool.setPrice(one("2000"))).wait();
  console.log("Set price = 2000 (collateral->debt).");

  // ---------- 6) Output ----------
  const addrs = {
    network: (network as any).name ?? "unknown",
    deployer: (deployer as any).address,
    cWETH: cWETHAddr,
    tUSDC: tUSDCAddr,
    IdentityVerifier: identityAddr,
    OCCRScore: occrAddr,
    LendingPool: poolAddr,
  };

  console.log("\nDONE. Save these addresses:");
  console.log(addrs);
  writeDeployment((network as any).name ?? "unknown", addrs);
}

main().catch((e) => {
  console.error("Script failed:", e);
  process.exit(1);
});