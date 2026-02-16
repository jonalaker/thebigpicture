"use client"

import { Button } from "@/components/ui/button"
import { useEffect, useRef } from "react"

export default function TrustpilotSection() {
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
      className="relative py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-[#0e0e1a]"
    >
      {/* Decorative divider */}
      <div className="divider-purple w-full absolute top-0 left-0" />

      <div className="max-w-3xl mx-auto text-center">
        {/* Gold stars */}
        <div className="animate-on-scroll opacity-0 flex justify-center gap-1 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="text-[#FFD700] text-2xl">★</span>
          ))}
        </div>

        <p className="animate-on-scroll opacity-0 text-xs uppercase tracking-[0.3em] text-[#FFD700]/60 font-semibold mb-4">
          Reader Feedback
        </p>

        <h2
          className="animate-on-scroll opacity-0 text-gradient-gold mb-6"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          See What Readers Say
        </h2>

        <p className="animate-on-scroll opacity-0 text-foreground/60 mb-10 max-w-xl mx-auto leading-relaxed">
          Discover honest reviews of{" "}
          <span className="text-[#8247E5] font-semibold">THE AiGENT</span> from early readers
          around the world. Your opinion can join them after you&apos;ve read the novella.
        </p>

        <div className="animate-on-scroll opacity-0">
          <a
            href="https://www.trustpilot.com/review/the-big-picture.info"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="btn-gold px-10 py-4 text-sm rounded-full shadow-lg cursor-pointer">
              Read Our Trustpilot Reviews
            </Button>
          </a>
        </div>
      </div>
    </section>
  )
}
