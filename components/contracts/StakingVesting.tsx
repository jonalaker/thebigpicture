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
import { ConnectWalletBanner } from '@/components/ConnectWallet';

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
            <Card className="border-[#FFD700]/30 bg-[#1a1a2e]/80">
                <CardHeader>
                    <CardTitle>Vesting & Rewards</CardTitle>
                    <CardDescription className="text-[#FFD700]">Contract not yet deployed</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (!isConnected || !isCorrectNetwork) {
        return (
            <Card className="border-[#2a2a3e] bg-[#1a1a2e]/80">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-[#8247E5]" />
                        Staking & Vesting
                    </CardTitle>
                    <CardDescription>Connect your wallet to access staking features</CardDescription>
                </CardHeader>
                <CardContent>
                    <ConnectWalletBanner />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-[#8247E5]/30 bg-[#1a1a2e]/80 backdrop-blur-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-[#8247E5]" />
                    Vesting & Rewards
                </CardTitle>
                <CardDescription>View your locked tokens and claim rewards</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Info Banner */}
                <Alert className="bg-[#8247E5]/10 border-[#8247E5]/30">
                    <Info className="h-4 w-4 text-[#8247E5]" />
                    <AlertTitle className="text-[#8247E5]">Token Vesting</AlertTitle>
                    <AlertDescription className="text-foreground/60">
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
                    <div className="p-4 rounded-lg bg-[#8247E5]/10 border border-[#8247E5]/20">
                        <p className="text-xs text-foreground/50">Staked Tokens</p>
                        <p className="text-xl font-bold text-[#8247E5]">
                            {isLoading ? '...' : formatTokens(stakeInfo?.amount || BigInt(0))}
                        </p>
                    </div>
                    <div className="p-4 rounded-lg bg-[#1a1a2e] border border-[#2a2a3e]">
                        <p className="text-xs text-foreground/50">Tier</p>
                        <p className="text-xl font-bold text-[#FFD700]">
                            {isLoading ? '...' : getTierName(stakingTier)}
                        </p>
                    </div>
                    <div className="p-4 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/20">
                        <p className="text-xs text-foreground/50">Claimable Vested</p>
                        <p className="text-xl font-bold text-[#FFD700]">
                            {isLoading ? '...' : formatTokens(claimableVested)}
                        </p>
                    </div>
                    <div className="p-4 rounded-lg bg-[#8247E5]/5 border border-[#8247E5]/20">
                        <p className="text-xs text-foreground/50">Pending Rewards</p>
                        <p className="text-xl font-bold text-[#a855f7]">
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
                                <Loader2 className="h-8 w-8 animate-spin text-[#8247E5]" />
                            </div>
                        ) : vestingSchedules.length === 0 ? (
                            <div className="p-4 rounded-lg bg-[#1a1a2e] text-center">
                                <Lock className="w-8 h-8 mx-auto mb-2 text-foreground/30" />
                                <p className="text-foreground/50">No vesting schedules found</p>
                                <p className="text-xs text-foreground/30 mt-1">Claim an airdrop or receive tokens to see your vesting schedules here.</p>
                            </div>
                        ) : (
                            <>
                                {vestingSchedules.map((schedule, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 rounded-lg border ${isUnlocked(schedule) ? 'bg-[#004d40]/20 border-[#00897b]/30' : 'bg-[#1a1a2e]/20 border-[#2a2a3e]/30'}`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <span className={`text-xs px-2 py-1 rounded ${schedule.vestType === 2 ? 'bg-[#FFD700]/10 text-[#FFD700]' : 'bg-[#8247E5]/10 text-[#8247E5]'}`}>
                                                    {getVestTypeName(schedule.vestType)}
                                                </span>
                                            </div>
                                            {isUnlocked(schedule) ? (
                                                <span className="flex items-center gap-1 text-[#FFD700] text-sm">
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
                                                <p className="text-xs text-foreground/50">Total Amount</p>
                                                <p className="text-lg font-bold text-white">{formatTokens(schedule.totalAmount)} PINN44</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-foreground/50">Claimed</p>
                                                <p className="text-lg font-bold text-foreground/50">{formatTokens(schedule.claimed)} PINN44</p>
                                            </div>
                                        </div>

                                        {!isUnlocked(schedule) && (
                                            <div className="mt-3 p-2 rounded bg-[#1a1a2e]">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-yellow-400" />
                                                    <span className="text-sm text-foreground/60">Unlocks on: <strong>{getUnlockDate(schedule)}</strong></span>
                                                </div>
                                                {schedule.vestType === 2 && !schedule.contributionUnlocked && (
                                                    <p className="text-xs text-foreground/40 mt-1">
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
                                        className="w-full btn-gold"
                                    >
                                        {isClaiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlock className="mr-2 h-4 w-4" />}
                                        Claim {formatTokens(claimableVested)} PINN44
                                    </Button>
                                )}

                                {/* No Early Unlock Notice */}
                                <Alert className="bg-[#FFD700]/5 border-[#FFD700]/30">
                                    <AlertTriangle className="h-4 w-4 text-[#FFD700]" />
                                    <AlertTitle className="text-[#FFD700]">How to Unlock Early</AlertTitle>
                                    <AlertDescription className="text-foreground/60 text-sm">
                                        To unlock your airdrop tokens before 6 months, submit your first contribution via the Bounties page. Once verified, your tokens will be immediately unlocked.
                                    </AlertDescription>
                                </Alert>
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="rewards" className="space-y-4 mt-4">
                        <div className="p-4 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/20">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-sm text-foreground/50">Staking Rewards</p>
                                    <p className="text-2xl font-bold text-[#FFD700]">{formatTokens(pendingRewards)} PINN44</p>
                                </div>
                                <Button
                                    onClick={handleClaimRewards}
                                    disabled={isClaiming || pendingRewards === BigInt(0)}
                                    size="sm"
                                    className="btn-gold"
                                >
                                    {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4 mr-2" />}
                                    Claim
                                </Button>
                            </div>
                            <p className="text-xs text-foreground/40 mt-2">
                                Rewards accrue based on your staked token balance.
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Tier Info */}
                <div className="p-4 rounded-lg bg-[#1a1a2e] border border-[#2a2a3e]">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-[#8247E5]" />
                        <span className="font-semibold">Access Tiers</span>
                    </div>
                    <p className="text-xs text-foreground/50 mb-3">
                        Your tier is determined by your staked token balance. Higher tiers unlock premium task access.
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center p-2 rounded bg-[#FFD700]/10">
                            <p className="text-[#FFD700]">Bronze</p>
                            <p className="text-xs text-foreground/50">1,000 PINN44</p>
                        </div>
                        <div className="text-center p-2 rounded bg-[#1e1e2f]">
                            <p className="text-foreground/70">Silver</p>
                            <p className="text-xs text-foreground/50">5,000 PINN44</p>
                        </div>
                        <div className="text-center p-2 rounded bg-[#FFD700]/5">
                            <p className="text-[#FFD700]">Gold</p>
                            <p className="text-xs text-foreground/50">25,000 PINN44</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
