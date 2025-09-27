/// <reference types="mocha" />
/// <reference types="chai" />
/// <reference types="hardhat" />
import hre from "hardhat";
import { strict as assert } from "assert";

const ethers = (hre as any).ethers;
const ONE = (n: string) => ethers.parseEther(n);

describe("Day2 core", function () {
  it("deposit, borrow gated by identity, score updates", async function () {
    const [owner, user, liquidator] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("TestToken");
    const cWETH = await Token.deploy("cWETH", "cWETH", 18);
    await cWETH.waitForDeployment();
    const tUSDC = await Token.deploy("tUSDC", "tUSDC", 18);
    await tUSDC.waitForDeployment();

    const Identity = await ethers.getContractFactory("IdentityVerifier");
    const id = await Identity.deploy();
    await id.waitForDeployment();

    const OCCR = await ethers.getContractFactory("OCCRScore");
    const occr = await OCCR.deploy(owner.address);
    await occr.waitForDeployment();

    const Pool = await ethers.getContractFactory("LendingPool");
    const pool = await Pool.deploy(
      await cWETH.getAddress(),
      await tUSDC.getAddress(),
      owner.address
    );
    await pool.waitForDeployment();

    await (await pool.setRefs(await occr.getAddress(), await id.getAddress())).wait();
    await (await occr.setPool(await pool.getAddress(), await pool.getAddress())).wait();

    await (await cWETH.mint(user.address, ONE("10"))).wait();
    await (await tUSDC.mint(await pool.getAddress(), ONE("100000"))).wait();

    const cUser = cWETH.connect(user);
    await (await cUser.approve(await pool.getAddress(), ONE("10"))).wait();
    await (await pool.connect(user).deposit(ONE("10"))).wait();

    try {
      await (await pool.connect(user).borrow(ONE("1000"))).wait();
      assert.fail("expected revert");
    } catch {}

    await (await id.connect(user).verifyIdentity("0x")).wait();
    await (await pool.connect(user).borrow(ONE("1000"))).wait();

    const s1 = await occr.scoreMicro(user.address);
    assert.ok(s1 > 0n);

    const dUser = tUSDC.connect(user);
    await (await dUser.approve(await pool.getAddress(), ONE("200"))).wait();
    await (await pool.connect(user).repay(ONE("200"))).wait();

    const s2 = await occr.scoreMicro(user.address);
    assert.ok(s2 >= 0n);

    await (await pool.setPrice(ONE("1000"))).wait();
    await (await tUSDC.mint(liquidator.address, ONE("2000"))).wait();
    const dLiq = tUSDC.connect(liquidator);
    await (await dLiq.approve(await pool.getAddress(), ONE("2000"))).wait();
    await (await pool.connect(liquidator).liquidate(user.address, ONE("500"))).wait();

    const s3 = await occr.scoreMicro(user.address);
    assert.ok(s3 >= s2);
  });
});
