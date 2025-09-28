import "dotenv/config";
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC!;
const IDENTITY_ADDR = process.env.NEXT_PUBLIC_IDENTITY_ADDRESS!;
const PK = process.env.SETVERIFIER_PRIVATE_KEY!;

const IDENTITY_ABI = [
  "function setVerified(address user, bool v) external",
  "function isVerified(address) view returns (bool)"
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { user } = body as { user?: string };

    if (!user || !ethers.isAddress(user)) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
    }

    // Here is where you'd normally verify the Self proof off-chain:
    // e.g., POST to Self verifier, validate JWT/attestation, check nonce, etc.
    // For hackathon: assume the proof has been validated off-chain.
    // If you'd like, require { proof: <string> } and validate it here.

    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PK, provider);
    const contract = new ethers.Contract(IDENTITY_ADDR, IDENTITY_ABI, wallet);

    const tx = await contract.setVerified(user, true);
    await tx.wait();

    return NextResponse.json({ ok: true, txHash: tx.hash });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "failed" }, { status: 500 });
  }
}
