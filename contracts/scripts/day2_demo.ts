/// <reference types="hardhat" />
import hre from "hardhat";
const ethers = (hre as any).ethers;

const ONE = (n: string) => ethers.parseEther(n);

async function main() {
  const [user, liquidator] = await ethers.getSigners();

  // paste addresses from deploy step
  const poolAddr = "PASTE_POOL";
  const occrAddr = "PASTE_OCCR";
  const identityAddr = "PASTE_ID";
  const cWETHAddr = "PASTE_CWETH";
  const tUSDCAddr = "PASTE_TUSDC";

  const pool = await ethers.getContractAt("LendingPool", poolAddr);
  const occr = await ethers.getContractAt("OCCRScore", occrAddr);
  const id = await ethers.getContractAt("IdentityVerifier", identityAddr);
  const cWETH = await ethers.getContractAt("TestToken", cWETHAddr);
  const tUSDC = await ethers.getContractAt("TestToken", tUSDCAddr);

  console.log("User:", user.address, "Liquidator:", liquidator.address);

  await (await cWETH.approve(poolAddr, ONE("10"))).wait();
  await (await pool.deposit(ONE("10"))).wait();
  console.log("Deposited 10 cWETH");

  try {
    await (await pool.borrow(ONE("1000"))).wait();
  } catch {
    console.log("Borrow blocked by identity check ✅");
  }

  await (await id.verifyIdentity("0x")).wait();
  console.log("Identity verified");

  await (await pool.borrow(ONE("1000"))).wait();
  console.log("Borrowed 1000 tUSDC");

  let score = await occr.scoreMicro(user.address);
  console.log("Score after borrow (micro):", score.toString());

  await (await tUSDC.approve(poolAddr, ONE("200"))).wait();
  await (await pool.repay(ONE("200"))).wait();
  console.log("Repaid 200 tUSDC");

  score = await occr.scoreMicro(user.address);
  console.log("Score after repay (micro):", score.toString());

  await (await pool.setPrice(ONE("1000"))).wait();
  console.log("Price dropped to 1000");

  await (await tUSDC.mint(liquidator.address, ONE("2000"))).wait();
  const tUSDCFromLiq = tUSDC.connect(liquidator);
  await (await tUSDCFromLiq.approve(poolAddr, ONE("2000"))).wait();
  await (await pool.connect(liquidator).liquidate(user.address, ONE("500"))).wait();
  console.log("Liquidation executed");

  score = await occr.scoreMicro(user.address);
  console.log("Score after liquidation (micro):", score.toString());

  const base = await pool.baseLTVbps();
  const userLTV = await occr.getMaxLTVbps(user.address, base);
  console.log(`Base LTV bps=${base}, User LTV bps=${userLTV}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
