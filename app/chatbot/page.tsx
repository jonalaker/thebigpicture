import type { Metadata } from "next"
import dynamic from "next/dynamic"
import Header from "@/components/header"
import Footer from "@/components/footer"

const ChatInterface = dynamic(() => import("@/components/chat-interface"))

export const metadata: Metadata = {
  title: "The AiGENT — AI Chat Assistant | The Big Picture",
  description:
    "Chat with The AiGENT, the AI-powered assistant for The Big Picture blockchain film production. Ask about PINN44 tokens, the project, and how to get involved.",
  keywords: [
    "AI chatbot",
    "The AiGENT",
    "blockchain film assistant",
    "PINN44 tokens",
    "The Big Picture",
    "crypto film",
  ],
  alternates: { canonical: "https://the-big-picture.info/chatbot" },
  robots: { index: true, follow: true },
  openGraph: {
    siteName: "The Big Picture",
    locale: "en_US",
    type: "website",
    title: "The AiGENT — AI Chat Assistant | The Big Picture",
    description:
      "Chat with The AiGENT, the AI-powered assistant for The Big Picture blockchain film. Ask about PINN44 tokens and how to get involved.",
    url: "https://the-big-picture.info/chatbot",
    images: [
      {
        url: "/placeholder-logo.png",
        width: 1200,
        height: 630,
        alt: "The AiGENT — AI Chat Assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The AiGENT — AI Chat Assistant | The Big Picture",
    description:
      "Chat with The AiGENT, the AI-powered assistant for The Big Picture blockchain film. Ask about PINN44 tokens and how to get involved.",
    images: ["/placeholder-logo.png"],
  },
}

export default function ChatbotPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "The AiGENT — AI Chat Assistant",
            description:
              "Chat with The AiGENT, the AI-powered assistant for The Big Picture blockchain film production. Ask about PINN44 tokens, the project, and how to get involved.",
            author: {
              "@type": "Organization",
              name: "The Big Picture",
            },
            publisher: {
              "@type": "Organization",
              name: "The Big Picture",
              logo: {
                "@type": "ImageObject",
                url: "https://the-big-picture.info/placeholder-logo.png",
              },
            },
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": "https://the-big-picture.info/chatbot",
            },
            image: "https://the-big-picture.info/placeholder-logo.png",
            keywords:
              "AI chatbot, The AiGENT, blockchain film assistant, PINN44 tokens",
          }),
        }}
      />
      <Header />
      <div className="flex-1">
        <ChatInterface />
      </div>
      <Footer />
    </main>
  )
}
