'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers, BrowserProvider, JsonRpcSigner } from 'ethers';
import { POLYGON_CHAIN, CONTRACTS_CONFIG } from '@/lib/contracts';

declare global {
    interface Window {
        ethereum?: {
            isMetaMask?: boolean;
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            on: (event: string, callback: (...args: unknown[]) => void) => void;
            removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
        };
    }
}

export interface WalletState {
    address: string | null;
    chainId: number | null;
    isConnected: boolean;
    isConnecting: boolean;
    isCorrectNetwork: boolean;
    provider: BrowserProvider | null;
    signer: JsonRpcSigner | null;
    error: string | null;
}

const initialState: WalletState = {
    address: null,
    chainId: null,
    isConnected: false,
    isConnecting: false,
    isCorrectNetwork: false,
    provider: null,
    signer: null,
    error: null,
};

export function useWallet() {
    const [state, setState] = useState<WalletState>(initialState);

    // Check if MetaMask is available
    const isMetaMaskAvailable = typeof window !== 'undefined' && !!window.ethereum?.isMetaMask;

    // Update connection state
    const updateConnectionState = useCallback(async () => {
        if (!window.ethereum) return;

        try {
            const provider = new BrowserProvider(window.ethereum);
            const accounts = await provider.listAccounts();

            if (accounts.length > 0) {
                const signer = await provider.getSigner();
                const address = await signer.getAddress();
                const network = await provider.getNetwork();
                const chainId = Number(network.chainId);

                setState({
                    address,
                    chainId,
                    isConnected: true,
                    isConnecting: false,
                    isCorrectNetwork: chainId === CONTRACTS_CONFIG.CHAIN_ID,
                    provider,
                    signer,
                    error: null,
                });
            } else {
                setState(prev => ({
                    ...initialState,
                    error: prev.error,
                }));
            }
        } catch (error) {
            console.error('Failed to update connection state:', error);
        }
    }, []);

    // Connect wallet
    const connect = useCallback(async () => {
        if (!window.ethereum) {
            setState(prev => ({
                ...prev,
                error: 'MetaMask is not installed. Please install MetaMask to continue.',
            }));
            return false;
        }

        setState(prev => ({ ...prev, isConnecting: true, error: null }));

        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            await updateConnectionState();
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to connect wallet';
            setState(prev => ({
                ...prev,
                isConnecting: false,
                error: message,
            }));
            return false;
        }
    }, [updateConnectionState]);

    // Disconnect (clear state)
    const disconnect = useCallback(() => {
        setState(initialState);
    }, []);

    // Switch to Polygon network
    const switchToPolygon = useCallback(async () => {
        if (!window.ethereum) return false;

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: POLYGON_CHAIN.chainId }],
            });
            await updateConnectionState();
            return true;
        } catch (switchError: unknown) {
            // Chain not added, try to add it
            if ((switchError as { code?: number })?.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [POLYGON_CHAIN],
                    });
                    await updateConnectionState();
                    return true;
                } catch (addError) {
                    console.error('Failed to add Polygon network:', addError);
                    return false;
                }
            }
            console.error('Failed to switch network:', switchError);
            return false;
        }
    }, [updateConnectionState]);

    // Format address for display
    const formatAddress = useCallback((address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }, []);

    // Listen for account and chain changes
    useEffect(() => {
        if (!window.ethereum) return;

        const handleAccountsChanged = (accounts: unknown) => {
            if (Array.isArray(accounts) && accounts.length === 0) {
                disconnect();
            } else {
                updateConnectionState();
            }
        };

        const handleChainChanged = () => {
            updateConnectionState();
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        // Check initial connection
        updateConnectionState();

        return () => {
            window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum?.removeListener('chainChanged', handleChainChanged);
        };
    }, [updateConnectionState, disconnect]);

    return {
        ...state,
        isMetaMaskAvailable,
        connect,
        disconnect,
        switchToPolygon,
        formatAddress,
    };
}
