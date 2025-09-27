import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("Lending + OCCR + Identity + Repay Buffer", function () {
  async function setup() {
    const [deployer, user, liquidator] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("TestToken");
    const cWETH = await Token.deploy("Collateral WETH", "cWETH", 18);
    const tUSDC = await Token.deploy("Test USDC", "tUSDC", 18);

    await cWETH.waitForDeployment();
    await tUSDC.waitForDeployment();

    const Identity = await ethers.getContractFactory("IdentityVerifier");
    const identity = await Identity.deploy();
    await identity.waitForDeployment();

    const OCCR = await ethers.getContractFactory("OCCRScore");
    const occr = await OCCR.deploy(await deployer.getAddress());
    await occr.waitForDeployment();

    const Pool = await ethers.getContractFactory("LendingPool");
    const pool = await Pool.deploy(await cWETH.getAddress(), await tUSDC.getAddress(), await deployer.getAddress());
    await pool.waitForDeployment();

    // wire refs
    await (await pool.setRefs(await occr.getAddress(), await identity.getAddress())).wait();
    await (await occr.setPool(await pool.getAddress(), await pool.getAddress())).wait();

    // seed: mint collateral to user & debt liquidity to pool & approvals
    await (await cWETH.mint(await user.getAddress(), ethers.parseEther("10"))).wait();
    await (await tUSDC.mint(await pool.getAddress(), ethers.parseEther("100000"))).wait();

    // identity verify the user
    await (await identity.adminSetVerified(await user.getAddress(), true)).wait();

    // set price (2000) — default matches, but set anyway
    await (await pool.setPrice(ethers.parseEther("2000"))).wait();

    return { deployer, user, liquidator, cWETH, tUSDC, identity, occr, pool };
  }

  it("deposit → borrow within LTV → repay", async () => {
    const { user, cWETH, tUSDC, pool } = await setup();

    const u = await user.getAddress();

    // user approves & deposits 1 cWETH
    await (await cWETH.connect(user).approve(await pool.getAddress(), ethers.parseEther("1"))).wait();
    await (await pool.connect(user).deposit(ethers.parseEther("1"))).wait();

    // user borrows 100 tUSDC (well below any LTV calculation)
    await (await pool.connect(user).borrow(ethers.parseEther("100"))).wait();

    let [, debt] = await pool.getUserPositions(u);
    expect(debt).to.equal(ethers.parseEther("100"));

    // user repays 40
    await (await tUSDC.mint(u, ethers.parseEther("40"))).wait();
    await (await tUSDC.connect(user).approve(await pool.getAddress(), ethers.parseEther("40"))).wait();
    await (await pool.connect(user).repay(ethers.parseEther("40"))).wait();

    [, debt] = await pool.getUserPositions(u);
    expect(debt).to.equal(ethers.parseEther("60"));
  });

  it("repay buffer: depositBuffer → repayFromBuffer", async () => {
    const { user, cWETH, tUSDC, pool } = await setup();
    const u = await user.getAddress();

    // deposit collateral 1 cWETH
    await (await cWETH.connect(user).approve(await pool.getAddress(), ethers.parseEther("1"))).wait();
    await (await pool.connect(user).deposit(ethers.parseEther("1"))).wait();

    // borrow 100
    await (await pool.connect(user).borrow(ethers.parseEther("100"))).wait();

    // user funds buffer with 50
    await (await tUSDC.mint(u, ethers.parseEther("50"))).wait();
    await (await tUSDC.connect(user).approve(await pool.getAddress(), ethers.parseEther("50"))).wait();
    await (await pool.connect(user).depositBuffer(ethers.parseEther("50"))).wait();

    // repay 30 from buffer
    await (await pool.connect(user).repayFromBuffer(ethers.parseEther("30"))).wait();

    let [, debt] = await pool.getUserPositions(u);
    expect(debt).to.equal(ethers.parseEther("70"));

    // withdraw remaining 20 buffer
    await (await pool.connect(user).withdrawBuffer(ethers.parseEther("20"))).wait();
  });

  it("liquidation path math sanity", async () => {
    const { user, liquidator, cWETH, tUSDC, pool } = await setup();
    const u = await user.getAddress();

    // user deposits 1 cWETH and borrows 1000 (close to 50% of $2000 value = $1000)
    await (await cWETH.connect(user).approve(await pool.getAddress(), ethers.parseEther("1"))).wait();
    await (await pool.connect(user).deposit(ethers.parseEther("1"))).wait();
    await (await pool.connect(user).borrow(ethers.parseEther("1000"))).wait();

    // price drops from 2000 -> 1500; threshold is 55% of value => 825; user debt=1000 > 825 => underwater
    await (await pool.setPrice(ethers.parseEther("1500"))).wait();
    expect(await pool.isUnderwater(u)).to.equal(true);

    // liquidator repays 200 and receives seized collateral
    await (await tUSDC.mint(await liquidator.getAddress(), ethers.parseEther("200"))).wait();
    await (await tUSDC.connect(liquidator).approve(await pool.getAddress(), ethers.parseEther("200"))).wait();
    await (await pool.connect(liquidator).liquidate(u, ethers.parseEther("200"))).wait();

    const [, debtAfter] = await pool.getUserPositions(u);
    expect(debtAfter).to.equal(ethers.parseEther("800")); // 1000 - 200
  });

  it("repayOnBehalf reduces borrower debt", async () => {
    const { user, liquidator, cWETH, tUSDC, pool } = await setup();

    // user borrows 100
    await (await cWETH.connect(user).approve(await pool.getAddress(), ethers.parseEther("1"))).wait();
    await (await pool.connect(user).deposit(ethers.parseEther("1"))).wait();
    await (await pool.connect(user).borrow(ethers.parseEther("100"))).wait();

    // third-party repay 25 on behalf
    await (await tUSDC.mint(await liquidator.getAddress(), ethers.parseEther("25"))).wait();
    await (await tUSDC.connect(liquidator).approve(await pool.getAddress(), ethers.parseEther("25"))).wait();
    await (await pool.connect(liquidator).repayOnBehalf(await user.getAddress(), ethers.parseEther("25"))).wait();

    const [, debt] = await pool.getUserPositions(await user.getAddress());
    expect(debt).to.equal(ethers.parseEther("75"));
  });
});
