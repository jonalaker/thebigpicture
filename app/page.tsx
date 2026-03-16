import type { Metadata } from "next"
import dynamic from "next/dynamic"
import Header from "@/components/header"
import Hero from "@/components/hero"
import Footer from "@/components/footer"

const About = dynamic(() => import("@/components/about"))
const Author = dynamic(() => import("@/components/author"))
const TrustpilotSection = dynamic(() => import("@/components/trustpilot-section"))
const Contact = dynamic(() => import("@/components/contact"))

export const metadata: Metadata = {
  title: "The Big Picture — First Blockchain Film Production",
  description:
    "Join the first blockchain-coordinated feature film production. Discover THE AiGENT, a novella about human evolution set in Sydney 2044. Earn PINN tokens by contributing.",
  keywords: [
    "blockchain film",
    "PINN tokens",
    "The AiGENT",
    "crypto movie",
    "Web3 film production",
    "Polygon",
    "decentralized filmmaking",
  ],
  alternates: { canonical: "https://the-big-picture.info" },
  robots: { index: true, follow: true },
  openGraph: {
    siteName: "The Big Picture",
    locale: "en_US",
    type: "website",
    title: "The Big Picture — First Blockchain Film Production",
    description:
      "Join the first blockchain-coordinated feature film. Discover THE AiGENT, a novella set in Sydney 2044. Earn PINN tokens by contributing.",
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
    title: "The Big Picture — First Blockchain Film Production",
    description:
      "Join the first blockchain-coordinated feature film. Discover THE AiGENT, a novella set in Sydney 2044. Earn PINN tokens by contributing.",
    images: ["/placeholder-logo.png"],
  },
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "The Big Picture — First Blockchain Film Production",
            description:
              "Join the first blockchain-coordinated feature film production. Discover THE AiGENT, a novella about human evolution set in Sydney 2044. Earn PINN tokens by contributing.",
            author: {
              "@type": "Person",
              name: "Jonah Laker",
              url: "https://the-big-picture.info/#author",
              jobTitle: "Author & Filmmaker",
              description:
                "Speculative fiction writer and futurist exploring the intersection of technology, consciousness, and human potential.",
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
              "@id": "https://the-big-picture.info",
            },
            image: "https://the-big-picture.info/placeholder-logo.png",
            keywords:
              "blockchain film, PINN tokens, The AiGENT, Web3 film production, Polygon, decentralized filmmaking",
          }),
        }}
      />
      <Header />
      <Hero />
      <About />
      <Author />
      <TrustpilotSection />
      <Contact />
      <Footer />
    </main>
  )
}
