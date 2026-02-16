'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Wallet, ExternalLink, Gift, Lock, Info, AlertTriangle, Plus } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { usePINN44Token } from '@/hooks/useContracts';
import { getExplorerTxUrl, CONTRACTS_CONFIG } from '@/lib/contracts';
import { generateDeviceFingerprint, hasClaimedBefore, markAsClaimed } from '@/lib/fingerprint';

// Constants matching the contract
const AIRDROP_AMOUNT = 100;
const IMMEDIATE_PERCENTAGE = 10;
const LOCKED_PERCENTAGE = 90;
const LOCK_DURATION_MONTHS = 6;

interface ClaimResult {
    success: boolean;
    txHash?: string;
    immediateAmount?: string;
    lockedAmount?: string;
    error?: string;
}

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

    const token = usePINN44Token();

    const [claimStatus, setClaimStatus] = useState<'idle' | 'checking' | 'eligible' | 'claimed' | 'error'>('idle');
    const [isClaiming, setIsClaiming] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tokenBalance, setTokenBalance] = useState<string>('0');
    const [fingerprint, setFingerprint] = useState<string | null>(null);
    const [isAddingToken, setIsAddingToken] = useState(false);
    const [tokenAdded, setTokenAdded] = useState(false);

    // Calculate amounts
    const immediateAmount = (AIRDROP_AMOUNT * IMMEDIATE_PERCENTAGE) / 100;
    const lockedAmount = (AIRDROP_AMOUNT * LOCKED_PERCENTAGE) / 100;

    // Generate fingerprint on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            generateDeviceFingerprint().then(setFingerprint);
        }
    }, []);

    // Check if already claimed
    const checkClaimStatus = useCallback(async () => {
        if (!address || !isCorrectNetwork || !fingerprint) return;

        setClaimStatus('checking');
        setError(null);

        try {
            // Check localStorage first (quick check)
            if (hasClaimedBefore()) {
                setClaimStatus('claimed');
                return;
            }

            // Check with API
            const response = await fetch(`/api/airdrop/claim?fingerprint=${fingerprint}&address=${address}`);
            const data = await response.json();

            if (data.claimed) {
                setClaimStatus('claimed');
                markAsClaimed();
            } else {
                setClaimStatus('eligible');
            }

            // Fetch token balance
            const balance = await token.getBalance();
            setTokenBalance(ethers.formatEther(balance));
        } catch (err) {
            console.error('Error checking claim status:', err);
            setError('Failed to check eligibility. Please try again.');
            setClaimStatus('error');
        }
    }, [address, isCorrectNetwork, fingerprint, token]);

    // Claim airdrop
    const claimAirdrop = async () => {
        if (!address || !fingerprint || claimStatus !== 'eligible') {
            return;
        }

        setIsClaiming(true);
        setError(null);

        try {
            const response = await fetch('/api/airdrop/claim', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    walletAddress: address,
                    fingerprint: fingerprint,
                }),
            });

            const result: ClaimResult = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to claim airdrop');
            }

            if (result.success && result.txHash) {
                setTxHash(result.txHash);
                setClaimStatus('claimed');
                markAsClaimed();

                // Refresh balance
                const newBalance = await token.getBalance();
                setTokenBalance(ethers.formatEther(newBalance));
            }
        } catch (err: unknown) {
            console.error('Claim error:', err);
            const message = err instanceof Error ? err.message : 'Failed to claim tokens';
            setError(message);
        } finally {
            setIsClaiming(false);
        }
    };

    // Add PINN44 token to MetaMask
    const addTokenToMetaMask = async () => {
        if (typeof window === 'undefined' || !window.ethereum) return;

        setIsAddingToken(true);
        try {
            const wasAdded = await window.ethereum.request({
                method: 'wallet_watchAsset',
                params: {
                    type: 'ERC20',
                    options: {
                        address: CONTRACTS_CONFIG.PINN44_TOKEN || process.env.NEXT_PUBLIC_PINN44_TOKEN_ADDRESS || '',
                        symbol: 'PINN44',
                        decimals: 18,
                        image: '',
                    },
                },
            });
            if (wasAdded) {
                setTokenAdded(true);
            }
        } catch (err) {
            console.error('Error adding token to MetaMask:', err);
        } finally {
            setIsAddingToken(false);
        }
    };

    // Check status when wallet connects
    useEffect(() => {
        if (isConnected && isCorrectNetwork && address && fingerprint) {
            checkClaimStatus();
        }
    }, [isConnected, isCorrectNetwork, address, fingerprint, checkClaimStatus]);

    return (
        <section className="py-20 px-4 bg-[#121212] min-h-[80vh] flex items-center">
            <div className="max-w-2xl mx-auto w-full">
                <Card className="border-[#8247E5]/30 bg-[#1a1a2e]/80 backdrop-blur-lg">
                    <CardHeader className="text-center">
                        <div className="relative">
                            <Gift className="w-16 h-16 mx-auto mb-4 text-[#FFD700] animate-pulse" />
                        </div>
                        <CardTitle className="text-3xl font-bold text-gradient-purple-gold">
                            Free PINN44 Airdrop
                        </CardTitle>
                        <CardDescription className="text-foreground/60">
                            Claim {AIRDROP_AMOUNT} PINN44 tokens - No gas fees required!
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Lock Mechanism Info Banner */}
                        <Alert className="bg-[#8247E5]/10 border-[#8247E5]/30">
                            <Info className="h-4 w-4 text-[#8247E5]" />
                            <AlertTitle className="text-[#8247E5]">Token Distribution</AlertTitle>
                            <AlertDescription className="text-foreground/60 space-y-2">
                                <p>Your airdrop tokens are distributed with anti-dump protection:</p>
                                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                                    <li><strong className="text-[#FFD700]">{immediateAmount} PINN44 (10%)</strong> — Available instantly</li>
                                    <li><strong className="text-[#8247E5]">{lockedAmount} PINN44 (90%)</strong> — Locked for {LOCK_DURATION_MONTHS} months OR until first contribution</li>
                                </ul>
                            </AlertDescription>
                        </Alert>

                        {/* Features */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="text-center p-3 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/20">
                                <Gift className="w-6 h-6 mx-auto mb-2 text-[#FFD700]" />
                                <p className="text-xs text-foreground/40">Free Gas</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-[#8247E5]/10 border border-[#8247E5]/20">
                                <Lock className="w-6 h-6 mx-auto mb-2 text-[#8247E5]" />
                                <p className="text-xs text-foreground/40">Anti-Dump Lock</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/20">
                                <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-[#FFD700]" />
                                <p className="text-xs text-foreground/40">Instant Claim</p>
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
                        {txHash && (
                            <Alert className="bg-green-900/20 border-green-500/50">
                                <CheckCircle2 className="h-4 w-4 text-green-400" />
                                <AlertTitle className="text-green-400">Tokens Claimed!</AlertTitle>
                                <AlertDescription className="text-green-200 space-y-2">
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div className="p-2 rounded bg-green-900/30">
                                            <p className="text-xs text-gray-400">Received Now</p>
                                            <p className="text-lg font-bold text-green-400">{immediateAmount} PINN44</p>
                                        </div>
                                        <div className="p-2 rounded bg-purple-900/30">
                                            <p className="text-xs text-gray-400">Locked ({LOCK_DURATION_MONTHS} months)</p>
                                            <p className="text-lg font-bold text-purple-400">{lockedAmount} PINN44</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <a
                                            href={getExplorerTxUrl(txHash)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 text-sm"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            View Transaction
                                        </a>
                                        <Button
                                            onClick={addTokenToMetaMask}
                                            disabled={isAddingToken || tokenAdded}
                                            size="sm"
                                            className="bg-orange-500 hover:bg-orange-600 text-white"
                                        >
                                            {isAddingToken ? (
                                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                            ) : tokenAdded ? (
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                            ) : (
                                                <Plus className="h-3 w-3 mr-1" />
                                            )}
                                            {tokenAdded ? 'Token Added!' : 'Add to MetaMask'}
                                        </Button>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Wallet Not Connected */}
                        {!isConnected && (
                            <div className="text-center space-y-4">
                                <p className="text-foreground/50">Connect your wallet to claim your free tokens!</p>
                                <Button
                                    onClick={connect}
                                    disabled={isConnecting || !isMetaMaskAvailable}
                                    className="w-full btn-gold"
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
                                        Please switch to Polygon Amoy Testnet to claim your tokens.
                                    </AlertDescription>
                                </Alert>
                                <Button
                                    onClick={switchToPolygon}
                                    className="w-full bg-gradient-to-r from-[#FFD700] to-[#cc9900] hover:from-[#ffe44d] hover:to-[#FFD700] text-[#121212] font-bold"
                                >
                                    Switch Network
                                </Button>
                            </div>
                        )}

                        {/* Connected & Correct Network */}
                        {isConnected && isCorrectNetwork && (
                            <div className="space-y-4">
                                {/* Wallet Info */}
                                <div className="p-4 rounded-lg bg-[#1a1a2e] border border-[#2a2a3e]">
                                    <div className="flex justify-between items-center">
                                        <span className="text-foreground/50">Connected Wallet</span>
                                        <span className="text-foreground font-mono">{formatAddress(address!)}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-foreground/50">PINN44 Balance</span>
                                        <span className="text-[#FFD700] font-semibold">{parseFloat(tokenBalance).toLocaleString()} PINN44</span>
                                    </div>
                                </div>

                                {/* Checking Status */}
                                {claimStatus === 'checking' && (
                                    <div className="text-center py-8">
                                        <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#8247E5]" />
                                        <p className="text-foreground/50 mt-2">Checking eligibility...</p>
                                    </div>
                                )}

                                {/* Already Claimed */}
                                {claimStatus === 'claimed' && !txHash && (
                                    <div className="space-y-4">
                                        <Alert className="bg-blue-900/20 border-blue-500/50">
                                            <CheckCircle2 className="h-4 w-4 text-blue-400" />
                                            <AlertTitle className="text-blue-400">Already Claimed</AlertTitle>
                                            <AlertDescription className="text-blue-200">
                                                You have already claimed your airdrop tokens.
                                            </AlertDescription>
                                        </Alert>

                                        {/* Locked Token Status */}
                                        <div className="p-4 rounded-lg bg-purple-900/20 border border-purple-500/30">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Lock className="w-5 h-5 text-purple-400" />
                                                <span className="font-semibold text-purple-400">Your Locked Tokens</span>
                                            </div>
                                            <div className="mt-4 p-3 rounded bg-gray-800/50 border border-gray-700">
                                                <p className="text-sm text-gray-300">
                                                    <strong>Unlock Conditions:</strong>
                                                </p>
                                                <ul className="text-xs text-gray-400 mt-1 space-y-1">
                                                    <li>✓ Complete your first contribution, OR</li>
                                                    <li>✓ Wait {LOCK_DURATION_MONTHS} months from claim date</li>
                                                </ul>
                                            </div>
                                        </div>

                                        {/* Early Unlock Warning */}
                                        <Alert className="bg-yellow-900/20 border-yellow-500/50">
                                            <AlertTriangle className="h-4 w-4 text-yellow-400" />
                                            <AlertTitle className="text-yellow-400">Early Unlock Penalty</AlertTitle>
                                            <AlertDescription className="text-yellow-200 text-sm">
                                                Unlocking before conditions are met incurs a <strong>5% penalty</strong>.
                                            </AlertDescription>
                                        </Alert>

                                        {/* Add to MetaMask button for already claimed users */}
                                        <Button
                                            onClick={addTokenToMetaMask}
                                            disabled={isAddingToken || tokenAdded}
                                            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                                        >
                                            {isAddingToken ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            ) : tokenAdded ? (
                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                            ) : (
                                                <Plus className="h-4 w-4 mr-2" />
                                            )}
                                            {tokenAdded ? 'PINN44 Added to MetaMask!' : 'Add PINN44 to MetaMask'}
                                        </Button>
                                    </div>
                                )}

                                {/* Eligible and Can Claim */}
                                {claimStatus === 'eligible' && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg bg-[#1a1a2e] border border-[#8247E5]/30">
                                            <div className="text-center mb-4">
                                                <p className="text-foreground/50 text-sm">Your Free Airdrop</p>
                                                <p className="text-4xl font-bold text-gradient-purple-gold">
                                                    {AIRDROP_AMOUNT} PINN44
                                                </p>
                                            </div>

                                            {/* Breakdown */}
                                            <div className="grid grid-cols-2 gap-4 mt-4">
                                                <div className="p-3 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/30 text-center">
                                                    <p className="text-xs text-foreground/40">Immediate (10%)</p>
                                                    <p className="text-xl font-bold text-[#FFD700]">{immediateAmount}</p>
                                                    <p className="text-xs text-[#FFD700]/70">Available now</p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-[#8247E5]/10 border border-[#8247E5]/30 text-center">
                                                    <p className="text-xs text-foreground/40">Locked (90%)</p>
                                                    <p className="text-xl font-bold text-[#8247E5]">{lockedAmount}</p>
                                                    <p className="text-xs text-[#a855f7]">{LOCK_DURATION_MONTHS} months lock</p>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            onClick={claimAirdrop}
                                            disabled={isClaiming}
                                            className="w-full btn-gold py-6 text-lg"
                                        >
                                            {isClaiming ? (
                                                <>
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                    Claiming...
                                                </>
                                            ) : (
                                                <>
                                                    <Gift className="mr-2 h-5 w-5" />
                                                    Claim Free Tokens
                                                </>
                                            )}
                                        </Button>

                                        <p className="text-xs text-center text-foreground/30">
                                            ✨ No gas fees - We pay for everything!
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
