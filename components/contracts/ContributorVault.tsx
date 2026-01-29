'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, Vault, Lock, Unlock, TrendingUp, Timer, CheckCircle2 } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useContributorVault } from '@/hooks/useContracts';
import { CONTRACTS_CONFIG, getExplorerTxUrl } from '@/lib/contracts';

interface ContributorStats {
    totalEarned: bigint;
    totalClaimed: bigint;
    lockedBalance: bigint;
}

export function ContributorVaultComponent() {
    const { address, isConnected, isCorrectNetwork } = useWallet();
    const vault = useContributorVault();

    const [stats, setStats] = useState<ContributorStats | null>(null);
    const [claimableAmount, setClaimableAmount] = useState<bigint>(BigInt(0));
    const [lockedBalance, setLockedBalance] = useState<bigint>(BigInt(0));

    const [isLoading, setIsLoading] = useState(true);
    const [isClaiming, setIsClaiming] = useState(false);
    const [isEarlyUnlocking, setIsEarlyUnlocking] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch vault data
    const fetchData = useCallback(async () => {
        if (!isConnected || !isCorrectNetwork || !vault.contract) return;

        setIsLoading(true);
        try {
            const [contributorStats, claimable, locked] = await Promise.all([
                vault.getContributorStats(),
                vault.getClaimableAmount(),
                vault.getLockedBalance(),
            ]);

            setStats(contributorStats);
            setClaimableAmount(claimable);
            setLockedBalance(locked);
        } catch (err) {
            console.error('Failed to fetch vault data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [isConnected, isCorrectNetwork, vault]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Claim unlocked tokens
    const handleClaim = async () => {
        if (!vault.contract) return;

        setIsClaiming(true);
        setError(null);
        setTxHash(null);

        try {
            const receipt = await vault.claimLockedTokens();
            setTxHash(receipt.hash);
            await fetchData();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to claim tokens';
            setError(message);
        } finally {
            setIsClaiming(false);
        }
    };

    // Early unlock (with penalty)
    const handleEarlyUnlock = async () => {
        if (!vault.contract) return;

        setIsEarlyUnlocking(true);
        setError(null);
        setTxHash(null);

        try {
            const receipt = await vault.earlyUnlock();
            setTxHash(receipt.hash);
            await fetchData();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to unlock tokens';
            setError(message);
        } finally {
            setIsEarlyUnlocking(false);
        }
    };

    const formatTokens = (value: bigint) => {
        return parseFloat(ethers.formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 2 });
    };

    const getProgressPercent = () => {
        if (!stats || stats.totalEarned === BigInt(0)) return 0;
        return Number((stats.totalClaimed * BigInt(100)) / stats.totalEarned);
    };

    if (!CONTRACTS_CONFIG.CONTRIBUTOR_VAULT) {
        return (
            <Card className="border-yellow-500/50 bg-black/60">
                <CardHeader>
                    <CardTitle>Contributor Vault</CardTitle>
                    <CardDescription className="text-yellow-400">Contract not yet deployed</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (!isConnected || !isCorrectNetwork) {
        return (
            <Card className="border-gray-500/50 bg-black/60">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Vault className="w-6 h-6 text-green-400" />
                        Contributor Vault
                    </CardTitle>
                    <CardDescription>Connect your wallet to Polygon Amoy to view your rewards</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="border-green-500/50 bg-black/60 backdrop-blur-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Vault className="w-6 h-6 text-green-400" />
                    Contributor Vault
                </CardTitle>
                <CardDescription>View and claim your contributor rewards</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Error Display */}
                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Success */}
                {txHash && (
                    <Alert className="bg-green-900/20 border-green-500/50">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        <AlertTitle className="text-green-400">Success!</AlertTitle>
                        <AlertDescription>
                            <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">
                                View transaction
                            </a>
                        </AlertDescription>
                    </Alert>
                )}

                {isLoading ? (
                    <div className="text-center py-8">
                        <Loader2 className="w-8 h-8 mx-auto animate-spin text-green-400" />
                        <p className="text-gray-400 mt-2">Loading vault data...</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 rounded-lg bg-green-900/20 border border-green-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="w-4 h-4 text-green-400" />
                                    <p className="text-xs text-gray-400">Total Earned</p>
                                </div>
                                <p className="text-2xl font-bold text-green-400">
                                    {formatTokens(stats?.totalEarned || BigInt(0))}
                                </p>
                                <p className="text-xs text-gray-500">PINN44</p>
                            </div>

                            <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <Lock className="w-4 h-4 text-blue-400" />
                                    <p className="text-xs text-gray-400">Locked Balance</p>
                                </div>
                                <p className="text-2xl font-bold text-blue-400">
                                    {formatTokens(lockedBalance)}
                                </p>
                                <p className="text-xs text-gray-500">PINN44</p>
                            </div>

                            <div className="p-4 rounded-lg bg-purple-900/20 border border-purple-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <Unlock className="w-4 h-4 text-purple-400" />
                                    <p className="text-xs text-gray-400">Claimable Now</p>
                                </div>
                                <p className="text-2xl font-bold text-purple-400">
                                    {formatTokens(claimableAmount)}
                                </p>
                                <p className="text-xs text-gray-500">PINN44</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        {stats && stats.totalEarned > BigInt(0) && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Claim Progress</span>
                                    <span className="text-gray-400">
                                        {formatTokens(stats.totalClaimed)} / {formatTokens(stats.totalEarned)} PINN44
                                    </span>
                                </div>
                                <Progress value={getProgressPercent()} className="h-2" />
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Button
                                onClick={handleClaim}
                                disabled={isClaiming || claimableAmount === BigInt(0)}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                            >
                                {isClaiming ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Claiming...
                                    </>
                                ) : (
                                    <>
                                        <Unlock className="mr-2 h-4 w-4" />
                                        Claim {formatTokens(claimableAmount)} PINN44
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleEarlyUnlock}
                                disabled={isEarlyUnlocking || lockedBalance === BigInt(0)}
                                variant="outline"
                                className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                            >
                                {isEarlyUnlocking ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Unlocking...
                                    </>
                                ) : (
                                    <>
                                        <Timer className="mr-2 h-4 w-4" />
                                        Early Unlock (20% Fee)
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Info */}
                        <div className="p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                How It Works
                            </h4>
                            <ul className="text-sm text-gray-400 space-y-1">
                                <li>• When you receive rewards, 50% is available immediately</li>
                                <li>• The remaining 50% is locked for 90 days</li>
                                <li>• After 90 days, locked tokens become claimable</li>
                                <li>• Early unlock is available with a 20% penalty fee</li>
                            </ul>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
