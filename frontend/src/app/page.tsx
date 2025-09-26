"use client";
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getProvider, OCCR_ABI, OCCR_ADDRESS, POOL_ABI, POOL_ADDRESS } from "@/lib/contracts";

export default function Home() {
  const [addr, setAddr] = useState<string>("");
  const [score, setScore] = useState<string>("—");
  const [coll, setColl] = useState<string>("0");
  const [debt, setDebt] = useState<string>("0");

  async function connect() {
    const provider = getProvider();
    const accounts = await (provider as any).send("eth_requestAccounts", []);
    setAddr(accounts[0]);
  }

  useEffect(() => {
    (async () => {
      if (!addr) return;
      const provider = getProvider();
      const signer = await (provider as any).getSigner();
      const occr = new ethers.Contract(OCCR_ADDRESS, OCCR_ABI, signer);
      const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, signer);
      const s = await occr.getScore(addr);
      const c = await pool.collateralBalance(addr);
      const d = await pool.debtBalance(addr);
      setScore((Number(s) / 1_000_000).toFixed(3)); // show 0..1
      setColl(ethers.formatUnits(c, 18));
      setDebt(ethers.formatUnits(d, 6)); // assume debtAsset has 6 decimals later
    })();
  }, [addr]);

  return (
    <main style={{ padding: 24, maxWidth: 820, margin: "0 auto" }}>
      <h1>OCCR DeFi — Day 1</h1>
      <button onClick={connect} style={{ padding: 8, marginTop: 12 }}>
        {addr ? `Connected: ${addr.slice(0,6)}...${addr.slice(-4)}` : "Connect Wallet"}
      </button>
      <div style={{ marginTop: 24 }}>
        <p>OCCR Score: <b>{score}</b> (0..1)</p>
        <p>Collateral: <b>{coll}</b></p>
        <p>Debt: <b>{debt}</b></p>
      </div>
    </main>
  );
}
