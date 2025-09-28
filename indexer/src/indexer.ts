// src/indexer.ts
import "dotenv/config";
import { ethers } from "ethers";
import { LENDING_POOL_ABI, OCCR_ABI } from "./abis.js";
import { initDb, getUser, upsertUser, upsertScore } from "./db.js";
import type { Address, UserState } from "./types.js";
import { computeFactors, scoreFromFactors } from "./occr.js";

const RPC = process.env.SEPOLIA_RPC_URL!;
const POOL_ADDR = process.env.LENDING_POOL_ADDRESS as Address;
const OCCR_ADDR = process.env.OCCR_SCORE_ADDRESS as Address;

if (!RPC || !POOL_ADDR || !OCCR_ADDR) {
  throw new Error("Missing env: SEPOLIA_RPC_URL, LENDING_POOL_ADDRESS, OCCR_SCORE_ADDRESS");
}

const provider = new ethers.JsonRpcProvider(RPC);
const pool = new ethers.Contract(POOL_ADDR, LENDING_POOL_ABI, provider);
const occr = new ethers.Contract(OCCR_ADDR, OCCR_ABI, provider);

function ensureUser(address: Address): UserState {
  const existing = getUser(address);
  if (existing) return existing;
  const now = Date.now();
  const blank: UserState = {
    address,
    collateral: 0n,
    debt: 0n,
    repayBuffer: 0n,
    repaidCount: 0,
    liquidatedCount: 0,
    txCount: 0,
    firstLoanTs: null,
    updatedAt: now,
  };
  upsertUser(blank);
  return blank;
}

async function refreshPosition(address: Address) {
  const [coll, debt] = await Promise.all([
    pool.valueOfCollateral(address), // this returns VALUE in debtAsset units (per your contract)
    pool.debtBalance(address)
  ]);
  const u = ensureUser(address);
  u.collateral = coll; // note: this is value, not raw token amount (OK for our off-chain math)
  u.debt = debt;
  u.txCount += 1;
  if (!u.firstLoanTs && debt > 0n) u.firstLoanTs = Date.now();
  u.updatedAt = Date.now();
  upsertUser(u);
  await recomputeScore(address);
}

async function recomputeScore(address: Address) {
  const u = ensureUser(address);
  const liqBps = Number(await pool.liqThresholdBps());
  const factors = computeFactors(u, liqBps);
  const scoreMicro = scoreFromFactors(factors);
  upsertScore({
    address,
    scoreMicro,
    factors,
    updatedAt: Date.now(),
  });
}

export async function startIndexer() {
  initDb();
  console.log("[indexer] connecting…");

  // — LendingPool events —
  pool.on("Deposit", async (user: Address, amount) => {
    console.log("[Deposit]", user, amount.toString());
    await refreshPosition(user);
  });

  pool.on("Borrow", async (user: Address, amount, userLTVbps) => {
    console.log("[Borrow]", user, amount.toString(), "LTV:", Number(userLTVbps));
    const u = ensureUser(user);
    u.txCount += 1;
    if (!u.firstLoanTs) u.firstLoanTs = Date.now();
    u.updatedAt = Date.now();
    upsertUser(u);
    await refreshPosition(user);
  });

  pool.on("Repay", async (user: Address, amount) => {
    console.log("[Repay]", user, amount.toString());
    const u = ensureUser(user);
    u.repaidCount += 1;
    u.txCount += 1;
    u.updatedAt = Date.now();
    upsertUser(u);
    await refreshPosition(user);
  });

  pool.on("Liquidate", async (user: Address, liquidator: Address, repayAmount, seized) => {
    console.log("[Liquidate]", user, "by", liquidator, "repay", repayAmount.toString());
    const u = ensureUser(user);
    u.liquidatedCount += 1;
    u.txCount += 1;
    u.updatedAt = Date.now();
    upsertUser(u);
    await refreshPosition(user);
  });

  // Optional buffer events (if emitting)
  pool.on("BufferDeposit", async (user: Address, amount) => {
    console.log("[BufferDeposit]", user, amount.toString());
    const u = ensureUser(user);
    u.txCount += 1;
    u.updatedAt = Date.now();
    upsertUser(u);
    await refreshPosition(user);
  });

  pool.on("BufferWithdraw", async (user: Address, amount) => {
    console.log("[BufferWithdraw]", user, amount.toString());
    const u = ensureUser(user);
    u.txCount += 1;
    u.updatedAt = Date.now();
    upsertUser(u);
    await refreshPosition(user);
  });

  pool.on("BufferRepay", async (user: Address, amount) => {
    console.log("[BufferRepay]", user, amount.toString());
    const u = ensureUser(user);
    u.repaidCount += 1;
    u.txCount += 1;
    u.updatedAt = Date.now();
    upsertUser(u);
    await refreshPosition(user);
  });

  // — OCCRScore event (on-chain score, for comparison charting) —
  occr.on("CreditScoreUpdated", async (user: Address, scoreMicro) => {
    console.log("[Onchain CreditScoreUpdated]", user, Number(scoreMicro));
    // We could store on-chain score in another table if you want to diff it in charts.
    // For simplicity, we only recompute off-chain when positions change.
  });

  console.log("[indexer] listening for events…");
}
