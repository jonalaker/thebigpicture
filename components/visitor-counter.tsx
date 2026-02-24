"use client"

import { useState, useEffect, useCallback } from "react"

export default function VisitorCounter() {
    const [count, setCount] = useState<number | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [recorded, setRecorded] = useState(false)
    const [serverAdminWallet, setServerAdminWallet] = useState<string>("")

    // Record the visit on mount (runs for everyone, but counter is only shown to admin)
    useEffect(() => {
        if (recorded) return
        setRecorded(true)

        fetch("/api/visitors", { method: "POST" })
            .then((res) => res.json())
            .then((data) => {
                setCount(data.count)
                if (data.adminAddress) {
                    setServerAdminWallet(data.adminAddress)
                }
            })
            .catch(() => { })
    }, [recorded])

    // Check wallet connection for admin status
    const checkAdmin = useCallback(async () => {
        if (!serverAdminWallet) return
        try {
            const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum
            if (!ethereum) return

            const accounts = await ethereum.request({ method: "eth_accounts" })
            if (accounts.length > 0 && accounts[0].toLowerCase() === serverAdminWallet) {
                setIsAdmin(true)
            } else {
                setIsAdmin(false)
            }
        } catch {
            setIsAdmin(false)
        }
    }, [serverAdminWallet])

    useEffect(() => {
        checkAdmin()

        // Listen for wallet changes
        const ethereum = (window as unknown as { ethereum?: { on?: (event: string, handler: () => void) => void } }).ethereum
        if (ethereum?.on) {
            ethereum.on("accountsChanged", checkAdmin)
        }
    }, [checkAdmin])

    // Only render for admin
    if (!isAdmin || count === null) return null

    return (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1a1a2e]/90 border border-[#8247E5]/30 shadow-[0_0_20px_rgba(130,71,229,0.2)] backdrop-blur-md text-sm select-none pointer-events-none">
            <span className="text-[#8247E5] font-bold text-base">👁</span>
            <span className="text-foreground/60 font-medium">Visitors:</span>
            <span className="text-[#FFD700] font-bold tabular-nums">{count.toLocaleString()}</span>
        </div>
    )
}
