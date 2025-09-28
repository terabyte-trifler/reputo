// src/types.ts
export type Address = `0x${string}`;

export interface UserState {
  address: Address;
  collateral: bigint;
  debt: bigint;
  repayBuffer: bigint;     // optional if you also track buffer on-chain in UI
  repaidCount: number;
  liquidatedCount: number;
  txCount: number;         // count of meaningful protocol interactions
  firstLoanTs?: number | null;
  updatedAt: number;       // epoch ms
}

export interface ScoreFactors {
  historical: number;   // [0..1]
  current: number;      // [0..1]
  utilization: number;  // [0..1]
  activity: number;     // [0..1]
  newcomer: number;     // [0..1]
}

export interface IndexedScore {
  address: Address;
  scoreMicro: number;     // 0 best → 1_000_000 worst
  factors: ScoreFactors;
  updatedAt: number;      // epoch ms
}
