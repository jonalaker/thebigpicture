import type React from "react"
import type { Metadata, Viewport } from "next"
import dynamic from "next/dynamic"
import { Analytics } from "@vercel/analytics/next"
import { Inter, Montserrat } from "next/font/google"
import WalletProvider from "@/components/wallet-provider"
import "./globals.css"

const ChatWidget = dynamic(() => import("@/components/chat-widget"))
const VisitorCounter = dynamic(() => import("@/components/visitor-counter"))

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

// TODO: Replace /placeholder-logo.png with a proper 1200x630 OG image (e.g. /og-image.png)
export const metadata: Metadata = {
  title: "The Big Picture — A Trailblazing Film Production",
  description:
    "Join the FIRST blockchain-coordinated feature film. Discover THE AiGENT, a thought-provoking novella about human evolution set in Sydney 2044. Earn PINN tokens by contributing.",
  metadataBase: new URL("https://the-big-picture.info"),
  generator: "v0.app",
  robots: { index: true, follow: true },
  openGraph: {
    siteName: "The Big Picture",
    locale: "en_US",
    type: "website",
    title: "The Big Picture — A Trailblazing Film Production",
    description:
      "Join the FIRST blockchain-coordinated feature film. Discover THE AiGENT, a novella about human evolution set in Sydney 2044. Earn PINN tokens.",
    url: "https://the-big-picture.info",
    images: [
      {
        url: "/placeholder-logo.png",
        width: 1200,
        height: 630,
        alt: "The Big Picture — Blockchain Film Production",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Big Picture — A Trailblazing Film Production",
    description:
      "Join the FIRST blockchain-coordinated feature film. Discover THE AiGENT, a novella about human evolution set in Sydney 2044. Earn PINN tokens.",
    images: ["/placeholder-logo.png"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${montserrat.variable} font-sans antialiased bg-background text-foreground`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "The Big Picture",
              url: "https://the-big-picture.info",
              logo: "https://the-big-picture.info/placeholder-logo.png",
              description:
                "The first blockchain-coordinated feature film production. Discover THE AiGENT, a thought-provoking novella about human evolution set in Sydney 2044.",
              foundingDate: "2024",
              sameAs: [],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "The Big Picture",
              url: "https://the-big-picture.info",
              publisher: {
                "@type": "Organization",
                name: "The Big Picture",
              },
            }),
          }}
        />
        <WalletProvider>
          {children}
          <ChatWidget />
          <VisitorCounter />
        </WalletProvider>
        <Analytics />
      </body>
    </html>
  )
}
