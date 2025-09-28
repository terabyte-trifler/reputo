import "dotenv/config";
import fetch from "node-fetch";
import { ethers } from "ethers";

const AMOY_RPC_URL = mustEnv("AMOY_RPC_URL");
const AGENT_PRIVATE_KEY = mustEnv("AGENT_PRIVATE_KEY");
const FRONTEND_TOPUP_URL = mustEnv("FRONTEND_TOPUP_URL");
const BORROWER_ADDR = mustEnv("BORROWER_ADDR");

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name} in agents/.env`);
  return v;
}

async function postJson(url: string, data: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });

  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!ct.includes("application/json")) {
    console.error("API returned non-JSON:", { __nonJson: true, status: res.status, text });
    throw new Error(`Non-JSON response (${res.status})`);
  }
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("Bad JSON:", text);
    throw new Error("Failed to parse JSON");
  }

  return { status: res.status, json };
}

async function main() {
  // Just to prove the wallet is valid (this throws if key is bad).
  const prov = new ethers.JsonRpcProvider(AMOY_RPC_URL);
  const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, prov);
  console.log("Agent wallet:", await wallet.getAddress());

  // 1) Ask for top-up without proof → expect 402 JSON challenge
  console.log("Requesting 402 challenge…");
  const { status: s1, json: j1 } = await postJson(FRONTEND_TOPUP_URL, {
    user: BORROWER_ADDR,
    minHealthFactor: 110000, // arbitrary demo value
  });

  if (s1 !== 402 || j1?.code !== 402) {
    throw new Error(`Expected 402, got ${s1}: ${JSON.stringify(j1)}`);
  }
  const sessionId = j1?.challenge?.sessionId;
  console.log("Challenge:", j1.challenge);

  // 2) (Prep) “Pay” the fee. For Day-4 we’ll send real USDC on Amoy.
  // Here we just send back a sentinel proof so the server accepts.
  console.log("Submitting payment proof (PREP sentinel) …");
  const { status: s2, json: j2 } = await postJson(FRONTEND_TOPUP_URL, {
    user: BORROWER_ADDR,
    proof: "DEMO_PAID",
    sessionId,
  });

  if (s2 !== 200) {
    throw new Error(`Payment not accepted: ${s2} ${JSON.stringify(j2)}`);
  }
  console.log("Accepted:", j2);
  console.log("Prep success ✅");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
