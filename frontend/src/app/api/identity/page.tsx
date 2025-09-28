"use client";
import { useEffect, useMemo, useState } from "react";
import { ethers, Contract, JsonRpcProvider } from "ethers";

const RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC!;
const IDENTITY_ADDR = process.env.NEXT_PUBLIC_IDENTITY_ADDRESS!;
const IDENTITY_ABI = [
  "function isVerified(address) view returns (bool)",
  "function merkleRoot() view returns (bytes32)"
];

export default function IdentityPage() {
  const [account, setAccount] = useState<string>("");
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const provider = useMemo(() => new JsonRpcProvider(RPC), []);
  const identity = useMemo(
    () => (IDENTITY_ADDR ? new Contract(IDENTITY_ADDR, IDENTITY_ABI, provider) : null),
    [provider]
  );

  // load connected wallet (browser/metamask)
  useEffect(() => {
    if (!window?.ethereum) return;
    (async () => {
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accs[0]);
    })();
  }, []);

  // read verification state
  useEffect(() => {
    if (!identity || !account) return;
    (async () => {
      const v = await identity.isVerified(account);
      setIsVerified(v);
    })();
  }, [identity, account]);

  async function verifyWithSelf() {
    if (!account) return;
    try {
      setLoading(true);
      // Normally you'd open the Self flow (QR / SDK) to get a proof,
      // then POST { user, proof } to the API.
      const res = await fetch("/api/identity/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user: account })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "verify failed");
      setLastTx(json.txHash || null);
      // re-read
      const v = await identity!.isVerified(account);
      setIsVerified(v);
      alert("Verified!");
    } catch (e: any) {
      alert(e.message || "failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Identity (Self Protocol)</h1>

      <div className="rounded-xl border p-4">
        <div className="text-sm opacity-70">Connected</div>
        <div className="font-mono">{account || "—"}</div>
      </div>

      <div className="rounded-xl border p-4 flex items-center justify-between">
        <div>
          <div className="text-sm opacity-70">Status</div>
          <div className={`font-semibold ${isVerified ? "text-green-600" : "text-red-600"}`}>
            {isVerified ? "✅ Verified" : "❌ Not Verified"}
          </div>
        </div>
        <button
          onClick={verifyWithSelf}
          disabled={loading || !account || isVerified}
          className="px-4 py-2 rounded-xl border hover:bg-black hover:text-white disabled:opacity-50"
        >
          {loading ? "Verifying…" : isVerified ? "Verified" : "Verify with Self"}
        </button>
      </div>

      {lastTx && (
        <div className="text-sm">
          Attestation tx:{" "}
          <a
            className="underline"
            href={`https://sepolia.etherscan.io/tx/${lastTx}`}
            target="_blank"
          >
            {lastTx}
          </a>
        </div>
      )}

      <div className="rounded-xl border p-4 space-y-2">
        <div className="text-sm font-semibold">What happens here?</div>
        <ul className="list-disc pl-5 text-sm opacity-80 space-y-1">
          <li>You complete Self verification off-chain (simulated here).</li>
          <li>Our server (temporary trust layer) attests your wallet via <code>setVerified</code>.</li>
          <li>Lending is **unlocked** only for verified addresses.</li>
        </ul>
      </div>
    </div>
  );
}
