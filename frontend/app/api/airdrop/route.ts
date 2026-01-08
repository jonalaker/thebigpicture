import { NextResponse } from "next/server";
import { ethers } from "ethers";

const PINN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PINN_CONTRACT_ADDRESS!;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY!;

const PINN_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)"
];

export async function POST(req: Request) {
  try {
    const { wallet } = await req.json();

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet address missing" },
        { status: 400 }
      );
    }

    const provider = new ethers.JsonRpcProvider(
      "https://polygon-rpc.com"
    );

    const adminWallet = new ethers.Wallet(
      ADMIN_PRIVATE_KEY,
      provider
    );

    const contract = new ethers.Contract(
      PINN_CONTRACT_ADDRESS,
      PINN_ABI,
      adminWallet
    );

    const amount = ethers.parseUnits("100", 18);
    const tx = await contract.transfer(wallet, amount);
    await tx.wait();

    return NextResponse.json({
      success: true,
      txHash: tx.hash
    });
  } catch (err: any) {
    console.error("Airdrop error:", err);

    return NextResponse.json(
      { error: err.message || "Airdrop failed" },
      { status: 500 }
    );
  }
}
