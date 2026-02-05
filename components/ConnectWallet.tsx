"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, CheckCircle, AlertCircle } from 'lucide-react';

interface ConnectWalletProps {
    onConnect?: (address: string) => void;
    className?: string;
}

export function ConnectWalletBanner({ onConnect, className = '' }: ConnectWalletProps) {
    const [address, setAddress] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if already connected
    useEffect(() => {
        const checkConnection = async () => {
            if (typeof window !== 'undefined' && window.ethereum) {
                try {
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    if (accounts && accounts.length > 0) {
                        setAddress(accounts[0]);
                        onConnect?.(accounts[0]);
                    }
                } catch (err) {
                    console.error('Error checking wallet connection:', err);
                }
            }
        };
        checkConnection();

        // Listen for account changes
        if (typeof window !== 'undefined' && window.ethereum) {
            window.ethereum.on?.('accountsChanged', (accounts: string[]) => {
                if (accounts.length > 0) {
                    setAddress(accounts[0]);
                    onConnect?.(accounts[0]);
                } else {
                    setAddress(null);
                }
            });
        }
    }, [onConnect]);

    const connectWallet = async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
            setError('MetaMask not installed. Please install MetaMask to continue.');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts && accounts.length > 0) {
                setAddress(accounts[0]);
                onConnect?.(accounts[0]);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to connect wallet';
            if (message.includes('User rejected')) {
                setError('Connection rejected. Please try again.');
            } else {
                setError(message);
            }
        } finally {
            setIsConnecting(false);
        }
    };

    // If already connected, don't show banner
    if (address) {
        return null;
    }

    return (
        <div className={`w-full bg-gradient-to-r from-orange-600/20 to-yellow-600/20 border border-orange-500/30 rounded-lg p-4 mb-6 ${className}`}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/20 rounded-full">
                        <Wallet className="w-6 h-6 text-orange-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Connect Your Wallet</h3>
                        <p className="text-sm text-gray-400">Connect MetaMask to access this feature</p>
                    </div>
                </div>

                <Button
                    onClick={connectWallet}
                    disabled={isConnecting}
                    className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold px-6"
                >
                    {isConnecting ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            Connecting...
                        </>
                    ) : (
                        <>
                            <Wallet className="w-4 h-4 mr-2" />
                            Connect MetaMask
                        </>
                    )}
                </Button>
            </div>

            {error && (
                <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}
        </div>
    );
}

// Compact version for header or other places
export function ConnectWalletButton({ onConnect, className = '' }: ConnectWalletProps) {
    const [address, setAddress] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        const checkConnection = async () => {
            if (typeof window !== 'undefined' && window.ethereum) {
                try {
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    if (accounts && accounts.length > 0) {
                        setAddress(accounts[0]);
                        onConnect?.(accounts[0]);
                    }
                } catch (err) {
                    console.error('Error checking wallet connection:', err);
                }
            }
        };
        checkConnection();

        if (typeof window !== 'undefined' && window.ethereum) {
            window.ethereum.on?.('accountsChanged', (accounts: string[]) => {
                if (accounts.length > 0) {
                    setAddress(accounts[0]);
                    onConnect?.(accounts[0]);
                } else {
                    setAddress(null);
                }
            });
        }
    }, [onConnect]);

    const connectWallet = async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
            alert('MetaMask not installed. Please install MetaMask to continue.');
            return;
        }

        setIsConnecting(true);
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts && accounts.length > 0) {
                setAddress(accounts[0]);
                onConnect?.(accounts[0]);
            }
        } catch (err) {
            console.error('Failed to connect:', err);
        } finally {
            setIsConnecting(false);
        }
    };

    if (address) {
        return (
            <div className={`flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full text-sm ${className}`}>
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-medium">
                    {address.slice(0, 6)}...{address.slice(-4)}
                </span>
            </div>
        );
    }

    return (
        <Button
            onClick={connectWallet}
            disabled={isConnecting}
            size="sm"
            className={`bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold ${className}`}
        >
            {isConnecting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <>
                    <Wallet className="w-4 h-4 mr-1" />
                    Connect
                </>
            )}
        </Button>
    );
}
