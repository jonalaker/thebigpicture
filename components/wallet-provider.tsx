"use client"

/**
 * WalletProvider — wraps children with wagmi + React Query providers
 * 
 * This enables wallet connection (MetaMask, Coinbase Wallet) throughout
 * the app for x402 micropayments.
 */
import { WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { wagmiConfig } from "@/lib/wagmi-config"
import { useState, type ReactNode } from "react"

export default function WalletProvider({ children }: { children: ReactNode }) {
    // Create a stable QueryClient per component instance
    const [queryClient] = useState(() => new QueryClient())

    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}
