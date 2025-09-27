// scripts/mint-tusdc-to-pool.ts
import { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = ethers.provider;
  const signer = (await ethers.getSigners())[0];

  const TUSDC_ADDRESS = process.env.TUSDC_ADDRESS!;
  const POOL_ADDRESS = process.env.POOL_ADDRESS!;
  const amount = ethers.parseUnits("5000", 6); // 5000 tUSDC (adjust)

  const tusdc = await ethers.getContractAt("IERC20Mintable", TUSDC_ADDRESS, signer);
  // If token has mint(address, uint256)
  const tx = await tusdc.mint(POOL_ADDRESS, amount);
  await tx.wait();
  console.log(`Minted ${amount} to pool ${POOL_ADDRESS}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
