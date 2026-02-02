'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, Lock, Unlock, Gift, Clock, Shield, Info, AlertTriangle } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useStakingVesting, usePINN44Token } from '@/hooks/useContracts';
import { CONTRACTS_CONFIG, getExplorerTxUrl } from '@/lib/contracts';

interface StakeInfo {
    amount: bigint;
    stakedAt: bigint;
    unstakeRequestedAt: bigint;
    pendingUnstake: bigint;
}

interface VestingSchedule {
    totalAmount: bigint;
    startTime: bigint;
    cliffDuration: bigint;
    vestingDuration: bigint;
    claimed: bigint;
    vestType: number;
    contributionUnlocked: boolean;
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
    const [vestingSchedules, setVestingSchedules] = useState<VestingSchedule[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isUnstaking, setIsUnstaking] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch all staking data with error handling for each call
    const fetchData = useCallback(async () => {
        if (!isConnected || !isCorrectNetwork || !staking.contract) return;

        setIsLoading(true);
        setError(null);

        // Fetch each value independently to avoid one failure breaking everything
        try {
            const info = await staking.getStakeInfo();
            setStakeInfo(info);
        } catch (err) {
            console.log('No stake info for user');
            setStakeInfo(null);
        }

        try {
            const tier = await staking.getStakingTier();
            setStakingTier(Number(tier));
        } catch (err) {
            console.log('Could not get staking tier');
            setStakingTier(0);
        }

        try {
            const vested = await staking.getClaimableVested();
            setClaimableVested(vested);
        } catch (err) {
            console.log('Could not get claimable vested');
            setClaimableVested(BigInt(0));
        }

        try {
            const rewards = await staking.getPendingRewards();
            setPendingRewards(rewards);
        } catch (err) {
            console.log('Could not get pending rewards');
            setPendingRewards(BigInt(0));
        }

        try {
            const total = await staking.getTotalStaked();
            setTotalStaked(total);
        } catch (err) {
            console.log('Could not get total staked');
            setTotalStaked(BigInt(0));
        }

        // Fetch vesting schedules
        try {
            if (staking.contract && address) {
                const schedules: VestingSchedule[] = [];
                let index = 0;
                while (true) {
                    try {
                        const schedule = await staking.contract.vestingSchedules(address, index);
                        if (schedule.totalAmount === BigInt(0)) break;
                        schedules.push({
                            totalAmount: schedule.totalAmount,
                            startTime: schedule.startTime,
                            cliffDuration: schedule.cliffDuration,
                            vestingDuration: schedule.vestingDuration,
                            claimed: schedule.claimed,
                            vestType: Number(schedule.vestType),
                            contributionUnlocked: schedule.contributionUnlocked,
                        });
                        index++;
                    } catch {
                        break;
                    }
                }
                setVestingSchedules(schedules);
            }
        } catch (err) {
            console.log('Could not fetch vesting schedules');
            setVestingSchedules([]);
        }

        setIsLoading(false);
    }, [isConnected, isCorrectNetwork, staking, address]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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

    const getVestTypeName = (vestType: number) => {
        switch (vestType) {
            case 0: return 'Team';
            case 1: return 'DAO';
            case 2: return 'Airdrop';
            default: return 'Unknown';
        }
    };

    const getUnlockDate = (schedule: VestingSchedule) => {
        const unlockTime = Number(schedule.startTime) + Number(schedule.cliffDuration);
        return new Date(unlockTime * 1000).toLocaleDateString();
    };

    const isUnlocked = (schedule: VestingSchedule) => {
        if (schedule.contributionUnlocked) return true;
        const unlockTime = Number(schedule.startTime) + Number(schedule.cliffDuration);
        return Date.now() / 1000 >= unlockTime;
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
                <CardDescription>View your locked tokens and claim rewards</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Info Banner */}
                <Alert className="bg-blue-900/20 border-blue-500/50">
                    <Info className="h-4 w-4 text-blue-400" />
                    <AlertTitle className="text-blue-400">Token Vesting</AlertTitle>
                    <AlertDescription className="text-gray-300">
                        Airdrop tokens are locked for 6 months OR unlocked immediately upon first contribution.
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
                        <p className="text-xs text-gray-400">Staked Tokens</p>
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
                        <p className="text-xs text-gray-400">Claimable Vested</p>
                        <p className="text-xl font-bold text-green-400">
                            {isLoading ? '...' : formatTokens(claimableVested)}
                        </p>
                    </div>
                    <div className="p-4 rounded-lg bg-pink-900/20 border border-pink-500/20">
                        <p className="text-xs text-gray-400">Pending Rewards</p>
                        <p className="text-xl font-bold text-pink-400">
                            {isLoading ? '...' : formatTokens(pendingRewards)}
                        </p>
                    </div>
                </div>

                <Tabs defaultValue="vesting" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="vesting">Vesting Schedules</TabsTrigger>
                        <TabsTrigger value="rewards">Rewards</TabsTrigger>
                    </TabsList>

                    <TabsContent value="vesting" className="space-y-4 mt-4">
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                            </div>
                        ) : vestingSchedules.length === 0 ? (
                            <div className="p-4 rounded-lg bg-gray-800/50 text-center">
                                <Lock className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                                <p className="text-gray-400">No vesting schedules found</p>
                                <p className="text-xs text-gray-500 mt-1">Claim an airdrop or receive tokens to see your vesting schedules here.</p>
                            </div>
                        ) : (
                            <>
                                {vestingSchedules.map((schedule, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 rounded-lg border ${isUnlocked(schedule) ? 'bg-green-900/20 border-green-500/30' : 'bg-purple-900/20 border-purple-500/30'}`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <span className={`text-xs px-2 py-1 rounded ${schedule.vestType === 2 ? 'bg-pink-500/20 text-pink-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                    {getVestTypeName(schedule.vestType)}
                                                </span>
                                            </div>
                                            {isUnlocked(schedule) ? (
                                                <span className="flex items-center gap-1 text-green-400 text-sm">
                                                    <Unlock className="w-4 h-4" /> Unlocked
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-yellow-400 text-sm">
                                                    <Lock className="w-4 h-4" /> Locked
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-gray-400">Total Amount</p>
                                                <p className="text-lg font-bold text-white">{formatTokens(schedule.totalAmount)} PINN44</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400">Claimed</p>
                                                <p className="text-lg font-bold text-gray-400">{formatTokens(schedule.claimed)} PINN44</p>
                                            </div>
                                        </div>

                                        {!isUnlocked(schedule) && (
                                            <div className="mt-3 p-2 rounded bg-gray-800/50">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-yellow-400" />
                                                    <span className="text-sm text-gray-300">Unlocks on: <strong>{getUnlockDate(schedule)}</strong></span>
                                                </div>
                                                {schedule.vestType === 2 && !schedule.contributionUnlocked && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Or unlock immediately by making your first contribution!
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Claim Button */}
                                {claimableVested > BigInt(0) && (
                                    <Button
                                        onClick={handleClaimVested}
                                        disabled={isClaiming}
                                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                                    >
                                        {isClaiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlock className="mr-2 h-4 w-4" />}
                                        Claim {formatTokens(claimableVested)} PINN44
                                    </Button>
                                )}

                                {/* No Early Unlock Notice */}
                                <Alert className="bg-yellow-900/20 border-yellow-500/50">
                                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                                    <AlertTitle className="text-yellow-400">How to Unlock Early</AlertTitle>
                                    <AlertDescription className="text-gray-300 text-sm">
                                        To unlock your airdrop tokens before 6 months, submit your first contribution via the Bounties page. Once verified, your tokens will be immediately unlocked.
                                    </AlertDescription>
                                </Alert>
                            </>
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
                                Rewards accrue based on your staked token balance.
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
                        Your tier is determined by your staked token balance. Higher tiers unlock premium task access.
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
