'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/hooks/useWallet';
import { useFixedPriceSwap, usePINN44Token } from '@/hooks/useContracts';
import { CONTRACTS_CONFIG, getExplorerTxUrl, PINN44_TOKEN_ABI } from '@/lib/contracts';
import { ConnectWalletBanner } from '@/components/ConnectWallet';

interface SaleStats {
    totalTokensSold: bigint;
    totalFundsRaised: bigint;
    availableTokens: bigint;
    currentPrice: bigint;
    isActive: boolean;
}

export default function FixedPriceSwapComponent() {
    const { address, isConnected, isCorrectNetwork, signer } = useWallet();
    const swap = useFixedPriceSwap();
    const token = usePINN44Token();

    // State
    const [usdcAmount, setUsdcAmount] = useState('');
    const [tokenPreview, setTokenPreview] = useState<bigint>(BigInt(0));
    const [stats, setStats] = useState<SaleStats | null>(null);
    const [userPurchased, setUserPurchased] = useState<bigint>(BigInt(0));
    const [remainingLimit, setRemainingLimit] = useState<bigint>(BigInt(0));
    const [userTokenBalance, setUserTokenBalance] = useState<bigint>(BigInt(0));
    const [userUsdcBalance, setUserUsdcBalance] = useState<bigint>(BigInt(0));
    const [usdcAllowance, setUsdcAllowance] = useState<bigint>(BigInt(0));
    const [canBuyStatus, setCanBuyStatus] = useState<{ allowed: boolean; reason: string }>({ allowed: false, reason: '' });

    const [loading, setLoading] = useState(false);
    const [txHash, setTxHash] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Admin state
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminPrice, setAdminPrice] = useState('');
    const [adminDepositAmount, setAdminDepositAmount] = useState('');
    const [adminWithdrawAmount, setAdminWithdrawAmount] = useState('');
    const [paymentTokenAddress, setPaymentTokenAddress] = useState('');

    // Load data
    const loadData = useCallback(async () => {
        if (!swap.contract || !signer) return;

        try {
            const saleStats = await swap.getSaleStats();
            if (saleStats) {
                setStats({
                    totalTokensSold: saleStats.totalTokensSold,
                    totalFundsRaised: saleStats.totalFundsRaised,
                    availableTokens: saleStats.availableTokens,
                    currentPrice: saleStats.currentPrice,
                    isActive: saleStats.isActive,
                });
            }

            // Get payment token address (USDC)
            const paymentToken = await swap.contract.paymentToken();
            setPaymentTokenAddress(paymentToken);

            if (address) {
                const purchased = await swap.getTotalPurchased();
                setUserPurchased(purchased);

                const limit = await swap.getRemainingLimit();
                setRemainingLimit(limit);

                const canBuy = await swap.canBuy();
                setCanBuyStatus(canBuy);

                // User balances
                const tokenBal = await token.getBalance();
                setUserTokenBalance(tokenBal);

                // USDC balance & allowance
                const usdcContract = new ethers.Contract(paymentToken, PINN44_TOKEN_ABI, signer);
                const usdcBal = await usdcContract.balanceOf(address);
                setUserUsdcBalance(usdcBal);

                const allowance = await usdcContract.allowance(address, await swap.getAddress());
                setUsdcAllowance(allowance);

                const admin = await swap.isAdmin();
                setIsAdmin(admin);
            }
        } catch (err) {
            console.error('Error loading swap data:', err);
        }
    }, [swap, token, address, signer]);

    useEffect(() => {
        if (isConnected && isCorrectNetwork) {
            loadData();
            const interval = setInterval(loadData, 15000);
            return () => clearInterval(interval);
        }
    }, [isConnected, isCorrectNetwork, loadData]);

    // Update token preview when amount changes
    useEffect(() => {
        if (!usdcAmount || !stats?.currentPrice) {
            setTokenPreview(BigInt(0));
            return;
        }
        try {
            const usdcWei = ethers.parseUnits(usdcAmount, 6); // USDC has 6 decimals
            // Formula: (usdc * price) / 10^6
            const tokens = (usdcWei * stats.currentPrice) / BigInt(1e6);
            setTokenPreview(tokens);
        } catch {
            setTokenPreview(BigInt(0));
        }
    }, [usdcAmount, stats?.currentPrice]);

    // Approve USDC
    const handleApprove = async () => {
        if (!usdcAmount || !paymentTokenAddress || !signer) return;
        setLoading(true);
        setError('');
        try {
            const usdcContract = new ethers.Contract(paymentTokenAddress, PINN44_TOKEN_ABI, signer);
            const amount = ethers.parseUnits(usdcAmount, 6);
            const tx = await usdcContract.approve(await swap.getAddress(), amount);
            await tx.wait();
            setSuccess('USDC Approved! You can now buy.');
            await loadData();
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Approval failed');
        } finally {
            setLoading(false);
        }
    };

    // Buy tokens
    const handleBuy = async () => {
        if (!swap.contract || !usdcAmount) return;

        setLoading(true);
        setError('');
        setSuccess('');
        setTxHash('');

        try {
            // Check allowance again
            const amount = ethers.parseUnits(usdcAmount, 6);
            if (usdcAllowance < amount) {
                setError('Insufficient allowance. Please approve USDC first.');
                setLoading(false);
                return;
            }

            const receipt = await swap.buyTokens(amount);
            setTxHash(receipt.hash);
            setSuccess(`Successfully bought ${formatTokens(tokenPreview)} PINN44!`);
            setUsdcAmount('');
            await loadData();
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Transaction failed');
        } finally {
            setLoading(false);
        }
    };

    // Admin: Set price
    const handleSetPrice = async () => {
        if (!swap.contract || !adminPrice) return;
        setLoading(true);
        setError('');
        try {
            // Price is PINN44 per 1 USDC (1e18 scale)
            await swap.setPrice(ethers.parseEther(adminPrice));
            setSuccess('Price updated!');
            setAdminPrice('');
            await loadData();
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Failed to set price');
        } finally {
            setLoading(false);
        }
    };

    // Admin: Toggle sale
    const handleToggleSale = async () => {
        if (!swap.contract) return;
        setLoading(true);
        setError('');
        try {
            await swap.setSaleActive(!stats?.isActive);
            setSuccess(stats?.isActive ? 'Sale paused' : 'Sale activated!');
            await loadData();
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Failed to toggle sale');
        } finally {
            setLoading(false);
        }
    };

    // Admin: Deposit tokens
    const handleDeposit = async () => {
        if (!swap.contract || !adminDepositAmount) return;
        setLoading(true);
        setError('');
        try {
            const amount = ethers.parseEther(adminDepositAmount);
            // Approve first
            await token.approve(CONTRACTS_CONFIG.FIXED_PRICE_SWAP, amount);
            // Then deposit
            await swap.depositTokens(amount);
            setSuccess(`Deposited ${adminDepositAmount} PINN44 for sale`);
            setAdminDepositAmount('');
            await loadData();
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Deposit failed');
        } finally {
            setLoading(false);
        }
    };

    // Admin: Withdraw USDC
    const handleWithdrawFunds = async () => {
        if (!swap.contract || !adminWithdrawAmount || !address) return;
        setLoading(true);
        setError('');
        try {
            await swap.withdrawFunds(address, ethers.parseUnits(adminWithdrawAmount, 6));
            setSuccess(`Withdrew ${adminWithdrawAmount} USDC`);
            setAdminWithdrawAmount('');
            await loadData();
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Withdrawal failed');
        } finally {
            setLoading(false);
        }
    };

    const formatTokens = (value: bigint) => {
        return parseFloat(ethers.formatEther(value)).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
    };

    const formatUsdc = (value: bigint) => {
        return parseFloat(ethers.formatUnits(value, 6)).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
    };

    if (!isConnected || !isCorrectNetwork) {
        return <ConnectWalletBanner />;
    }

    const needsApproval = usdcAmount && usdcAllowance < ethers.parseUnits(usdcAmount || '0', 6);

    return (
        <div className="space-y-6">
            {/* Sale Status */}
            <Card className="bg-[#1a1a2e]/80 border-[#8247E5]/20 backdrop-blur-lg">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl text-foreground">
                            Token Sale
                        </CardTitle>
                        {stats && (
                            <Badge
                                className={
                                    stats.isActive
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                        : stats.availableTokens === BigInt(0)
                                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                            : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                }
                            >
                                {stats.isActive
                                    ? '● Live'
                                    : stats.availableTokens === BigInt(0)
                                        ? 'Sold Out'
                                        : 'Paused'}
                            </Badge>
                        )}
                    </div>
                    <CardDescription className="text-foreground/50">
                        Buy PINN44 tokens with USDC at a fixed price
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 rounded-lg bg-[#8247E5]/10 border border-[#8247E5]/20">
                                <p className="text-xs text-foreground/40 mb-1">Price</p>
                                <p className="text-lg font-bold text-[#FFD700]">
                                    {formatTokens(stats.currentPrice)} <span className="text-xs font-normal text-foreground/40">PINN / USDC</span>
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-[#8247E5]/10 border border-[#8247E5]/20">
                                <p className="text-xs text-foreground/40 mb-1">Available</p>
                                <p className="text-lg font-bold text-foreground">
                                    {formatTokens(stats.availableTokens)}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-[#8247E5]/10 border border-[#8247E5]/20">
                                <p className="text-xs text-foreground/40 mb-1">Total Sold</p>
                                <p className="text-lg font-bold text-foreground">
                                    {formatTokens(stats.totalTokensSold)}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-[#8247E5]/10 border border-[#8247E5]/20">
                                <p className="text-xs text-foreground/40 mb-1">USDC Raised</p>
                                <p className="text-lg font-bold text-foreground">
                                    {formatUsdc(stats.totalFundsRaised)}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Buy Panel */}
            <Card className="bg-[#1a1a2e]/80 border-[#FFD700]/20 backdrop-blur-lg">
                <CardHeader>
                    <CardTitle className="text-lg text-[#FFD700]">Buy PINN44</CardTitle>
                    <CardDescription className="text-foreground/50">
                        Balance: {formatTokens(userTokenBalance)} PINN44 · {formatUsdc(userUsdcBalance)} USDC
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-foreground/70">You Pay (USDC)</Label>
                        <Input
                            type="number"
                            placeholder="0.0"
                            value={usdcAmount}
                            onChange={(e) => setUsdcAmount(e.target.value)}
                            className="bg-[#121212] border-[#8247E5]/30 text-foreground text-lg"
                            step="0.01"
                            min="0"
                        />
                    </div>

                    <div className="flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-[#8247E5]/20 flex items-center justify-center">
                            <span className="text-[#8247E5]">↓</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-foreground/70">You Receive (PINN44)</Label>
                        <div className="p-3 rounded-lg bg-[#121212] border border-[#FFD700]/20 text-lg font-bold text-[#FFD700]">
                            {formatTokens(tokenPreview)} PINN44
                        </div>
                    </div>

                    {remainingLimit < BigInt("57896044618658097711785492504343953926634992332820282019728792003956564819968") && (
                        <p className="text-xs text-foreground/40">
                            Remaining wallet limit: {formatTokens(remainingLimit)} PINN44
                        </p>
                    )}

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                            {success}
                            {txHash && (
                                <a
                                    href={getExplorerTxUrl(txHash)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block mt-1 text-[#8247E5] hover:underline text-xs"
                                >
                                    View transaction ↗
                                </a>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2">
                        {needsApproval ? (
                            <Button
                                onClick={handleApprove}
                                disabled={loading || !usdcAmount}
                                className="w-full btn-purple py-4 text-base font-semibold rounded-lg cursor-pointer"
                            >
                                {loading ? 'Approving...' : 'Approve USDC'}
                            </Button>
                        ) : (
                            <Button
                                onClick={handleBuy}
                                disabled={loading || !usdcAmount || tokenPreview === BigInt(0) || !canBuyStatus.allowed}
                                className="w-full btn-gold py-4 text-base font-semibold rounded-lg cursor-pointer"
                            >
                                {loading ? 'Processing...' : !canBuyStatus.allowed ? canBuyStatus.reason : 'Buy PINN44'}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Admin Panel */}
            {isAdmin && (
                <Card className="bg-[#1a1a2e]/80 border-red-500/20 backdrop-blur-lg">
                    <CardHeader>
                        <CardTitle className="text-lg text-red-400">⚙️ Admin Panel</CardTitle>
                        <CardDescription className="text-foreground/50">
                            Sale management controls
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Toggle Sale */}
                        <div>
                            <Button
                                onClick={handleToggleSale}
                                disabled={loading}
                                className={`w-full py-3 rounded-lg font-semibold cursor-pointer ${stats?.isActive
                                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                                    }`}
                            >
                                {stats?.isActive ? '⏸ Pause Sale' : '▶ Activate Sale'}
                            </Button>
                        </div>

                        {/* Set Price */}
                        <div className="space-y-2">
                            <Label className="text-foreground/70">Set Price (PINN44 per USDC)</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="e.g. 100"
                                    value={adminPrice}
                                    onChange={(e) => setAdminPrice(e.target.value)}
                                    className="bg-[#121212] border-[#8247E5]/30 text-foreground"
                                />
                                <Button onClick={handleSetPrice} disabled={loading || !adminPrice} className="btn-purple cursor-pointer">
                                    Set
                                </Button>
                            </div>
                        </div>

                        {/* Deposit Tokens */}
                        <div className="space-y-2">
                            <Label className="text-foreground/70">Deposit PINN44 for Sale</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="Amount"
                                    value={adminDepositAmount}
                                    onChange={(e) => setAdminDepositAmount(e.target.value)}
                                    className="bg-[#121212] border-[#8247E5]/30 text-foreground"
                                />
                                <Button onClick={handleDeposit} disabled={loading || !adminDepositAmount} className="btn-purple cursor-pointer">
                                    Deposit
                                </Button>
                            </div>
                        </div>

                        {/* Withdraw USDC */}
                        <div className="space-y-2">
                            <Label className="text-foreground/70">Withdraw USDC</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="USDC amount"
                                    value={adminWithdrawAmount}
                                    onChange={(e) => setAdminWithdrawAmount(e.target.value)}
                                    className="bg-[#121212] border-[#8247E5]/30 text-foreground"
                                />
                                <Button onClick={handleWithdrawFunds} disabled={loading || !adminWithdrawAmount} className="btn-purple cursor-pointer">
                                    Withdraw
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
