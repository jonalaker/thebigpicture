import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Merkle tree structure (generated off-chain)
interface MerkleTreeData {
    root: string;
    totalAmount: string;
    claims: {
        [address: string]: {
            index: number;
            amount: string;
            proof: string[];
        };
    };
}

// Cache the merkle tree in memory
let merkleTreeCache: MerkleTreeData | null = null;

async function loadMerkleTree(): Promise<MerkleTreeData | null> {
    if (merkleTreeCache) return merkleTreeCache;

    try {
        const treePath = process.env.MERKLE_TREE_PATH || 'data/merkle-tree.json';
        const fullPath = path.join(process.cwd(), treePath);
        const data = await fs.readFile(fullPath, 'utf-8');
        merkleTreeCache = JSON.parse(data);
        return merkleTreeCache;
    } catch (error) {
        console.error('Failed to load merkle tree:', error);
        return null;
    }
}

// GET - Fetch merkle proof for an address
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
        return NextResponse.json(
            { error: 'Address parameter required' },
            { status: 400 }
        );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return NextResponse.json(
            { error: 'Invalid address format' },
            { status: 400 }
        );
    }

    const merkleTree = await loadMerkleTree();

    if (!merkleTree) {
        return NextResponse.json(
            { error: 'Merkle tree not configured' },
            { status: 503 }
        );
    }

    // Look up claim data (case-insensitive)
    const normalizedAddress = address.toLowerCase();
    const claimData = Object.entries(merkleTree.claims).find(
        ([addr]) => addr.toLowerCase() === normalizedAddress
    );

    if (!claimData) {
        return NextResponse.json(
            { error: 'Address not found in merkle tree' },
            { status: 404 }
        );
    }

    const [, claim] = claimData;

    return NextResponse.json({
        index: claim.index,
        amount: claim.amount,
        proof: claim.proof,
    });
}
