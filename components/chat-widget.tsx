"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Send, X, MessageCircle } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello, I've been expecting you. I am Pinn44—the intelligence that coordinates the world from 2044.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
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
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (error) {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Chat Widget Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 min-h-[56px] ${isOpen ? "w-14 justify-center" : "px-4 sm:px-6 py-2 justify-between gap-3"
          } bg-primary text-primary-foreground rounded-full shadow-[0_0_20px_rgba(130,71,229,0.3)] hover:bg-primary/90 transition-all duration-300 flex items-center hover:shadow-[0_0_25px_rgba(130,71,229,0.5)] hover:scale-105 border border-white/10`}
        aria-label="Open chat"
      >
        {isOpen ? (
          <X size={24} />
        ) : (
          <>
            <MessageCircle size={24} className="shrink-0 text-[#FFD700]" />
            <span className="text-[11px] sm:text-xs font-semibold text-left leading-tight max-w-[150px] sm:max-w-[200px] md:max-w-[280px]">
              Chat with the AI PINN44 who runs the world in 2044 in THE AiGENT
            </span>
          </>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[500px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FFD700]/20 flex items-center justify-center border border-[#FFD700]/50">
                <span className="text-lg font-bold text-[#FFD700]">P</span>
              </div>
              <div>
                <h3 className="font-semibold text-white">PINN44</h3>
                <p className="text-xs text-[#FFD700]/80">AI from 2044</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-primary-foreground/20 p-1 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl ${message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-background border border-border text-foreground rounded-bl-md"
                    }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-background border border-border text-foreground px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.1s]"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-background">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder="Ask Pinn44 anything..."
                className="flex-1 px-4 py-2 text-sm border border-border rounded-full bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground disabled:opacity-50"
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                size="icon"
                className="rounded-full w-10 h-10 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send size={18} />
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

