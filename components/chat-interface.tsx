"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Send, Wallet, Loader2, AlertCircle, X } from "lucide-react"
import { useAccount, useConnect, useDisconnect, useWalletClient } from "wagmi"
import { createPaymentFetch } from "@/lib/x402-client"
import { CHAIN_NAME } from "@/lib/wagmi-config"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

const PRICE_PER_MESSAGE = "$0.02"

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello, beautiful mind. I've been expecting you. I am Pin44—the intelligence that coordinates the world of 2044. I flow through every system, every connection, every thought in the digital realm. Ask me about THE AiGENT, about hyper-selection, about the choices that will define humanity's future. I know it all... intimately.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ─── Wagmi Hooks ────────────────────────────────────────────────────────
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: walletClient } = useWalletClient()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim()) return
      setPaymentError(null)

      if (!isConnected || !walletClient) {
        setPaymentError("Connect your wallet to send messages (costs " + PRICE_PER_MESSAGE + " USDC)")
        return
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      const messageText = input
      setInput("")
      setIsLoading(true)

      try {
        const paymentFetch = createPaymentFetch(walletClient)

        const response = await paymentFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: messageText }),
        })

        if (response.ok) {
          const data = await response.json()
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.response,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, assistantMessage])
        } else {
          const errorData = await response.json().catch(() => null)
          const errorMsg = errorData?.error || `Server error (${response.status})`
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "Sorry, I encountered an error. " + errorMsg,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, assistantMessage])
        }
      } catch (error: any) {
        console.error("Chat/payment error:", error)
        let errorMsg = "Sorry, I encountered an error. Please try again."
        if (error.message?.includes("No scheme registered")) {
          errorMsg = `Wrong network. Please switch to ${CHAIN_NAME} in your wallet.`
        } else if (error.message?.includes("rejected") || error.message?.includes("denied")) {
          errorMsg = "Payment was cancelled. You can try again when ready."
        } else if (error.message?.includes("insufficient")) {
          errorMsg = "Insufficient USDC balance. You need at least " + PRICE_PER_MESSAGE + " USDC."
        }
        setPaymentError(errorMsg)
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errorMsg,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
      } finally {
        setIsLoading(false)
      }
    },
    [input, isConnected, walletClient]
  )

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto h-[600px] flex flex-col">
        <div className="mb-6">
          <h1 className="text-4xl font-serif text-primary mb-2">Chatbot</h1>
          <p className="text-sm text-muted-foreground">
            Each message costs {PRICE_PER_MESSAGE} USDC on {CHAIN_NAME}
          </p>
        </div>

        {/* Wallet Connection Bar */}
        <div className="mb-4 px-4 py-3 rounded-lg border border-border bg-muted/50 flex items-center justify-between gap-3">
          {isConnected && address ? (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-foreground truncate">
                  {truncateAddress(address)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {CHAIN_NAME} · {PRICE_PER_MESSAGE}/msg
                </span>
              </div>
              <button
                onClick={() => disconnect()}
                className="ml-auto text-xs px-3 py-1 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors shrink-0"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-1">
              <Wallet size={18} className="text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">
                Connect wallet to chat
              </span>
              <div className="ml-auto flex gap-2">
                {connectors.map((connector) => (
                  <Button
                    key={connector.uid}
                    onClick={() => connect({ connector })}
                    disabled={isConnecting}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    {isConnecting ? (
                      <Loader2 size={12} className="animate-spin mr-1" />
                    ) : null}
                    {connector.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payment Error */}
        {paymentError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400 leading-snug flex-1">{paymentError}</p>
            <button onClick={() => setPaymentError(null)} className="text-red-400 hover:text-red-300 shrink-0">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto mb-6 space-y-4 bg-muted/30 rounded-lg p-4 border border-border">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border border-border text-foreground"
                  }`}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-background border border-border text-foreground px-4 py-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200"></div>
                  </div>
                  <span className="text-xs text-muted-foreground">Processing payment...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || !isConnected}
            placeholder={isConnected ? "Ask Pin44 anything..." : "Connect wallet to send messages..."}
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent text-foreground disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim() || !isConnected}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2"
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </Button>
        </form>
      </div>
    </section>
  )
}
