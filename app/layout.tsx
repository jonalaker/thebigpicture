import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Inter, Montserrat } from "next/font/google"
import ChatWidget from "@/components/chat-widget"
import VisitorCounter from "@/components/visitor-counter"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "The Big Picture — A Trailblazing Film Production",
  description:
    "Join the FIRST blockchain-coordinated feature film. Discover THE AiGENT, a thought-provoking novella about human evolution set in Sydney 2044. Earn PINN tokens by contributing.",
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
      <body className={`${inter.variable} ${montserrat.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <ChatWidget />
        <VisitorCounter />
        <Analytics />
      </body>
    </html>
  )
}
