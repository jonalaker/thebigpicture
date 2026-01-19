// Claims tracking for double-claim prevention
// Uses file-based storage for persistence across server restarts

import { promises as fs } from 'fs';
import path from 'path';

const CLAIMS_FILE = path.join(process.cwd(), 'data', 'airdrop-claims.json');

interface ClaimRecord {
    address: string;
    txHash: string;
    timestamp: number;
    ip: string;
}

interface ClaimsData {
    claims: Record<string, ClaimRecord>;
    nonces: Record<string, number>;
}

// In-memory cache for faster lookups
let claimsCache: ClaimsData | null = null;

async function ensureDataDir(): Promise<void> {
    const dataDir = path.dirname(CLAIMS_FILE);
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

async function loadClaims(): Promise<ClaimsData> {
    if (claimsCache) {
        return claimsCache;
    }

    try {
        await ensureDataDir();
        const data = await fs.readFile(CLAIMS_FILE, 'utf-8');
        claimsCache = JSON.parse(data);
        return claimsCache!;
    } catch {
        // File doesn't exist yet, return empty state
        claimsCache = { claims: {}, nonces: {} };
        return claimsCache;
    }
}

async function saveClaims(data: ClaimsData): Promise<void> {
    await ensureDataDir();
    await fs.writeFile(CLAIMS_FILE, JSON.stringify(data, null, 2));
    claimsCache = data;
}

/**
 * Check if an address has already claimed
 */
export async function hasClaimed(address: string): Promise<boolean> {
    const data = await loadClaims();
    return address.toLowerCase() in data.claims;
}

/**
 * Get the claim record for an address
 */
export async function getClaimRecord(address: string): Promise<ClaimRecord | null> {
    const data = await loadClaims();
    return data.claims[address.toLowerCase()] || null;
}

/**
 * Record a successful claim
 */
export async function recordClaim(
    address: string,
    txHash: string,
    ip: string
): Promise<void> {
    const data = await loadClaims();

    data.claims[address.toLowerCase()] = {
        address: address.toLowerCase(),
        txHash,
        timestamp: Date.now(),
        ip,
    };

    await saveClaims(data);
}

/**
 * Get the current nonce for an address (for replay attack prevention)
 */
export async function getNonce(address: string): Promise<number> {
    const data = await loadClaims();
    return data.nonces[address.toLowerCase()] || 0;
}

/**
 * Increment the nonce for an address after a claim
 */
export async function incrementNonce(address: string): Promise<number> {
    const data = await loadClaims();
    const currentNonce = data.nonces[address.toLowerCase()] || 0;
    data.nonces[address.toLowerCase()] = currentNonce + 1;
    await saveClaims(data);
    return currentNonce + 1;
}

/**
 * Get total claims count
 */
export async function getTotalClaims(): Promise<number> {
    const data = await loadClaims();
    return Object.keys(data.claims).length;
}

/**
 * Get all claim records (for admin purposes)
 */
export async function getAllClaims(): Promise<ClaimRecord[]> {
    const data = await loadClaims();
    return Object.values(data.claims);
}

// Rate limiting storage (in-memory only)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Check and update rate limit for an IP
 * Returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(ip: string, windowMs: number, maxRequests: number): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
        // New window
        rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
    }

    if (record.count >= maxRequests) {
        return false;
    }

    record.count++;
    return true;
}
