"use client"

import Header from "@/components/header"
import Footer from "@/components/footer"
import ChatInterface from "@/components/chat-interface"

export default function ChatbotPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1">
        <ChatInterface />
      </div>
      <Footer />
    </main>
  )
}
