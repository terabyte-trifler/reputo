"use client";

import { useEffect, useMemo, useState } from "react";
import { Contract, JsonRpcProvider, BrowserProvider, formatUnits, parseUnits } from "@/lib/ethers";
import { ERC20_ABI, LENDING_POOL_ABI, OCCR_ABI } from "@/lib/abis";
import { ADDR, RPC } from "@/lib/addresses";

type Numish = string | number;

const toBN = (v: Numish) => (typeof v === "string" ? v : String(v));

export default function Home() {
  const [rpcOk, setRpcOk] = useState(false);
  const [account, setAccount] = useState<string>("");
  const [owner, setOwner] = useState<string>("");
  const [decimals, setDecimals] = useState({ col: 18, debt: 18 });
  const [symbols, setSymbols] = useState({ col: "COL", debt: "DEBT" });

  const [collateralWallet, setCollateralWallet] = useState("0");
  const [debtWallet, setDebtWallet] = useState("0");

  const [collateralOnPool, setCollateralOnPool] = useState("0");
  const [debtOnPool, setDebtOnPool] = useState("0");
  const [buffer, setBuffer] = useState("0");

  const [valueOfColl, setValueOfColl] = useState("0");
  const [maxBorrowable, setMaxBorrowable] = useState("0");
  const [hf, setHf] = useState("0");
  const [price, setPrice] = useState("0");
  const [ltv, setLtv] = useState(0);
  const [liqBps, setLiqBps] = useState(0);
  const [score, setScore] = useState<number>(0);

  const [amtDeposit, setAmtDeposit] = useState("");
  const [amtBorrow, setAmtBorrow] = useState("");
  const [amtRepay, setAmtRepay] = useState("");
  const [amtBufDep, setAmtBufDep] = useState("");
  const [amtBufWdraw, setAmtBufWdraw] = useState("");
  const [amtBufRepay, setAmtBufRepay] = useState("");
  const [adminPrice, setAdminPrice] = useState("");

  const readProv = useMemo(() => new JsonRpcProvider(RPC.SEPOLIA), []);
  const pool = useMemo(() => new Contract(ADDR.POOL, LENDING_POOL_ABI, readProv), [readProv]);
  const occr = useMemo(() => new Contract(ADDR.OCCR, OCCR_ABI, readProv), [readProv]);
  const col = useMemo(() => new Contract(ADDR.COLLATERAL, ERC20_ABI, readProv), [readProv]);
  const debt = useMemo(() => new Contract(ADDR.DEBT, ERC20_ABI, readProv), [readProv]);

  async function connect() {
    const browser = new BrowserProvider((window as any).ethereum);
    await browser.send("eth_requestAccounts", []);
    const signer = await browser.getSigner();
    const addr = await signer.getAddress();
    setAccount(addr);
  }

  async function refresh() {
    try {
      await readProv.getBlockNumber();
      setRpcOk(true);
    } catch {
      setRpcOk(false);
      return;
    }

    // meta
    const [colDec, debtDec, colSym, debtSym] = await Promise.all([
      col.decimals(), debt.decimals(), col.symbol(), debt.symbol()
    ]);
    setDecimals({ col: Number(colDec), debt: Number(debtDec) });
    setSymbols({ col: colSym, debt: debtSym });

    const [own, baseLTV, liq, price1e18] = await Promise.all([
      pool.owner(),
      pool.baseLTVbps(),
      pool.liqThresholdBps(),
      pool.price1e18(),
    ]);
    setOwner(own);
    setLtv(Number(baseLTV));
    setLiqBps(Number(liq));
    setPrice(formatUnits(price1e18, 18));

    // account-dependent reads
    if (!account) return;

    const [wCol, wDebt, pos, val, maxB, health, buf, sc] = await Promise.all([
      col.balanceOf(account),
      debt.balanceOf(account),
      pool.getUserPositions(account),
      pool.valueOfCollateral(account),
      pool.userMaxBorrowable(account),
      pool.getHealthFactor(account),
      pool.repayBuffer(account),
      occr.scoreMicro(account),
    ]);

    setCollateralWallet(formatUnits(wCol, colDec));
    setDebtWallet(formatUnits(wDebt, debtDec));
    setCollateralOnPool(formatUnits(pos[0], colDec));
    setDebtOnPool(formatUnits(pos[1], debtDec));
    setValueOfColl(formatUnits(val, debtDec)); // value denominated in debt units (since price is debt/col)
    setMaxBorrowable(formatUnits(maxB, debtDec));
    setHf(formatUnits(health, 18)); // 1e18 precision
    setBuffer(formatUnits(buf, debtDec));
    setScore(Number(sc) / 1_000_000); // micro → 0..1
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  // write helpers
  const getSignerContracts = async () => {
    const browser = new BrowserProvider((window as any).ethereum);
    const signer = await browser.getSigner();
    return {
      pool: pool.connect(signer),
      col: col.connect(signer),
      debt: debt.connect(signer),
      signerAddr: await signer.getAddress(),
    };
  };

  // approve + call pattern
  const approveIfNeeded = async (tokenContract: Contract, owner: string, spender: string, amountWei: bigint) => {
    const current = await tokenContract.allowance(owner, spender);
    if (current < amountWei) {
      const tx = await tokenContract.approve(spender, amountWei);
      await tx.wait();
    }
  };

  // actions
  const doDeposit = async () => {
    const { pool, col, signerAddr } = await getSignerContracts();
    const wei = parseUnits(amtDeposit || "0", decimals.col);
    await approveIfNeeded(col, signerAddr, pool.target as string, wei);
    const tx = await pool.deposit(wei);
    await tx.wait();
    setAmtDeposit("");
    refresh();
  };

  const doBorrow = async () => {
    const { pool } = await getSignerContracts();
    const wei = parseUnits(amtBorrow || "0", decimals.debt);
    const tx = await pool.borrow(wei);
    await tx.wait();
    setAmtBorrow("");
    refresh();
  };

  const doRepay = async () => {
    const { pool, debt, signerAddr } = await getSignerContracts();
    const wei = parseUnits(amtRepay || "0", decimals.debt);
    await approveIfNeeded(debt, signerAddr, pool.target as string, wei);
    const tx = await pool.repay(wei);
    await tx.wait();
    setAmtRepay("");
    refresh();
  };

  const doBufDeposit = async () => {
    const { pool, debt, signerAddr } = await getSignerContracts();
    const wei = parseUnits(amtBufDep || "0", decimals.debt);
    await approveIfNeeded(debt, signerAddr, pool.target as string, wei);
    const tx = await pool.depositBuffer(wei);
    await tx.wait();
    setAmtBufDep("");
    refresh();
  };

  const doBufWithdraw = async () => {
    const { pool } = await getSignerContracts();
    const wei = parseUnits(amtBufWdraw || "0", decimals.debt);
    const tx = await pool.withdrawBuffer(wei);
    await tx.wait();
    setAmtBufWdraw("");
    refresh();
  };

  const doBufRepay = async () => {
    const { pool } = await getSignerContracts();
    const wei = parseUnits(amtBufRepay || "0", decimals.debt);
    const tx = await pool.repayFromBuffer(wei);
    await tx.wait();
    setAmtBufRepay("");
    refresh();
  };

  const doAdminSetPrice = async () => {
    const { pool } = await getSignerContracts();
    const wei = parseUnits(adminPrice || "0", 18); // price1e18
    const tx = await pool.setPrice(wei);
    await tx.wait();
    setAdminPrice("");
    refresh();
  };

  const isOwner = account && owner && account.toLowerCase() === owner.toLowerCase();

  return (
    <div style={{ maxWidth: 1080, margin: "2rem auto", padding: "0 1rem", fontFamily: "ui-sans-serif, system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>OCCR Lending — Sepolia</h1>
        <div>
          <button
            onClick={connect}
            style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #ccc", background: "#111", color: "#fff" }}
          >
            {account ? `${account.slice(0,6)}…${account.slice(-4)}` : "Connect Wallet"}
          </button>
        </div>
      </header>

      {!rpcOk && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffecb5", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          RPC not reachable. Check <code>NEXT_PUBLIC_SEPOLIA_RPC</code>.
        </div>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card title="Your Wallet">
          <Row label={`${symbols.col} Wallet`} value={collateralWallet} />
          <Row label={`${symbols.debt} Wallet`} value={debtWallet} />
        </Card>

        <Card title="Your Position (on Pool)">
          <Row label={`Collateral (${symbols.col})`} value={collateralOnPool} />
          <Row label={`Debt (${symbols.debt})`} value={debtOnPool} />
          <Row label={`Repay Buffer (${symbols.debt})`} value={buffer} />
        </Card>

        <Card title="Risk / Limits">
          <Row label={`OCCR Score (0 best)`} value={score.toFixed(3)} />
          <Row label="Value of Collateral (in debt units)" value={valueOfColl} />
          <Row label="Max Borrowable" value={maxBorrowable} />
          <Row label="Health Factor (1.0=threshold)" value={hf} />
        </Card>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <Card title={`Deposit ${symbols.col} (Collateral)`}>
          <Field value={amtDeposit} onChange={setAmtDeposit} placeholder={`Amount ${symbols.col}`} />
          <button className="btn" onClick={doDeposit}>Deposit</button>
        </Card>

        <Card title={`Borrow ${symbols.debt}`}>
          <Field value={amtBorrow} onChange={setAmtBorrow} placeholder={`Amount ${symbols.debt}`} />
          <button className="btn" onClick={doBorrow}>Borrow</button>
          <Info small>Borrow requires identity verification (Self → Day 5). If not verified, this will revert.</Info>
        </Card>

        <Card title={`Repay ${symbols.debt}`}>
          <Field value={amtRepay} onChange={setAmtRepay} placeholder={`Amount ${symbols.debt}`} />
          <button className="btn" onClick={doRepay}>Repay</button>
        </Card>

        <Card title={`Deposit Buffer (${symbols.debt})`}>
          <Field value={amtBufDep} onChange={setAmtBufDep} placeholder={`Amount ${symbols.debt}`} />
          <button className="btn" onClick={doBufDeposit}>Deposit Buffer</button>
          <Info small>Pre-fund for automated repayments (x402 agent can trigger later).</Info>
        </Card>

        <Card title={`Withdraw Buffer (${symbols.debt})`}>
          <Field value={amtBufWdraw} onChange={setAmtBufWdraw} placeholder={`Amount ${symbols.debt}`} />
          <button className="btn" onClick={doBufWithdraw}>Withdraw Buffer</button>
        </Card>

        <Card title={`Repay From Buffer (${symbols.debt})`}>
          <Field value={amtBufRepay} onChange={setAmtBufRepay} placeholder={`Amount ${symbols.debt}`} />
          <button className="btn" onClick={doBufRepay}>Repay From Buffer</button>
        </Card>
      </section>

      <section style={{ marginTop: 28 }}>
        <Card title="Admin (Owner Only)">
          <Row label="Current Price (debt per 1 collateral)" value={price} />
          <Row label="Base LTV (bps)" value={String(ltv)} />
          <Row label="Liquidation Threshold (bps)" value={String(liqBps)} />
          {isOwner ? (
            <>
              <Field value={adminPrice} onChange={setAdminPrice} placeholder="New price (e.g., 2000)" />
              <button className="btn" onClick={doAdminSetPrice}>Set Price</button>
            </>
          ) : (
            <Info>Connect as owner ({owner}) to change price.</Info>
          )}
        </Card>
      </section>

      <style jsx global>{`
        .btn {
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid #222;
          background: #111;
          color: #fff;
          margin-top: 8px;
        }
        input {
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #ccc;
          width: 100%;
        }
      `}</style>
    </div>
  );
}

function Card(props: { title: string; children: any }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "#fff" }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{props.title}</div>
      {props.children}
    </div>
  );
}

function Row(props: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
      <span style={{ color: "#374151" }}>{props.label}</span>
      <span style={{ fontFamily: "monospace" }}>{props.value}</span>
    </div>
  );
}

function Field(props: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
    />
  );
}

function Info(props: { children: any; small?: boolean }) {
  return (
    <div style={{
      marginTop: 8,
      fontSize: props.small ? 12 : 14,
      color: "#6b7280"
    }}>
      {props.children}
    </div>
  );
}
