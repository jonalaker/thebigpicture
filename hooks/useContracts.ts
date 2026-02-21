'use client';

import { useMemo } from 'react';
import { Contract } from 'ethers';
import { useWallet } from './useWallet';
import { CONTRACTS_CONFIG } from '@/lib/contracts';
import {
    PINN44_TOKEN_ABI,
    MERKLE_DISTRIBUTOR_ABI,
    STAKING_VESTING_ABI,
    WORK_SUBMISSION_ABI,
    CONTRIBUTOR_VAULT_ABI,
    GOVERNANCE_MODULE_ABI,
    FIXED_PRICE_SWAP_ABI,
} from '@/lib/contracts';

// Generic hook to create a contract instance
function useContract(address: string, abi: string[]): Contract | null {
    const { signer, provider, isConnected, isCorrectNetwork } = useWallet();

    return useMemo(() => {
        if (!address || !isConnected || !isCorrectNetwork) return null;

        try {
            // Use signer if available (for write operations), otherwise provider (read-only)
            const signerOrProvider = signer || provider;
            if (!signerOrProvider) return null;

            return new Contract(address, abi, signerOrProvider);
        } catch (error) {
            console.error('Failed to create contract instance:', error);
            return null;
        }
    }, [address, abi, signer, provider, isConnected, isCorrectNetwork]);
}

// PINN44 Token Hook
export function usePINN44Token() {
    const contract = useContract(CONTRACTS_CONFIG.PINN44_TOKEN, PINN44_TOKEN_ABI);
    const { address } = useWallet();

    return useMemo(() => ({
        contract,

        // Read functions
        getBalance: async () => {
            if (!contract || !address) return BigInt(0);
            return contract.balanceOf(address);
        },

        getAllowance: async (spender: string) => {
            if (!contract || !address) return BigInt(0);
            return contract.allowance(address, spender);
        },

        getDecimals: async () => {
            if (!contract) return 18;
            return contract.decimals();
        },

        // Write functions
        approve: async (spender: string, amount: bigint) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.approve(spender, amount);
            return tx.wait();
        },

        transfer: async (to: string, amount: bigint) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.transfer(to, amount);
            return tx.wait();
        },
    }), [contract, address]);
}

// Merkle Distributor Hook (New Airdrop System)
export function useMerkleDistributor() {
    const contract = useContract(CONTRACTS_CONFIG.MERKLE_DISTRIBUTOR, MERKLE_DISTRIBUTOR_ABI);

    return useMemo(() => ({
        contract,

        // Read functions
        getCurrentEpoch: async () => {
            if (!contract) return 0;
            return contract.currentEpoch();
        },

        isClaimed: async (epochId: number, index: number) => {
            if (!contract) return false;
            return contract.isClaimed(epochId, index);
        },

        getRemainingAmount: async (epochId: number) => {
            if (!contract) return BigInt(0);
            return contract.getRemainingAmount(epochId);
        },

        verifyClaim: async (epochId: number, index: number, account: string, amount: bigint, proof: string[]) => {
            if (!contract) return { valid: false, reason: 'Contract not available' };
            return contract.verifyClaim(epochId, index, account, amount, proof);
        },

        // Write functions
        claim: async (epochId: number, index: number, account: string, amount: bigint, proof: string[]) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.claim(epochId, index, account, amount, proof);
            return tx.wait();
        },
    }), [contract]);
}

// Staking & Vesting Hook
export function useStakingVesting() {
    const contract = useContract(CONTRACTS_CONFIG.STAKING_VESTING, STAKING_VESTING_ABI);
    const { address } = useWallet();

    return useMemo(() => ({
        contract,

        // Read functions
        getStakeInfo: async () => {
            if (!contract || !address) return null;
            const info = await contract.stakes(address);
            return {
                amount: info.amount,
                stakedAt: info.stakedAt,
                unstakeRequestedAt: info.unstakeRequestedAt,
                pendingUnstake: info.pendingUnstake,
            };
        },

        getStakingTier: async () => {
            if (!contract || !address) return 0;
            return contract.getStakingTier(address);
        },

        getClaimableVested: async () => {
            if (!contract || !address) return BigInt(0);
            return contract.getClaimableVested(address);
        },

        getPendingRewards: async () => {
            if (!contract || !address) return BigInt(0);
            return contract.getPendingRewards(address);
        },

        getTotalStaked: async () => {
            if (!contract) return BigInt(0);
            return contract.totalStaked();
        },

        // Write functions
        stake: async (amount: bigint) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.stake(amount);
            return tx.wait();
        },

        requestUnstake: async (amount: bigint) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.requestUnstake(amount);
            return tx.wait();
        },

        completeUnstake: async () => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.completeUnstake();
            return tx.wait();
        },

        claimVested: async () => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.claimVested();
            return tx.wait();
        },

        claimRewards: async () => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.claimRewards();
            return tx.wait();
        },
    }), [contract, address]);
}

// Work Submission Hook
export function useWorkSubmission() {
    const contract = useContract(CONTRACTS_CONFIG.WORK_SUBMISSION, WORK_SUBMISSION_ABI);
    const { address } = useWallet();

    return useMemo(() => ({
        contract,

        // Read functions
        getBountyCount: async () => {
            if (!contract) return 0;
            return contract.bountyCount();
        },

        getBounty: async (bountyId: number) => {
            if (!contract) return null;
            return contract.bounties(bountyId);
        },

        getSubmission: async (submissionId: number) => {
            if (!contract) return null;
            return contract.submissions(submissionId);
        },

        getBountySubmissions: async (bountyId: number) => {
            if (!contract) return [];
            return contract.getBountySubmissions(bountyId);
        },

        isBountyOpen: async (bountyId: number) => {
            if (!contract) return false;
            return contract.isBountyOpen(bountyId);
        },

        getActiveBountyCount: async () => {
            if (!contract) return 0;
            return contract.getActiveBountyCount();
        },

        getTotalStats: async () => {
            if (!contract) return { funded: BigInt(0), payouts: BigInt(0) };
            const [funded, payouts] = await Promise.all([
                contract.totalBountiesFunded(),
                contract.totalPayouts()
            ]);
            return { funded, payouts };
        },

        // Role checking functions
        isAdmin: async () => {
            if (!contract || !address) return false;
            try {
                const adminRole = await contract.BOUNTY_ADMIN();
                return contract.hasRole(adminRole, address);
            } catch {
                return false;
            }
        },

        isJudge: async () => {
            if (!contract || !address) return false;
            try {
                const judgeRole = await contract.JUDGE_ROLE();
                return contract.hasRole(judgeRole, address);
            } catch {
                return false;
            }
        },

        // User Write functions
        submitWork: async (bountyId: number, fileUri: string, thumbnailUri: string, stakeValue?: bigint) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.submitWork(bountyId, fileUri, thumbnailUri, {
                value: stakeValue || BigInt(0),
            });
            return tx.wait();
        },

        // Admin Write functions
        createBounty: async (
            title: string,
            description: string,
            rewardToken: string,
            rewardAmount: bigint,
            stakeRequired: bigint,
            stakeToken: string,
            deadline: bigint
        ) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.createBounty(
                title,
                description,
                rewardToken,
                rewardAmount,
                stakeRequired,
                stakeToken,
                deadline
            );
            return tx.wait();
        },

        fundBounty: async (bountyId: number) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.fundBounty(bountyId);
            return tx.wait();
        },

        startJudging: async (bountyId: number) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.startJudging(bountyId);
            return tx.wait();
        },

        cancelBounty: async (bountyId: number) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.cancelBounty(bountyId);
            return tx.wait();
        },

        // Judge Write functions
        selectWinner: async (bountyId: number, submissionId: number) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.selectWinner(bountyId, submissionId);
            return tx.wait();
        },

        rejectSubmission: async (submissionId: number, slashStake: boolean) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.rejectSubmission(submissionId, slashStake);
            return tx.wait();
        },

        refundAllStakes: async (bountyId: number) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.refundAllStakes(bountyId);
            return tx.wait();
        },
    }), [contract, address]);
}

// Contributor Vault Hook
export function useContributorVault() {
    const contract = useContract(CONTRACTS_CONFIG.CONTRIBUTOR_VAULT, CONTRIBUTOR_VAULT_ABI);
    const { address } = useWallet();

    return useMemo(() => ({
        contract,

        // Read functions
        getLockedBalance: async () => {
            if (!contract || !address) return BigInt(0);
            return contract.getLockedBalance(address);
        },

        getClaimableAmount: async () => {
            if (!contract || !address) return BigInt(0);
            return contract.getClaimableAmount(address);
        },

        getContributorStats: async () => {
            if (!contract || !address) return null;
            const stats = await contract.contributorStats(address);
            return {
                totalEarned: stats.totalEarned,
                totalClaimed: stats.totalClaimed,
                lockedBalance: stats.lockedBalance,
            };
        },

        // Write functions
        claimLockedTokens: async () => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.claimLockedTokens();
            return tx.wait();
        },

        earlyUnlock: async () => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.earlyUnlock();
            return tx.wait();
        },
    }), [contract, address]);
}

// Governance Module Hook
export function useGovernanceModule() {
    const contract = useContract(CONTRACTS_CONFIG.GOVERNANCE_MODULE, GOVERNANCE_MODULE_ABI);
    const { address } = useWallet();

    return useMemo(() => ({
        contract,

        // Read functions
        getProposalCount: async () => {
            if (!contract) return 0;
            return contract.proposalCount();
        },

        getProposal: async (proposalId: number) => {
            if (!contract) return null;
            return contract.proposals(proposalId);
        },

        getContributionPoints: async () => {
            if (!contract || !address) return BigInt(0);
            return contract.contributionPoints(address);
        },

        hasVoted: async (proposalId: number) => {
            if (!contract || !address) return false;
            return contract.hasVoted(proposalId, address);
        },

        // Write functions
        vote: async (proposalId: number, support: boolean) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.vote(proposalId, support);
            return tx.wait();
        },

        executeProposal: async (proposalId: number) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.executeProposal(proposalId);
            return tx.wait();
        },
    }), [contract, address]);
}

// Fixed Price Swap Hook
export function useFixedPriceSwap() {
    const contract = useContract(CONTRACTS_CONFIG.FIXED_PRICE_SWAP, FIXED_PRICE_SWAP_ABI);
    const { address } = useWallet();

    return useMemo(() => ({
        contract,

        // Read functions
        getSaleStats: async () => {
            if (!contract) return null;
            return contract.getSaleStats();
        },

        getTotalPurchased: async () => {
            if (!contract || !address) return BigInt(0);
            return contract.totalPurchased(address);
        },

        getRemainingLimit: async () => {
            if (!contract || !address) return BigInt(0);
            return contract.getRemainingLimit(address);
        },

        canBuy: async () => {
            if (!contract || !address) return { allowed: false, reason: 'Not connected' };
            return contract.canBuy(address);
        },

        isAdmin: async () => {
            if (!contract || !address) return false;
            try {
                const adminRole = await contract.SALE_ADMIN();
                return contract.hasRole(adminRole, address);
            } catch {
                return false;
            }
        },

        // User Write functions
        buyTokens: async (maticAmount: bigint) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.buyTokens({ value: maticAmount });
            return tx.wait();
        },

        // Admin Write functions
        setPrice: async (newPrice: bigint) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.setPrice(newPrice);
            return tx.wait();
        },

        setSaleActive: async (active: boolean) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.setSaleActive(active);
            return tx.wait();
        },

        depositTokens: async (amount: bigint) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.depositTokens(amount);
            return tx.wait();
        },

        withdrawFunds: async (to: string, amount: bigint) => {
            if (!contract) throw new Error('Contract not available');
            const tx = await contract.withdrawFunds(to, amount);
            return tx.wait();
        },
    }), [contract, address]);
}
