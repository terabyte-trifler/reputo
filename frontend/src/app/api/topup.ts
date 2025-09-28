// /frontend/src/pages/api/topup.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";

// Minimal ABI for what we need
const LENDING_POOL_ABI = [
  "function liqThresholdBps() view returns (uint16)",
  "function valueOfCollateral(address) view returns (uint256)",
  "function debtBalance(address) view returns (uint256)",
  "function repayBuffer(address) view returns (uint256)",
  "function repayFromBuffer(address user, uint256 amount)"
];

function asBigInt(v: string | number | bigint) {
  return BigInt(v as any);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }
    const {
      user,
      minHF,           // optional: raw integer like 12000 (1.20x in bps)
      proofTxHash,     // optional: Polygon payment tx hash
      session          // optional: echo back session
    } = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) ?? {};

    // Load env
    const AMOY_RPC_URL = process.env.AMOY_RPC_URL!;
    const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL!;
    const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY!;
    const POOL_ADDR = process.env.NEXT_PUBLIC_POOL_ADDRESS!;
    const FEE_TOKEN = (process.env.X402_FEE_TOKEN || "MATIC").toUpperCase();
    const FEE_AMOUNT_WEI = asBigInt(process.env.X402_FEE_AMOUNT_WEI || "1000000000000000"); // 0.001 MATIC
    const PAY_TO = process.env.X402_PAYTO!;

    if (!user || !POOL_ADDR || !SEPOLIA_RPC_URL || !AMOY_RPC_URL || !SERVER_PRIVATE_KEY || !PAY_TO) {
      return res.status(500).json({ error: "Server env misconfigured" });
    }

    // 1) First call (no proof): return 402 challenge
    if (!proofTxHash) {
      const challenge = {
        payTo: PAY_TO,
        amountWei: FEE_AMOUNT_WEI.toString(),
        token: FEE_TOKEN,              // "MATIC"
        chain: "polygon-amoy",
        session: session ?? crypto.randomUUID(),
      };
      // HTTP 402 with JSON payload
      res.status(402).json(challenge);
      return;
    }

    // 2) Validate payment on Polygon Amoy
    const amoy = new ethers.JsonRpcProvider(AMOY_RPC_URL);
    const tx = await amoy.getTransaction(proofTxHash);
    if (!tx) return res.status(400).json({ error: "Invalid proofTxHash: tx not found" });

    if (FEE_TOKEN === "MATIC") {
      if (!tx.to || tx.to.toLowerCase() !== PAY_TO.toLowerCase()) {
        return res.status(400).json({ error: "Fee NOT sent to payTo" });
      }
      if (tx.value < FEE_AMOUNT_WEI) {
        return res.status(400).json({ error: "Fee amount too small" });
      }
      const receipt = await amoy.getTransactionReceipt(proofTxHash);
      if (!receipt || receipt.status !== 1) {
        return res.status(400).json({ error: "Fee tx failed or pending" });
      }
    } else {
      // (Optional) USDC verification branch can be added later (parse Transfer logs)
      return res.status(400).json({ error: "Only MATIC supported in this demo" });
    }

    // 3) Compute repay amount to reach target HF, bounded by repayBuffer[user]
    const sepolia = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const signer = new ethers.Wallet(SERVER_PRIVATE_KEY, sepolia);
    const pool = new ethers.Contract(POOL_ADDR, LENDING_POOL_ABI, signer);

    const [liqBps, collVal, debt, buffer] = await Promise.all([
      pool.liqThresholdBps(),
      pool.valueOfCollateral(user),
      pool.debtBalance(user),
      pool.repayBuffer(user),
    ]);

    const liqThresholdBps = Number(liqBps);
    const currentHF_bps = debt > 0n
      ? Number((collVal * BigInt(liqThresholdBps) / 10000n) * 10000n / debt) // scaled to bps
      : 9999999; // no debt → super high HF

    // Target HF bps (default 12000 = 1.20x)
    const targetHF_bps = minHF ? Number(minHF) : 12000;
    if (currentHF_bps >= targetHF_bps) {
      return res.status(200).json({ ok: true, note: "Already safe", currentHF_bps });
    }

    // Solve for maxDebtAllowed = (collVal * liqBps / 10000) / (targetHF_bps/10000)
    // repayNeeded = debt - maxDebtAllowed
    const num = collVal * BigInt(liqThresholdBps);           // collVal * liqBps
    const denom = BigInt(targetHF_bps);                      // bps
    const maxDebtAllowed = (num * 10000n) / (denom * 10000n); // careful scaling → simplifies to num/denom if already in bps units

    const repayNeeded = debt > maxDebtAllowed ? (debt - maxDebtAllowed) : 0n;
    if (repayNeeded === 0n) {
      return res.status(200).json({ ok: true, note: "No repay needed", currentHF_bps });
    }

    const repayAmount = repayNeeded <= buffer ? repayNeeded : buffer;
    if (repayAmount === 0n) {
      return res.status(200).json({ ok: false, note: "repayBuffer empty", currentHF_bps });
    }

    // 4) Call repayFromBuffer
    const tx2 = await pool.repayFromBuffer(user, repayAmount);
    const rc2 = await tx2.wait();
    return res.status(200).json({
      ok: true,
      repaid: repayAmount.toString(),
      txHash: rc2?.hash ?? tx2.hash,
      previousHF_bps: currentHF_bps,
      targetHF_bps,
    });

  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Server error" });
  }
}
