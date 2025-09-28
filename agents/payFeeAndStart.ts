import "dotenv/config";
import fetch from "node-fetch";
import { ethers } from "ethers";

const {
  AMOY_RPC_URL,
  AGENT_PRIVATE_KEY,
  FRONTEND_TOPUP_URL,
  BORROWER_ADDR,
  MIN_HEALTH_FACTOR_BPS // e.g., 12000
} = process.env;

if (!AMOY_RPC_URL || !AGENT_PRIVATE_KEY || !FRONTEND_TOPUP_URL || !BORROWER_ADDR) {
  console.error("Missing env in agents/.env");
  process.exit(1);
}

const LOOP_SEC = 20;

async function main() {
  const amoy = new ethers.JsonRpcProvider(AMOY_RPC_URL);
  const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY!, amoy);
  console.log("Agent wallet:", wallet.address);

  while (true) {
    try {
      // 1) Ask server to topup → expect 402
      console.log("Requesting 402 challenge…");
      const res = await fetch(FRONTEND_TOPUP_URL!, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user: BORROWER_ADDR,
          minHF: MIN_HEALTH_FACTOR_BPS ? Number(MIN_HEALTH_FACTOR_BPS) : 12000
        })
      });

      if (res.status === 200) {
        const ok = await res.json();
        console.log("No repay needed:", ok);
        await wait(LOOP_SEC);
        continue;
      }

      if (res.status !== 402) {
        const txt = await res.text();
        console.log("Unexpected status", res.status, txt);
        await wait(LOOP_SEC);
        continue;
      }

      const chall = await res.json(); // {payTo, amountWei, token, chain, session}
      console.log("402:", chall);

      if (chall.token !== "MATIC") {
        console.log("Server requires non-MATIC token; demo supports only MATIC now.");
        await wait(LOOP_SEC);
        continue;
      }

      // 2) Pay MATIC on Amoy
      const tx = await wallet.sendTransaction({
        to: chall.payTo,
        value: BigInt(chall.amountWei)
      });
      console.log("Fee sent:", tx.hash);
      const rc = await tx.wait();
      if (rc?.status !== 1) {
        console.log("Fee tx failed");
        await wait(LOOP_SEC);
        continue;
      }

      // 3) Call topup again with proof
      const res2 = await fetch(FRONTEND_TOPUP_URL!, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user: BORROWER_ADDR,
          minHF: MIN_HEALTH_FACTOR_BPS ? Number(MIN_HEALTH_FACTOR_BPS) : 12000,
          proofTxHash: tx.hash,
          session: chall.session
        })
      });

      const out = await safeJson(res2);
      console.log("Topup result:", out);
    } catch (e) {
      console.error(e);
    }

    await wait(LOOP_SEC);
  }
}

function wait(s: number) {
  return new Promise((r) => setTimeout(r, s * 1000));
}

async function safeJson(res: any) {
  try {
    return await res.json();
  } catch {
    const txt = await res.text();
    return { __nonJson: true, status: res.status, text: txt };
  }
}

main().catch(console.error);
