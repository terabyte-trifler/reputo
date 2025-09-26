import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1) Deploy tokens
  const Token = await ethers.getContractFactory("TestToken");

  const cWETH = await Token.deploy("Collateral WETH", "cWETH", 18);
  await cWETH.waitForDeployment();
  const cWETHAddr = await cWETH.getAddress();
  console.log("cWETH:", cWETHAddr);

  const tUSDC = await Token.deploy("Test USDC", "tUSDC", 18);
  await tUSDC.waitForDeployment();
  const tUSDCAddr = await tUSDC.getAddress();
  console.log("tUSDC:", tUSDCAddr);

  // 2) Deploy Identity + OCCR + Pool
  const Identity = await ethers.getContractFactory("IdentityVerifier");
  const identity = await Identity.deploy();
  await identity.waitForDeployment();
  const identityAddr = await identity.getAddress();
  console.log("IdentityVerifier:", identityAddr);

  const OCCR = await ethers.getContractFactory("OCCRScore");
  const occr = await OCCR.deploy(deployer.address);
  await occr.waitForDeployment();
  const occrAddr = await occr.getAddress();
  console.log("OCCRScore:", occrAddr);

  const Pool = await ethers.getContractFactory("LendingPool");
  const pool = await Pool.deploy(cWETHAddr, tUSDCAddr, deployer.address);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("LendingPool:", poolAddr);

  // 3) Wire refs
  const poolSet = await pool.setRefs(occrAddr, identityAddr);
  await poolSet.wait();

  const setPool = await occr.setPool(poolAddr, poolAddr);
  await setPool.wait();

  // 4) Seed liquidity and user balances for demo
  // mint collateral to user
  await (await cWETH.mint(deployer.address, ethers.parseEther("100"))).wait();

  // mint debt liquidity to pool
  await (await tUSDC.mint(poolAddr, ethers.parseEther("100000"))).wait();

  // 5) (Optional) set price (collateral->debt)
  await (await pool.setPrice(ethers.parseEther("2000"))).wait();

  console.log("DONE. Save addresses:");
  console.log({ cWETHAddr, tUSDCAddr, identityAddr, occrAddr, poolAddr });
}

main().catch((e) => { console.error(e); process.exit(1); });
