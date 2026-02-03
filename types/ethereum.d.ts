// Type declarations for Ethereum provider (MetaMask)
interface WatchAssetParams {
    type: 'ERC20';
    options: {
        address: string;
        symbol: string;
        decimals: number;
        image?: string;
    };
}

interface EthereumProvider {
    request: (args: {
        method: string;
        params?: unknown[] | WatchAssetParams | Record<string, unknown>;
    }) => Promise<unknown>;
    on?: (event: string, callback: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
    isMetaMask?: boolean;
    selectedAddress?: string | null;
    chainId?: string;
}

declare global {
    interface Window {
        ethereum?: EthereumProvider;
    }
}

export { };
