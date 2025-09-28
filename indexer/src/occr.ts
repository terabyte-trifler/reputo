// src/occr.ts
import type { ScoreFactors, UserState } from "./types.js";

/**
 * Factor explanations (0 best → 1 worst):
 * - historical: 0 if many repays and no liquidations; approaches 1 if many liquidations.
 * - current: based on health vs liq-threshold; 0 if very safe, 1 if underwater or close.
 * - utilization: debt / maxBorrowable approximation; here: debt / (collateral * baseLTV) with baseLTV=0.5 for off-chain.
 * - activity: fewer interactions = worse (agents prefer active, battle-tested users).
 * - newcomer: earlier firstLoanTs = better; new users penalized slightly.
 */
export function computeFactors(u: UserState, liqThresholdBps: number): ScoreFactors {
  const now = Date.now();

  // historical
  const totalEvents = u.repaidCount + u.liquidatedCount;
  const historical =
    totalEvents === 0
      ? 0.6 // unknown history is middling
      : Math.min(
          1,
          // liquidation share weighs heavier
          (u.liquidatedCount * 1.0) / Math.max(1, totalEvents)
        );

  // current (HF distance from threshold)
  // HF_bps = (value * liqBps / debt) * 10000  (we store collateral/debt but not price here; approximate using debt & collateral only)
  // Without price, approximate "safety" by collateral/debt vs threshold:
  let current = 0.5;
  if (u.debt === 0n) {
    current = 0.0;
  } else {
    // proxy: if collateral very low vs debt → worse
    const ratio = Number(u.collateral > 0n ? (u.collateral * 10000n) / u.debt : 0n); // pseudo-bps
    // if ratio >> liqThresholdBps ⇒ safe (0); if ratio << liqThresholdBps ⇒ risky (→1)
    const d = Math.max(0, liqThresholdBps - Math.min(ratio, liqThresholdBps));
    current = Math.min(1, d / liqThresholdBps);
  }

  // utilization (assume baseLTV=50% off-chain)
  const baseLTV = 0.5;
  const maxBorrowApprox = Number(u.collateral) * baseLTV;
  const utilization =
    maxBorrowApprox <= 0 ? 0 : Math.min(1, Number(u.debt) / maxBorrowApprox);

  // activity (more txCount ⇒ better)
  const activity =
    u.txCount >= 10 ? 0 : 1 - Math.min(1, u.txCount / 10);

  // newcomer (older firstLoanTs ⇒ better)
  let newcomer = 0.5;
  if (u.firstLoanTs) {
    const ageDays = (now - u.firstLoanTs) / (1000 * 60 * 60 * 24);
    newcomer = ageDays >= 30 ? 0 : 1 - Math.min(1, ageDays / 30);
  }

  return { historical, current, utilization, activity, newcomer };
}

export function scoreFromFactors(f: ScoreFactors): number {
  const w = {
    historical: 0.35,
    current: 0.25,
    utilization: 0.15,
    activity: 0.15,
    newcomer: 0.10,
  };
  const s =
    f.historical * w.historical +
    f.current * w.current +
    f.utilization * w.utilization +
    f.activity * w.activity +
    f.newcomer * w.newcomer;
  // Normalize into micro (0 best → 1_000_000 worst)
  return Math.floor(s * 1_000_000);
}
