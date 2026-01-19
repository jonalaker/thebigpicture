import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import ChatWidget from "@/components/chat-widget"
import "./globals.css"

// Using system fonts as fallback to avoid Turbopack font loading issues
// To re-enable Google Fonts, uncomment the imports and font configurations below
// import { EB_Garamond, Inter } from "next/font/google"
// const garamond = EB_Garamond({ subsets: ["latin"], variable: "--font-serif" })
// const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "The Big Picture - THE AiGENT Novella",
  description:
    "Discover THE AiGENT, a thought-provoking novella about the future of human evolution set in Sydney 2044. Request your free reviewer's copy.",
  metadataBase: new URL("https://the-big-picture.info"),
  generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
        <ChatWidget />
        <Analytics />
      </body>
    </html>
  )
}
