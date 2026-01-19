'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Wallet, ExternalLink, Gift, Shield, Zap } from 'lucide-react';

declare global {
    interface Window {
        ethereum?: {
            isMetaMask?: boolean;
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            on: (event: string, callback: (params: unknown) => void) => void;
            removeListener: (event: string, callback: (params: unknown) => void) => void;
        };
    }
}

interface ClaimStatus {
    address: string;
    claimed: boolean;
    nonce: number;
    airdropAmount: string;
    chainId: number;
    chainName: string;
}

interface ClaimResult {
    success: boolean;
    message: string;
    txHash: string;
    amount: string;
    explorerUrl: string;
}

const EIP712_DOMAIN = {
    name: 'PINN44 Airdrop',
    version: '1',
    chainId: 137, // Polygon
};

const CLAIM_TYPES = {
    Claim: [
        { name: 'recipient', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'message', type: 'string' },
    ],
};

const CLAIM_MESSAGE = 'I am claiming my PINN44 airdrop tokens. This signature proves I own this wallet.';

const POLYGON_CHAIN_ID = '0x89'; // 137 in hex

export function AirdropClaim() {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [claimStatus, setClaimStatus] = useState<ClaimStatus | null>(null);
    const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [chainId, setChainId] = useState<string | null>(null);

    // Check if wallet is on Polygon network
    const isOnPolygon = chainId === POLYGON_CHAIN_ID;

    // Fetch claim status for connected wallet
    const fetchClaimStatus = useCallback(async (address: string) => {
        try {
            const response = await fetch(`/api/airdrop/claim?address=${address}`);
            const data = await response.json();
            if (response.ok) {
                setClaimStatus(data);
            }
        } catch (err) {
            console.error('Failed to fetch claim status:', err);
        }
    }, []);

    // Handle account changes
    useEffect(() => {
        if (!window.ethereum) return;

        const handleAccountsChanged = (accounts: unknown) => {
            const accountsArr = accounts as string[];
            if (accountsArr.length === 0) {
                setWalletAddress(null);
                setClaimStatus(null);
                setClaimResult(null);
            } else {
                setWalletAddress(accountsArr[0]);
                setClaimResult(null);
                setError(null);
                fetchClaimStatus(accountsArr[0]);
            }
        };

        const handleChainChanged = (newChainId: unknown) => {
            setChainId(newChainId as string);
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        // Check if already connected
        window.ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
            const accountsArr = accounts as string[];
            if (accountsArr.length > 0) {
                setWalletAddress(accountsArr[0]);
                fetchClaimStatus(accountsArr[0]);
            }
        });

        // Get current chain
        window.ethereum.request({ method: 'eth_chainId' }).then((id) => {
            setChainId(id as string);
        });

        return () => {
            window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum?.removeListener('chainChanged', handleChainChanged);
        };
    }, [fetchClaimStatus]);

    // Connect wallet
    const connectWallet = async () => {
        if (!window.ethereum) {
            setError('Please install MetaMask or another Web3 wallet');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts',
            }) as string[];

            if (accounts.length > 0) {
                setWalletAddress(accounts[0]);
                fetchClaimStatus(accounts[0]);
            }
        } catch (err) {
            console.error('Failed to connect wallet:', err);
            setError('Failed to connect wallet. Please try again.');
        } finally {
            setIsConnecting(false);
        }
    };

    // Switch to Polygon network
    const switchToPolygon = async () => {
        if (!window.ethereum) return;

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: POLYGON_CHAIN_ID }],
            });
        } catch (switchError: unknown) {
            // Chain not added, try to add it
            const err = switchError as { code?: number };
            if (err.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: POLYGON_CHAIN_ID,
                                chainName: 'Polygon Mainnet',
                                nativeCurrency: {
                                    name: 'MATIC',
                                    symbol: 'MATIC',
                                    decimals: 18,
                                },
                                rpcUrls: ['https://polygon-rpc.com'],
                                blockExplorerUrls: ['https://polygonscan.com'],
                            },
                        ],
                    });
                } catch (addError) {
                    console.error('Failed to add Polygon network:', addError);
                    setError('Failed to add Polygon network to wallet');
                }
            }
        }
    };

    // Claim airdrop
    const claimAirdrop = async () => {
        if (!window.ethereum || !walletAddress || !claimStatus) return;

        setIsClaiming(true);
        setError(null);

        try {
            // Request signature - domain must match backend exactly
            const domain = {
                ...EIP712_DOMAIN,
            };

            const claimData = {
                recipient: walletAddress,
                nonce: claimStatus.nonce,
                message: CLAIM_MESSAGE,
            };

            // Create EIP-712 typed data
            const msgParams = JSON.stringify({
                types: {
                    EIP712Domain: [
                        { name: 'name', type: 'string' },
                        { name: 'version', type: 'string' },
                        { name: 'chainId', type: 'uint256' },
                    ],
                    ...CLAIM_TYPES,
                },
                primaryType: 'Claim',
                domain,
                message: claimData,
            });

            // Request signature from wallet
            const signature = await window.ethereum.request({
                method: 'eth_signTypedData_v4',
                params: [walletAddress, msgParams],
            }) as string;

            // Submit claim to backend
            const response = await fetch('/api/airdrop/claim', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    address: walletAddress,
                    signature,
                    nonce: claimStatus.nonce,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to claim airdrop');
            }

            setClaimResult(result);
            setClaimStatus((prev) => prev ? { ...prev, claimed: true } : null);
        } catch (err) {
            console.error('Claim failed:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to claim airdrop';
            setError(errorMessage);
        } finally {
            setIsClaiming(false);
        }
    };

    // Format address for display
    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <section className="py-20 px-4 bg-gradient-to-b from-background via-card to-background">
            <div className="max-w-lg mx-auto">
                {/* Main Card */}
                <Card className="bg-card/80 backdrop-blur-xl border-primary/30 shadow-2xl shadow-primary/10">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto mb-4 w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 animate-pulse">
                            <Gift className="w-10 h-10 text-primary-foreground" />
                        </div>
                        <CardTitle className="text-3xl font-bold text-primary font-serif">PINN44 Airdrop</CardTitle>
                        <CardDescription className="text-muted-foreground text-lg">
                            Claim your free 100 PINN44 tokens!
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Features */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted/50 rounded-lg p-3 border border-border">
                                <Zap className="w-4 h-4 text-accent" />
                                <span>Gasless Claim</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted/50 rounded-lg p-3 border border-border">
                                <Shield className="w-4 h-4 text-chart-5" />
                                <span>Secure & Verified</span>
                            </div>
                        </div>

                        {/* Error Alert */}
                        {error && (
                            <Alert variant="destructive" className="bg-destructive/20 border-destructive/50 text-destructive-foreground">
                                <XCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {/* Success Alert */}
                        {claimResult && (
                            <Alert className="bg-chart-5/20 border-chart-5/50 text-foreground">
                                <CheckCircle2 className="h-4 w-4 text-chart-5" />
                                <AlertTitle className="text-chart-5">Success!</AlertTitle>
                                <AlertDescription className="space-y-2">
                                    <p>You&apos;ve received {claimResult.amount} PINN44 tokens!</p>
                                    <a
                                        href={claimResult.explorerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-primary hover:text-accent underline transition-colors"
                                    >
                                        View on PolygonScan
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Already Claimed */}
                        {claimStatus?.claimed && !claimResult && (
                            <Alert className="bg-accent/20 border-accent/50 text-foreground">
                                <CheckCircle2 className="h-4 w-4 text-accent" />
                                <AlertTitle className="text-accent">Already Claimed</AlertTitle>
                                <AlertDescription>
                                    This wallet has already claimed the airdrop.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Wallet Connection Status */}
                        {walletAddress && (
                            <div className="bg-muted/30 rounded-lg p-4 border border-border">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-sm">Connected Wallet</span>
                                    <span className="text-primary font-mono text-sm">{formatAddress(walletAddress)}</span>
                                </div>
                                {!isOnPolygon && (
                                    <div className="mt-3">
                                        <Button
                                            onClick={switchToPolygon}
                                            variant="outline"
                                            className="w-full bg-secondary/20 border-secondary/50 text-secondary hover:bg-secondary/30 hover:text-secondary-foreground transition-all"
                                        >
                                            Switch to Polygon Network
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Action Button */}
                        {!walletAddress ? (
                            <Button
                                onClick={connectWallet}
                                disabled={isConnecting}
                                className="w-full h-14 text-lg bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-primary-foreground border-0 shadow-lg shadow-primary/30 transition-all duration-300 hover:shadow-primary/50 hover:scale-[1.02]"
                            >
                                {isConnecting ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <Wallet className="mr-2 h-5 w-5" />
                                        Connect Wallet
                                    </>
                                )}
                            </Button>
                        ) : !isOnPolygon ? null : claimStatus?.claimed ? (
                            <Button disabled className="w-full h-14 text-lg bg-muted border-border">
                                <CheckCircle2 className="mr-2 h-5 w-5" />
                                Already Claimed
                            </Button>
                        ) : (
                            <Button
                                onClick={claimAirdrop}
                                disabled={isClaiming}
                                className="w-full h-14 text-lg bg-gradient-to-r from-chart-5 to-accent hover:from-chart-5/80 hover:to-accent/80 text-accent-foreground border-0 shadow-lg shadow-chart-5/30 transition-all duration-300 hover:shadow-chart-5/50 hover:scale-[1.02]"
                            >
                                {isClaiming ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Processing Claim...
                                    </>
                                ) : (
                                    <>
                                        <Gift className="mr-2 h-5 w-5" />
                                        Claim 100 PINN44 Tokens
                                    </>
                                )}
                            </Button>
                        )}

                        {/* Network Info */}
                        <p className="text-center text-muted-foreground text-xs">
                            This airdrop is on <span className="text-secondary">Polygon Network (MATIC)</span>
                        </p>
                    </CardContent>
                </Card>

                {/* Additional Info */}
                <div className="mt-8 text-center">
                    <p className="text-muted-foreground text-sm">
                        Part of <span className="text-primary font-serif">The Big Picture</span> ecosystem
                    </p>
                </div>
            </div>
        </section>
    );
}
