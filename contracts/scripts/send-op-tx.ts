/// <reference types="hardhat" />
import hre from "hardhat";

async function main() {
  const { network } = hre;

  const connection = await network.connect({
    network: "hardhatOp",
    chainType: "op",
  });

  const { ethers } = connection as any;

  console.log("Sending transaction using the OP chain type");
  const [sender] = await ethers.getSigners();

  console.log("Sending 1 wei from", sender.address, "to itself");

  const tx = await sender.sendTransaction({
    to: sender.address,
    value: 1n,
  });

  await tx.wait();
  console.log("Transaction sent successfully");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
