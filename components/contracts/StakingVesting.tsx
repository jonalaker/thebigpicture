'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, Lock, Unlock, Gift, Clock, Shield, Info } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useStakingVesting, usePINN44Token } from '@/hooks/useContracts';
import { CONTRACTS_CONFIG, getExplorerTxUrl } from '@/lib/contracts';

interface StakeInfo {
    amount: bigint;
    stakedAt: bigint;
    unstakeRequestedAt: bigint;
    pendingUnstake: bigint;
}

export function StakingVestingComponent() {
    const { address, isConnected, isCorrectNetwork } = useWallet();
    const staking = useStakingVesting();
    const token = usePINN44Token();

    const [stakeInfo, setStakeInfo] = useState<StakeInfo | null>(null);
    const [stakingTier, setStakingTier] = useState<number>(0);
    const [claimableVested, setClaimableVested] = useState<bigint>(BigInt(0));
    const [pendingRewards, setPendingRewards] = useState<bigint>(BigInt(0));
    const [totalStaked, setTotalStaked] = useState<bigint>(BigInt(0));

    const [isLoading, setIsLoading] = useState(true);
    const [isUnstaking, setIsUnstaking] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch all staking data
    const fetchData = useCallback(async () => {
        if (!isConnected || !isCorrectNetwork || !staking.contract) return;

        setIsLoading(true);
        try {
            const [info, tier, vested, rewards, total] = await Promise.all([
                staking.getStakeInfo(),
                staking.getStakingTier(),
                staking.getClaimableVested(),
                staking.getPendingRewards(),
                staking.getTotalStaked(),
            ]);

            setStakeInfo(info);
            setStakingTier(Number(tier));
            setClaimableVested(vested);
            setPendingRewards(rewards);
            setTotalStaked(total);
        } catch (err) {
            console.error('Failed to fetch staking data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [isConnected, isCorrectNetwork, staking]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Complete unstake (for users with pending unstakes)
    const handleCompleteUnstake = async () => {
        if (!staking.contract) return;

        setIsUnstaking(true);
        setError(null);

        try {
            const receipt = await staking.completeUnstake();
            setTxHash(receipt.hash);
            await fetchData();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to complete unstake';
            setError(message);
        } finally {
            setIsUnstaking(false);
        }
    };

    // Claim rewards
    const handleClaimRewards = async () => {
        if (!staking.contract) return;

        setIsClaiming(true);
        setError(null);

        try {
            const receipt = await staking.claimRewards();
            setTxHash(receipt.hash);
            await fetchData();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to claim rewards';
            setError(message);
        } finally {
            setIsClaiming(false);
        }
    };

    // Claim vested tokens
    const handleClaimVested = async () => {
        if (!staking.contract) return;

        setIsClaiming(true);
        setError(null);

        try {
            const receipt = await staking.claimVested();
            setTxHash(receipt.hash);
            await fetchData();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to claim vested tokens';
            setError(message);
        } finally {
            setIsClaiming(false);
        }
    };

    const formatTokens = (value: bigint) => {
        return parseFloat(ethers.formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 2 });
    };

    const getTierName = (tier: number) => {
        switch (tier) {
            case 1: return 'Bronze';
            case 2: return 'Silver';
            case 3: return 'Gold';
            default: return 'None';
        }
    };

    if (!CONTRACTS_CONFIG.STAKING_VESTING) {
        return (
            <Card className="border-yellow-500/50 bg-black/60">
                <CardHeader>
                    <CardTitle>Vesting & Rewards</CardTitle>
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
                        <TrendingUp className="w-6 h-6 text-purple-400" />
                        Vesting & Rewards
                    </CardTitle>
                    <CardDescription>Connect your wallet to access your vested tokens and rewards</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="border-purple-500/50 bg-black/60 backdrop-blur-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                    Vesting & Rewards
                </CardTitle>
                <CardDescription>View your auto-locked tokens and claim rewards</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Info Banner */}
                <Alert className="bg-blue-900/20 border-blue-500/50">
                    <Info className="h-4 w-4 text-blue-400" />
                    <AlertTitle className="text-blue-400">Auto-Lock Mechanism</AlertTitle>
                    <AlertDescription className="text-gray-300">
                        Contributor rewards are automatically split: 50% immediately available, 50% locked for 90 days.
                        Claim your unlocked rewards from the <strong>Contributor Vault</strong>.
                    </AlertDescription>
                </Alert>

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
                        <AlertTitle className="text-green-400">Success!</AlertTitle>
                        <AlertDescription>
                            <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">
                                View transaction
                            </a>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-purple-900/20 border border-purple-500/20">
                        <p className="text-xs text-gray-400">Locked Tokens</p>
                        <p className="text-xl font-bold text-purple-400">
                            {isLoading ? '...' : formatTokens(stakeInfo?.amount || BigInt(0))}
                        </p>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-500/20">
                        <p className="text-xs text-gray-400">Tier</p>
                        <p className="text-xl font-bold text-blue-400">
                            {isLoading ? '...' : getTierName(stakingTier)}
                        </p>
                    </div>
                    <div className="p-4 rounded-lg bg-green-900/20 border border-green-500/20">
                        <p className="text-xs text-gray-400">Pending Rewards</p>
                        <p className="text-xl font-bold text-green-400">
                            {isLoading ? '...' : formatTokens(pendingRewards)}
                        </p>
                    </div>
                    <div className="p-4 rounded-lg bg-pink-900/20 border border-pink-500/20">
                        <p className="text-xs text-gray-400">Total Locked</p>
                        <p className="text-xl font-bold text-pink-400">
                            {isLoading ? '...' : formatTokens(totalStaked)}
                        </p>
                    </div>
                </div>

                <Tabs defaultValue="vesting" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="vesting">Vesting</TabsTrigger>
                        <TabsTrigger value="rewards">Rewards</TabsTrigger>
                    </TabsList>

                    <TabsContent value="vesting" className="space-y-4 mt-4">
                        {/* Pending Unstake (if any) */}
                        {stakeInfo?.pendingUnstake && stakeInfo.pendingUnstake > BigInt(0) ? (
                            <div className="p-4 rounded-lg bg-yellow-900/20 border border-yellow-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className="w-4 h-4 text-yellow-400" />
                                    <span className="text-yellow-400">Pending Unlock</span>
                                </div>
                                <p className="text-xl font-bold">{formatTokens(stakeInfo.pendingUnstake)} PINN44</p>
                                <Button
                                    onClick={handleCompleteUnstake}
                                    disabled={isUnstaking}
                                    className="w-full mt-4"
                                >
                                    {isUnstaking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlock className="mr-2 h-4 w-4" />}
                                    Complete Unlock
                                </Button>
                            </div>
                        ) : (
                            <div className="p-4 rounded-lg bg-gray-800/50">
                                <div className="flex items-center gap-2 mb-3">
                                    <Lock className="w-5 h-5 text-purple-400" />
                                    <span className="font-semibold">Vested Tokens</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-sm text-gray-400">Claimable Now</p>
                                        <p className="text-2xl font-bold text-purple-400">{formatTokens(claimableVested)} PINN44</p>
                                    </div>
                                    <Button
                                        onClick={handleClaimVested}
                                        disabled={isClaiming || claimableVested === BigInt(0)}
                                        className="bg-gradient-to-r from-purple-600 to-pink-600"
                                    >
                                        {isClaiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlock className="mr-2 h-4 w-4" />}
                                        Claim
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500 mt-3">
                                    Tokens become claimable after the 90-day lock period ends.
                                </p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="rewards" className="space-y-4 mt-4">
                        <div className="p-4 rounded-lg bg-green-900/20 border border-green-500/20">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-sm text-gray-400">Staking Rewards</p>
                                    <p className="text-2xl font-bold text-green-400">{formatTokens(pendingRewards)} PINN44</p>
                                </div>
                                <Button
                                    onClick={handleClaimRewards}
                                    disabled={isClaiming || pendingRewards === BigInt(0)}
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4 mr-2" />}
                                    Claim
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Rewards accrue based on your locked token balance and participation.
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Tier Info */}
                <div className="p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-purple-400" />
                        <span className="font-semibold">Access Tiers</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                        Your tier is determined by your locked token balance. Higher tiers unlock premium task access.
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center p-2 rounded bg-amber-900/20">
                            <p className="text-amber-400">Bronze</p>
                            <p className="text-xs text-gray-400">1,000 PINN44</p>
                        </div>
                        <div className="text-center p-2 rounded bg-gray-700/20">
                            <p className="text-gray-300">Silver</p>
                            <p className="text-xs text-gray-400">5,000 PINN44</p>
                        </div>
                        <div className="text-center p-2 rounded bg-yellow-900/20">
                            <p className="text-yellow-400">Gold</p>
                            <p className="text-xs text-gray-400">25,000 PINN44</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
