/**
 * x402 v1 Payment Middleware for Next.js API Routes
 *
 * Custom implementation because the Polygon Amoy facilitator runs x402 v1 protocol
 * (network: "polygon-amoy", x402Version: 1) while @x402/core v2.5.0 only validates
 * against v2 protocol, causing RouteConfigurationError at startup.
 *
 * Testnet facilitator: https://x402-amoy.polygon.technology
 * Mainnet facilitator: https://x402.polygon.technology  (switch when ready)
 */
import { type NextRequest, NextResponse } from "next/server";

// ─── Network Configuration ──────────────────────────────────────────────────
// v1 uses simple network names (not CAIP-2 format)
// Testnet: "polygon-amoy"   → Polygon Amoy (chainId 80002)
// Mainnet: "polygon"         → Polygon Mainnet (chainId 137)
const NETWORK = process.env.NEXT_PUBLIC_X402_NETWORK === "eip155:137"
    ? "polygon"
    : "polygon-amoy";

// Facilitator URL — handles payment verification & settlement
// Testnet:  https://x402-amoy.polygon.technology
// Mainnet:  https://x402.polygon.technology
const FACILITATOR_URL =
    process.env.X402_FACILITATOR_URL || "https://x402-amoy.polygon.technology";

// ─── Payment Configuration ──────────────────────────────────────────────────
// Address that receives the USDC payments
// ⚠️ Replace with your own Polygon wallet address!
export const PAY_TO_ADDRESS =
    process.env.X402_PAY_TO_ADDRESS || "0xYourPolygonAddressHere";

// Price per chat message in USD (paid in USDC)
const CHAT_PRICE_USD = 0.02;

// USDC has 6 decimals: $0.02 = 20000 units
const CHAT_PRICE_UNITS = String(Math.round(CHAT_PRICE_USD * 1_000_000));

// ─── USDC Asset Details ─────────────────────────────────────────────────────
// Polygon Amoy testnet USDC
// Mainnet: change to 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
const USDC_ADDRESS = process.env.NEXT_PUBLIC_X402_NETWORK === "eip155:137"
    ? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"
    : "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";

// EIP-712 domain parameters (read from the contract's name() and version())
const USDC_EIP712_NAME = "USDC";
const USDC_EIP712_VERSION = "2";

// ─── v1 Payment Required Response ───────────────────────────────────────────
function buildPaymentRequired(resourceUrl: string): object {
    return {
        x402Version: 1,
        error: null,
        accepts: [
            {
                scheme: "exact",
                network: NETWORK,
                maxAmountRequired: CHAT_PRICE_UNITS,
                resource: resourceUrl,
                description: "Send a message to PINN44 AI chatbot",
                mimeType: "application/json",
                outputSchema: {},
                payTo: PAY_TO_ADDRESS,
                maxTimeoutSeconds: 300,
                asset: USDC_ADDRESS,
                extra: {
                    name: USDC_EIP712_NAME,
                    version: USDC_EIP712_VERSION,
                },
            },
        ],
    };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
// Convert BigInt values to strings for JSON serialization (matches x402 library)
function toJsonSafe(obj: unknown): unknown {
    return JSON.parse(
        JSON.stringify(obj, (_, value) =>
            typeof value === "bigint" ? value.toString() : value,
        ),
    );
}

// ─── Facilitator API Calls ──────────────────────────────────────────────────
async function verifyPayment(paymentPayload: any, paymentRequirements: unknown) {
    const res = await fetch(`${FACILITATOR_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            x402Version: paymentPayload.x402Version ?? 1,
            paymentPayload: toJsonSafe(paymentPayload),
            paymentRequirements: toJsonSafe(paymentRequirements),
        }),
    });
    const data = await res.json();
    if (typeof data === "object" && data !== null && "isValid" in data) {
        if (!res.ok) {
            throw new Error(data.invalidReason || `Verify failed (${res.status})`);
        }
        return data as { isValid: boolean; invalidReason?: string; payer?: string };
    }
    throw new Error(`Facilitator verify failed (${res.status}): ${JSON.stringify(data)}`);
}

async function settlePayment(paymentPayload: any, paymentRequirements: unknown) {
    const res = await fetch(`${FACILITATOR_URL}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            x402Version: paymentPayload.x402Version ?? 1,
            paymentPayload: toJsonSafe(paymentPayload),
            paymentRequirements: toJsonSafe(paymentRequirements),
        }),
    });
    const data = await res.json();
    if (typeof data === "object" && data !== null && "success" in data) {
        if (!res.ok) {
            throw new Error(data.errorReason || `Settle failed (${res.status})`);
        }
        return data as { success: boolean; transaction?: string; errorReason?: string };
    }
    throw new Error(`Facilitator settle failed (${res.status}): ${JSON.stringify(data)}`);
}

// ─── Middleware Wrapper ─────────────────────────────────────────────────────
/**
 * Wraps a Next.js route handler with x402 v1 payment protection.
 *
 * Flow:
 * 1. No X-PAYMENT header → return 402 with payment requirements body
 * 2. X-PAYMENT header present → decode, verify, run handler, settle
 */
export function withX402V1(
    handler: (request: NextRequest) => Promise<NextResponse>,
) {
    return async (request: NextRequest): Promise<NextResponse> => {
        const resourceUrl = request.url;

        // Check for v1 payment header (X-PAYMENT) or v2 header (PAYMENT-SIGNATURE)
        const paymentHeader =
            request.headers.get("x-payment") ||
            request.headers.get("payment-signature");

        if (!paymentHeader) {
            // No payment — return 402 with v1 payment requirements in body
            const paymentRequired = buildPaymentRequired(resourceUrl);
            return NextResponse.json(paymentRequired, { status: 402 });
        }

        // Decode the payment payload from base64
        let paymentPayload: any;
        try {
            const decoded = Buffer.from(paymentHeader, "base64").toString("utf-8");
            paymentPayload = JSON.parse(decoded);
        } catch {
            return NextResponse.json(
                { error: "Invalid payment header encoding" },
                { status: 400 },
            );
        }

        // Build the payment requirements that match what we sent in the 402
        const paymentRequired = buildPaymentRequired(resourceUrl);
        const paymentRequirements = (paymentRequired as any).accepts[0];

        // Verify the payment with the facilitator
        let verifyResult;
        try {
            console.log("💳 Verifying payment with facilitator...");
            verifyResult = await verifyPayment(paymentPayload, paymentRequirements);
            console.log("💳 Verify result:", JSON.stringify(verifyResult));
        } catch (err: any) {
            console.error("❌ Payment verification error:", err.message);
            return NextResponse.json(
                { error: "Payment verification failed", details: err.message },
                { status: 402 },
            );
        }

        if (!verifyResult.isValid) {
            console.warn("❌ Payment invalid:", verifyResult.invalidReason);
            return NextResponse.json(
                {
                    error: "Payment invalid",
                    reason: verifyResult.invalidReason,
                },
                { status: 402 },
            );
        }

        console.log("✅ Payment verified! Payer:", verifyResult.payer);

        // Payment verified — run the actual handler
        const response = await handler(request);

        // Only settle if the handler succeeded
        if (response.status < 400) {
            try {
                console.log("💰 Settling payment with facilitator...");
                const settleResult = await settlePayment(paymentPayload, paymentRequirements);
                if (settleResult.success) {
                    console.log("✅ Settlement successful! TX:", settleResult.transaction);
                } else {
                    console.error("❌ Settlement failed:", settleResult.errorReason);
                }
            } catch (err: any) {
                console.error("❌ Settlement error:", err.message);
                // Don't fail the response — the user already got their content
            }
        }

        return response;
    };
}
