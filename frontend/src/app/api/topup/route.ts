// frontend/src/app/api/topup/route.ts
import { NextRequest, NextResponse } from "next/server";

// simple env guard (Next.js reads .env.local automatically in dev)
const must = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};
const FEE_TOKEN   = () => must("X402_FEE_TOKEN");
const FEE_AMOUNT  = () => must("X402_FEE_AMOUNT");
const FEE_PAYTO   = () => must("X402_PAYTO");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { user, minHealthFactor, proof, sessionId } = body || {};

    // 1) No proof → send 402 challenge
    if (!proof) {
      return NextResponse.json({
        status: "PAYMENT_REQUIRED",
        code: 402,
        challenge: {
          sessionId: crypto.randomUUID(),
          requiredPayment: {
            token: FEE_TOKEN(),
            amount: FEE_AMOUNT(),
            payTo: FEE_PAYTO(),
            network: "Polygon Amoy",
          },
        },
      }, { status: 402 });
    }

    // 2) For prep: accept only the sentinel string "DEMO_PAID"
    if (proof !== "DEMO_PAID") {
      return NextResponse.json({ status: "INVALID_PROOF" }, { status: 400 });
    }

    // Here we would enqueue the top-up job; for now just ack
    return NextResponse.json({
      status: "ACCEPTED",
      sessionId: sessionId || null,
      message: "Payment verified (demo). Top-up job enqueued."
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
