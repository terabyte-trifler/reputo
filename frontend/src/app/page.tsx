"use client";
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { CHAINS, ChainKey } from "@/lib/chains";
import { makeJsonProvider, getBrowserProvider } from "@/lib/provider";


export default function Home() {
  const [account, setAccount] = useState<string>("");
  const [active, setActive] = useState<ChainKey>("sepolia");
  const [blocks, setBlocks] = useState<Record<string, string>>({});

  async function connect() {
    const prov = getBrowserProvider();
    if (!prov) return alert("Install MetaMask");
    const accounts = await prov.send("eth_requestAccounts", []);
    setAccount(accounts[0]);
  }

  async function testRPCs() {
    const out: Record<string, string> = {};
    for (const key of Object.keys(CHAINS) as ChainKey[]) {
      const rpc = CHAINS[key].rpc;
      const p = makeJsonProvider(rpc);
      const bn = await p.getBlockNumber();
      out[key] = bn.toString();
    }
    setBlocks(out);
  }

  useEffect(() => { testRPCs(); }, []);

  return (
    <main style={{ padding: 24, maxWidth: 920, margin: "0 auto" }}>
      <h1>OCCR DeFi — Day 1</h1>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button onClick={connect}>
          {account ? `Connected: ${account.slice(0,6)}...${account.slice(-4)}` : "Connect Wallet"}
        </button>
        <select value={active} onChange={(e) => setActive(e.target.value as ChainKey)}>
          {Object.entries(CHAINS).map(([k, v]) => (
            <option key={k} value={k}>{v.name}</option>
          ))}
        </select>
        <button onClick={testRPCs}>Test RPCs</button>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>RPC latest blocks</h3>
        <pre>{JSON.stringify(blocks, null, 2)}</pre>
      </div>

      <hr style={{ margin: "24px 0" }} />
      <h2>Coming up</h2>
      <ul>
        <li>Dashboard (collateral, debt, OCCR score)</li>
        <li>Loan page (deposit/borrow/repay)</li>
        <li>Profile/Identity (Self Protocol verification)</li>
      </ul>
    </main>
  );
}

