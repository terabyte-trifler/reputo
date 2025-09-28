// src/db.ts
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { Address, UserState, IndexedScore } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "reputo_indexer.sqlite");

const db = new Database(DB_PATH);

export function initDb() {
  db.exec(`
    PRAGMA journal_mode=WAL;

    CREATE TABLE IF NOT EXISTS users (
      address TEXT PRIMARY KEY,
      collateral TEXT NOT NULL,
      debt TEXT NOT NULL,
      repayBuffer TEXT NOT NULL DEFAULT '0',
      repaidCount INTEGER NOT NULL DEFAULT 0,
      liquidatedCount INTEGER NOT NULL DEFAULT 0,
      txCount INTEGER NOT NULL DEFAULT 0,
      firstLoanTs INTEGER,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scores (
      address TEXT PRIMARY KEY,
      scoreMicro INTEGER NOT NULL,
      historical REAL NOT NULL,
      current REAL NOT NULL,
      utilization REAL NOT NULL,
      activity REAL NOT NULL,
      newcomer REAL NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);
}

const upsertUserStmt = db.prepare(`
INSERT INTO users (address, collateral, debt, repayBuffer, repaidCount, liquidatedCount, txCount, firstLoanTs, updatedAt)
VALUES (@address, @collateral, @debt, @repayBuffer, @repaidCount, @liquidatedCount, @txCount, @firstLoanTs, @updatedAt)
ON CONFLICT(address) DO UPDATE SET
  collateral=excluded.collateral,
  debt=excluded.debt,
  repayBuffer=excluded.repayBuffer,
  repaidCount=excluded.repaidCount,
  liquidatedCount=excluded.liquidatedCount,
  txCount=excluded.txCount,
  firstLoanTs=excluded.firstLoanTs,
  updatedAt=excluded.updatedAt
`);

const getUserStmt = db.prepare(`SELECT * FROM users WHERE address=?`);

const upsertScoreStmt = db.prepare(`
INSERT INTO scores (address, scoreMicro, historical, current, utilization, activity, newcomer, updatedAt)
VALUES (@address, @scoreMicro, @historical, @current, @utilization, @activity, @newcomer, @updatedAt)
ON CONFLICT(address) DO UPDATE SET
  scoreMicro=excluded.scoreMicro,
  historical=excluded.historical,
  current=excluded.current,
  utilization=excluded.utilization,
  activity=excluded.activity,
  newcomer=excluded.newcomer,
  updatedAt=excluded.updatedAt
`);

const getScoreStmt = db.prepare(`SELECT * FROM scores WHERE address=?`);

export function upsertUser(u: UserState) {
  upsertUserStmt.run({
    ...u,
    collateral: u.collateral.toString(),
    debt: u.debt.toString(),
    repayBuffer: u.repayBuffer.toString(),
  });
}

export function getUser(address: Address): UserState | null {
  const row = getUserStmt.get(address) as any;
  if (!row) return null;
  return {
    address: row.address,
    collateral: BigInt(row.collateral),
    debt: BigInt(row.debt),
    repayBuffer: BigInt(row.repayBuffer),
    repaidCount: row.repaidCount,
    liquidatedCount: row.liquidatedCount,
    txCount: row.txCount,
    firstLoanTs: row.firstLoanTs ?? null,
    updatedAt: row.updatedAt,
  };
}

export function upsertScore(s: IndexedScore) {
  upsertScoreStmt.run({
    address: s.address,
    scoreMicro: s.scoreMicro,
    historical: s.factors.historical,
    current: s.factors.current,
    utilization: s.factors.utilization,
    activity: s.factors.activity,
    newcomer: s.factors.newcomer,
    updatedAt: s.updatedAt,
  });
}

export function getScore(address: Address): IndexedScore | null {
  const r = getScoreStmt.get(address) as any;
  if (!r) return null;
  return {
    address: r.address,
    scoreMicro: r.scoreMicro,
    factors: {
      historical: r.historical,
      current: r.current,
      utilization: r.utilization,
      activity: r.activity,
      newcomer: r.newcomer,
    },
    updatedAt: r.updatedAt,
  };
}

// Allow CLI init
if (process.argv.includes("--init")) {
  initDb();
  console.log("DB initialized at", DB_PATH);
}
