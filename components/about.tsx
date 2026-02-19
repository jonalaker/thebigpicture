"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useEffect, useRef } from "react"

export default function About() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll(".animate-on-scroll").forEach((el, i) => {
              ; (el as HTMLElement).style.animationDelay = `${i * 0.15}s`
              el.classList.add("animate-fade-in-up")
            })
          }
        })
      },
      { threshold: 0.1 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="about"
      className="relative py-24 md:py-36 px-4 sm:px-6 lg:px-8 bg-[#0e0e1a]"
    >
      {/* Decorative top divider */}
      <div className="divider-purple w-full absolute top-0 left-0" />

      <div className="max-w-5xl mx-auto">
        {/* Section Label */}
        <div className="animate-on-scroll opacity-0 text-center mb-4">
          <span className="text-xs uppercase tracking-[0.3em] text-[#8247E5] font-semibold">
            About the Story
          </span>
        </div>

        {/* Section Heading */}
        <h2
          className="animate-on-scroll opacity-0 text-center mb-6 text-gradient-purple"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          THE AIGENT
        </h2>

        <p className="animate-on-scroll opacity-0 text-center text-foreground/60 text-lg max-w-2xl mx-auto mb-16 leading-relaxed">
          Discover a thought-provoking novella that challenges our understanding of human evolution,
          consciousness, and choice in the digital age. Set in Sydney 2044.
        </p>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Story Card */}
          <div className="animate-on-scroll opacity-0 glass-panel rounded-2xl p-8 hover:glow-purple transition-all duration-500 group">
            <div className="w-12 h-12 rounded-lg bg-[#8247E5]/20 flex items-center justify-center mb-6 group-hover:bg-[#8247E5]/30 transition-colors">
              <span className="text-2xl">🎬</span>
            </div>
            <h3
              className="text-xl mb-4 text-[#8247E5] normal-case"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              About the Story
            </h3>
            <p className="text-foreground/70 leading-relaxed mb-4">
              In a near-future Sydney, a revolutionary technology emerges that allows humanity to
              shape their own evolution. But every choice comes with consequences.
            </p>
            <p className="text-foreground/60 leading-relaxed">
              As a family navigates this new reality against the backdrop of a concert and a
              conspiracy, readers are pulled into a narrative that challenges everything we believe
              about free will and human destiny.
            </p>
          </div>

          {/* CTA Card */}
          <div className="animate-on-scroll opacity-0 glass-panel rounded-2xl p-8 hover:border-[#FFD700]/30 transition-all duration-500 group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-lg bg-[#FFD700]/10 flex items-center justify-center mb-6 group-hover:bg-[#FFD700]/20 transition-colors">
                <span className="text-2xl">✧</span>
              </div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#FFD700]/60 font-semibold mb-4">
                Exclusive Opportunity
              </p>
              <p className="text-foreground/70 leading-relaxed mb-8">
                Get early access to THE AiGENT before its official release. As a valued reviewer,
                your feedback will help shape the final version of this groundbreaking novella.
              </p>
            </div>
            <Link href="#contact">
              <Button className="btn-gold w-full py-3 rounded-lg text-sm cursor-pointer">
                Request Your Free Copy
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
