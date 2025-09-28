import hre from "hardhat";
import fs from "fs";

async function main() {
  const { root } = JSON.parse(fs.readFileSync("merkleRoot.json","utf-8"));
  const identityAddr = process.env.IDENTITY_ADDRESS!;
  const identity = await hre.ethers.getContractAt("IdentityVerifier", identityAddr);
  const tx = await identity.setMerkleRoot(root);
  console.log("setMerkleRoot tx:", tx.hash);
  await tx.wait();
  console.log("Updated root:", root);
}

main().catch((e)=>{ console.error(e); process.exit(1); });
