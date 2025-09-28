// src/server.ts
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import { z } from "zod";
import { startIndexer } from "./indexer.js";
import { getScore, getUser } from "./db.js";
import type { Address } from "./types.js";

const app = express();
app.use(express.json());
app.use(morgan("dev"));

const AddrParam = z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) });

app.get("/api/scores/:address", (req, res) => {
  const p = AddrParam.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: "invalid address" });
  const address = p.data.address as Address;
  const s = getScore(address);
  if (!s) return res.status(404).json({ error: "not indexed yet" });
  res.json(s);
});

app.get("/api/users/:address/position", (req, res) => {
  const p = AddrParam.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: "invalid address" });
  const address = p.data.address as Address;
  const u = getUser(address);
  if (!u) return res.status(404).json({ error: "not indexed yet" });

  // Approx HF (bps) using values we cached (valueOfCollateral already in debt units)
  const liqThresholdBps = 5500; // keep in sync with your on-chain config or fetch dynamically and cache
  const hfBps =
    u.debt > 0n
      ? Number(((u.collateral * BigInt(liqThresholdBps)) / 10000n) * 10000n / u.debt)
      : 9_999_999;

  res.json({
    address,
    collateralValue: u.collateral.toString(),
    debt: u.debt.toString(),
    repayBuffer: u.repayBuffer.toString(),
    healthFactorBps: hfBps,
    updatedAt: u.updatedAt,
  });
});

const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, async () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  await startIndexer();
});
