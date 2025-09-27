/// <reference types="mocha" />
/// <reference types="chai" />
/// <reference types="hardhat" />
import hre from "hardhat";
import { expect } from "chai";

const ethers = (hre as any).ethers;

describe("Counter", function () {
  it("Should emit the Increment event when calling the inc() function", async function () {
    const Counter = await ethers.getContractFactory("Counter");
    const counter = await Counter.deploy();
    await counter.waitForDeployment();

    (expect(counter.inc()) as any).to.emit(counter, "Increment").withArgs(1n);

    const filter = counter.filters.Increment();
    const events = await counter.queryFilter(filter);

    let total = 0n;
    for (const event of events) {
      total += (event as any).args.by;
    }

    const val = await counter.current();
    expect(val).to.equal(total);
  });
});
