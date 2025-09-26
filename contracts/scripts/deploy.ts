
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const OCCR = await ethers.getContractFactory("OCCRScore");
  const occr = await OCCR.deploy();
  await occr.waitForDeployment();
  console.log("OCCRScore:", await occr.getAddress());

  // placeholders until we deploy mock tokens tomorrow
  const COLLATERAL_ADDR = "0x0000000000000000000000000000000000000000";
  const DEBT_ADDR       = "0x0000000000000000000000000000000000000000";

  const Pool = await ethers.getContractFactory("LendingPool");
  const pool = await Pool.deploy(COLLATERAL_ADDR, DEBT_ADDR, await occr.getAddress());
  await pool.waitForDeployment();
  console.log("LendingPool:", await pool.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
