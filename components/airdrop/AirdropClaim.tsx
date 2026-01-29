'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Wallet, ExternalLink, Gift, Shield, Zap, TreePine, Lock, Info, AlertTriangle } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useMerkleDistributor, usePINN44Token } from '@/hooks/useContracts';
import { getExplorerTxUrl, CONTRACTS_CONFIG } from '@/lib/contracts';

interface MerkleProof {
    index: number;
    amount: string;
    proof: string[];
}

interface ClaimStatus {
    eligible: boolean;
    claimed: boolean;
    amount: string;
    index: number;
    proof: string[];
}

// Constants matching the MerkleDistributor contract
const IMMEDIATE_PERCENTAGE = 10;
const LOCKED_PERCENTAGE = 90;
const LOCK_DURATION_MONTHS = 6;

export function AirdropClaim() {
    const {
        address,
        isConnected,
        isConnecting,
        isCorrectNetwork,
        isMetaMaskAvailable,
        connect,
        switchToPolygon,
        formatAddress,
        error: walletError,
    } = useWallet();

    const merkleDistributor = useMerkleDistributor();
    const token = usePINN44Token();

    const [claimStatus, setClaimStatus] = useState<ClaimStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tokenBalance, setTokenBalance] = useState<string>('0');
    const [currentEpoch, setCurrentEpoch] = useState<number>(0);

    // Calculate immediate and locked amounts
    const calculateAmounts = (totalAmount: string) => {
        const total = parseFloat(totalAmount);
        const immediate = (total * IMMEDIATE_PERCENTAGE) / 100;
        const locked = (total * LOCKED_PERCENTAGE) / 100;
        return { immediate, locked, total };
    };

    // Fetch user's merkle proof from API
    const fetchMerkleProof = useCallback(async (userAddress: string): Promise<MerkleProof | null> => {
        try {
            const response = await fetch(`/api/airdrop/merkle-proofs?address=${userAddress}`);
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error('Failed to fetch merkle proof');
            }
            return await response.json();
        } catch (err) {
            console.error('Error fetching merkle proof:', err);
            return null;
        }
    }, []);

    // Check claim status
    const checkClaimStatus = useCallback(async () => {
        if (!address || !isCorrectNetwork) return;

        setIsLoading(true);
        setError(null);

        try {
            // Get current epoch
            const epoch = await merkleDistributor.getCurrentEpoch();
            setCurrentEpoch(Number(epoch));

            // Fetch merkle proof for user
            const proofData = await fetchMerkleProof(address);

            if (!proofData) {
                setClaimStatus({
                    eligible: false,
                    claimed: false,
                    amount: '0',
                    index: 0,
                    proof: [],
                });
                return;
            }

            // Check if already claimed
            const claimed = await merkleDistributor.isClaimed(Number(epoch), proofData.index);

            setClaimStatus({
                eligible: true,
                claimed,
                amount: proofData.amount,
                index: proofData.index,
                proof: proofData.proof,
            });

            // Also fetch token balance
            const balance = await token.getBalance();
            setTokenBalance(ethers.formatEther(balance));
        } catch (err) {
            console.error('Error checking claim status:', err);
            setError('Failed to check eligibility. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [address, isCorrectNetwork, merkleDistributor, token, fetchMerkleProof]);

    // Claim airdrop
    const claimAirdrop = async () => {
        if (!address || !claimStatus?.eligible || claimStatus.claimed || !merkleDistributor.contract) {
            return;
        }

        setIsClaiming(true);
        setError(null);

        try {
            const amount = ethers.parseEther(claimStatus.amount);

            // Claim tokens via MerkleDistributor
            const receipt = await merkleDistributor.claim(
                currentEpoch,
                claimStatus.index,
                address,
                amount,
                claimStatus.proof
            );

            setTxHash(receipt.hash);

            // Update status
            setClaimStatus(prev => prev ? { ...prev, claimed: true } : null);

            // Refresh balance
            const newBalance = await token.getBalance();
            setTokenBalance(ethers.formatEther(newBalance));
        } catch (err: unknown) {
            console.error('Claim error:', err);
            const message = err instanceof Error ? err.message : 'Failed to claim tokens';
            if (message.includes('user rejected')) {
                setError('Transaction rejected by user');
            } else if (message.includes('Already claimed')) {
                setError('You have already claimed this airdrop');
                setClaimStatus(prev => prev ? { ...prev, claimed: true } : null);
            } else {
                setError(message);
            }
        } finally {
            setIsClaiming(false);
        }
    };

    // Check status when wallet connects or network changes
    useEffect(() => {
        if (isConnected && isCorrectNetwork && address) {
            checkClaimStatus();
        }
    }, [isConnected, isCorrectNetwork, address, checkClaimStatus]);

    // Contract not configured
    if (!CONTRACTS_CONFIG.MERKLE_DISTRIBUTOR) {
        return (
            <section className="py-20 px-4 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20 min-h-[80vh] flex items-center">
                <div className="max-w-2xl mx-auto w-full">
                    <Card className="border-yellow-500/50 bg-black/60 backdrop-blur-lg">
                        <CardHeader className="text-center">
                            <Gift className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
                            <CardTitle className="text-3xl font-bold text-white">PINN44 Airdrop</CardTitle>
                            <CardDescription className="text-yellow-200">
                                Airdrop contract not yet deployed. Please check back later.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </div>
            </section>
        );
    }

    const amounts = claimStatus ? calculateAmounts(claimStatus.amount) : null;

    return (
        <section className="py-20 px-4 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20 min-h-[80vh] flex items-center">
            <div className="max-w-2xl mx-auto w-full">
                <Card className="border-purple-500/50 bg-black/60 backdrop-blur-lg">
                    <CardHeader className="text-center">
                        <div className="relative">
                            <Gift className="w-16 h-16 mx-auto mb-4 text-purple-400 animate-pulse" />
                            <TreePine className="w-6 h-6 absolute top-0 right-1/3 text-green-400" />
                        </div>
                        <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            PINN44 Merkle Airdrop
                        </CardTitle>
                        <CardDescription className="text-gray-300">
                            Claim your PINN44 tokens with locked distribution
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Lock Mechanism Info Banner */}
                        <Alert className="bg-blue-900/20 border-blue-500/50">
                            <Info className="h-4 w-4 text-blue-400" />
                            <AlertTitle className="text-blue-400">Locked Token Distribution</AlertTitle>
                            <AlertDescription className="text-gray-300 space-y-2">
                                <p>Airdrop tokens are distributed with anti-dump protection:</p>
                                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                                    <li><strong className="text-green-400">10% Immediate</strong> — Available instantly</li>
                                    <li><strong className="text-purple-400">90% Locked</strong> — Unlocks after 6 months OR first contribution</li>
                                </ul>
                            </AlertDescription>
                        </Alert>

                        {/* Features */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="text-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                <TreePine className="w-6 h-6 mx-auto mb-2 text-green-400" />
                                <p className="text-xs text-gray-400">Merkle Verified</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <Lock className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                                <p className="text-xs text-gray-400">Anti-Dump Lock</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                                <Zap className="w-6 h-6 mx-auto mb-2 text-pink-400" />
                                <p className="text-xs text-gray-400">Gas Efficient</p>
                            </div>
                        </div>

                        {/* Error Display */}
                        {(error || walletError) && (
                            <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                                <XCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{error || walletError}</AlertDescription>
                            </Alert>
                        )}

                        {/* Success - Just Claimed */}
                        {txHash && amounts && (
                            <Alert className="bg-green-900/20 border-green-500/50">
                                <CheckCircle2 className="h-4 w-4 text-green-400" />
                                <AlertTitle className="text-green-400">Tokens Claimed!</AlertTitle>
                                <AlertDescription className="text-green-200 space-y-2">
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div className="p-2 rounded bg-green-900/30">
                                            <p className="text-xs text-gray-400">Received Now</p>
                                            <p className="text-lg font-bold text-green-400">{amounts.immediate.toLocaleString()} PINN44</p>
                                        </div>
                                        <div className="p-2 rounded bg-purple-900/30">
                                            <p className="text-xs text-gray-400">Locked (6 months)</p>
                                            <p className="text-lg font-bold text-purple-400">{amounts.locked.toLocaleString()} PINN44</p>
                                        </div>
                                    </div>
                                    <a
                                        href={getExplorerTxUrl(txHash)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-green-400 hover:underline mt-2"
                                    >
                                        View transaction <ExternalLink className="w-3 h-3" />
                                    </a>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Wallet Not Connected */}
                        {!isConnected && (
                            <div className="text-center space-y-4">
                                <p className="text-gray-400">Connect your wallet to check eligibility</p>
                                <Button
                                    onClick={connect}
                                    disabled={isConnecting || !isMetaMaskAvailable}
                                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                                >
                                    {isConnecting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Connecting...
                                        </>
                                    ) : (
                                        <>
                                            <Wallet className="mr-2 h-4 w-4" />
                                            {isMetaMaskAvailable ? 'Connect MetaMask' : 'Install MetaMask'}
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Wrong Network */}
                        {isConnected && !isCorrectNetwork && (
                            <div className="text-center space-y-4">
                                <Alert className="bg-yellow-900/20 border-yellow-500/50">
                                    <AlertTitle className="text-yellow-400">Wrong Network</AlertTitle>
                                    <AlertDescription className="text-yellow-200">
                                        Please switch to the correct network to claim your tokens.
                                    </AlertDescription>
                                </Alert>
                                <Button
                                    onClick={switchToPolygon}
                                    className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700"
                                >
                                    Switch Network
                                </Button>
                            </div>
                        )}

                        {/* Connected & Correct Network */}
                        {isConnected && isCorrectNetwork && (
                            <div className="space-y-4">
                                {/* Wallet Info */}
                                <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Connected Wallet</span>
                                        <span className="text-white font-mono">{formatAddress(address!)}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-gray-400">PINN44 Balance</span>
                                        <span className="text-purple-400 font-semibold">{parseFloat(tokenBalance).toLocaleString()} PINN44</span>
                                    </div>
                                </div>

                                {/* Loading State */}
                                {isLoading && (
                                    <div className="text-center py-8">
                                        <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-400" />
                                        <p className="text-gray-400 mt-2">Checking eligibility...</p>
                                    </div>
                                )}

                                {/* Not Eligible */}
                                {!isLoading && claimStatus && !claimStatus.eligible && (
                                    <Alert className="bg-gray-800/50 border-gray-600">
                                        <AlertTitle className="text-gray-300">Not Eligible</AlertTitle>
                                        <AlertDescription className="text-gray-400">
                                            This wallet address is not included in the current airdrop. Check back for future distributions.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {/* Eligible but Already Claimed */}
                                {!isLoading && claimStatus?.eligible && claimStatus.claimed && !txHash && amounts && (
                                    <div className="space-y-4">
                                        <Alert className="bg-blue-900/20 border-blue-500/50">
                                            <CheckCircle2 className="h-4 w-4 text-blue-400" />
                                            <AlertTitle className="text-blue-400">Already Claimed</AlertTitle>
                                            <AlertDescription className="text-blue-200">
                                                You have already claimed your airdrop tokens for this epoch.
                                            </AlertDescription>
                                        </Alert>

                                        {/* Locked Token Status */}
                                        <div className="p-4 rounded-lg bg-purple-900/20 border border-purple-500/30">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Lock className="w-5 h-5 text-purple-400" />
                                                <span className="font-semibold text-purple-400">Your Locked Tokens</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-400">Received</p>
                                                    <p className="text-lg font-bold text-green-400">{amounts.immediate.toLocaleString()} PINN44</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-400">Locked</p>
                                                    <p className="text-lg font-bold text-purple-400">{amounts.locked.toLocaleString()} PINN44</p>
                                                </div>
                                            </div>
                                            <div className="mt-4 p-3 rounded bg-gray-800/50 border border-gray-700">
                                                <p className="text-sm text-gray-300">
                                                    <strong>Unlock Conditions:</strong>
                                                </p>
                                                <ul className="text-xs text-gray-400 mt-1 space-y-1">
                                                    <li>✓ Complete your first contribution, OR</li>
                                                    <li>✓ Wait 6 months from claim date</li>
                                                </ul>
                                            </div>
                                        </div>

                                        {/* Early Unlock Warning */}
                                        <Alert className="bg-yellow-900/20 border-yellow-500/50">
                                            <AlertTriangle className="h-4 w-4 text-yellow-400" />
                                            <AlertTitle className="text-yellow-400">Early Unlock Penalty</AlertTitle>
                                            <AlertDescription className="text-yellow-200 text-sm">
                                                Unlocking before conditions are met incurs a <strong>20% penalty</strong>.
                                                Visit the <strong>Contributor Vault</strong> to manage your locked tokens.
                                            </AlertDescription>
                                        </Alert>
                                    </div>
                                )}

                                {/* Eligible and Can Claim */}
                                {!isLoading && claimStatus?.eligible && !claimStatus.claimed && amounts && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30">
                                            <div className="text-center mb-4">
                                                <p className="text-gray-400 text-sm">Total Airdrop Allocation</p>
                                                <p className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                                    {amounts.total.toLocaleString()} PINN44
                                                </p>
                                            </div>

                                            {/* Breakdown */}
                                            <div className="grid grid-cols-2 gap-4 mt-4">
                                                <div className="p-3 rounded-lg bg-green-900/30 border border-green-500/30 text-center">
                                                    <p className="text-xs text-gray-400">Immediate (10%)</p>
                                                    <p className="text-xl font-bold text-green-400">{amounts.immediate.toLocaleString()}</p>
                                                    <p className="text-xs text-green-300">Available now</p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-purple-900/30 border border-purple-500/30 text-center">
                                                    <p className="text-xs text-gray-400">Locked (90%)</p>
                                                    <p className="text-xl font-bold text-purple-400">{amounts.locked.toLocaleString()}</p>
                                                    <p className="text-xs text-purple-300">6 months lock</p>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            onClick={claimAirdrop}
                                            disabled={isClaiming}
                                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-6 text-lg"
                                        >
                                            {isClaiming ? (
                                                <>
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                    Claiming...
                                                </>
                                            ) : (
                                                <>
                                                    <Gift className="mr-2 h-5 w-5" />
                                                    Claim Tokens
                                                </>
                                            )}
                                        </Button>

                                        <p className="text-xs text-center text-gray-500">
                                            Note: You will pay a small gas fee. {amounts.immediate.toLocaleString()} PINN44 will be available immediately.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
