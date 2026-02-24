import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';

const DATA_DIR = path.join(process.cwd(), 'data');
const VISITORS_FILE = path.join(DATA_DIR, 'visitors.json');

// Securely derive the public wallet address from the private key on the server
let serverAdminAddress = "";
try {
    const pk = process.env.RELAYER_PRIVATE_KEY || "";
    if (pk) {
        // Ensure private key has 0x prefix for ethers
        const formattedPk = pk.startsWith('0x') ? pk : `0x${pk}`;
        const wallet = new ethers.Wallet(formattedPk);
        serverAdminAddress = wallet.address.toLowerCase();
    }
} catch (e) {
    console.error("Failed to parse RELAYER_PRIVATE_KEY", e);
}

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function readCount(): number {
    ensureDataDir();
    if (!fs.existsSync(VISITORS_FILE)) {
        fs.writeFileSync(VISITORS_FILE, JSON.stringify({ count: 0 }), 'utf-8');
        return 0;
    }
    try {
        const data = JSON.parse(fs.readFileSync(VISITORS_FILE, 'utf-8'));
        return data.count || 0;
    } catch {
        return 0;
    }
}

function writeCount(count: number) {
    ensureDataDir();
    fs.writeFileSync(VISITORS_FILE, JSON.stringify({ count }), 'utf-8');
}

// GET: return current count (admin only calls this)
export async function GET() {
    const count = readCount();
    return NextResponse.json({ count, adminAddress: serverAdminAddress });
}

// POST: increment count (called on every page visit)
export async function POST() {
    const current = readCount();
    const newCount = current + 1;
    writeCount(newCount);
    return NextResponse.json({ count: newCount, adminAddress: serverAdminAddress });
}
