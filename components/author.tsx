"use client"

import kevinimage from "../app/images/kevin.jpg"
import { useEffect, useRef } from "react"

export default function Author() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll(".animate-on-scroll").forEach((el, i) => {
              ; (el as HTMLElement).style.animationDelay = `${i * 0.12}s`
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
      id="author"
      className="relative py-24 md:py-36 px-4 sm:px-6 lg:px-8 bg-[#121212]"
    >
      <div className="max-w-5xl mx-auto">
        {/* Section Label */}
        <div className="animate-on-scroll opacity-0 text-center mb-4">
          <span className="text-xs uppercase tracking-[0.3em] text-[#FFD700] font-semibold">
            The Visionary
          </span>
        </div>

        <h2
          className="animate-on-scroll opacity-0 text-center mb-16 text-gradient-gold"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          About the Author
        </h2>

        <div className="grid md:grid-cols-3 gap-12 items-start">
          {/* Author Image */}
          <div className="animate-on-scroll opacity-0 md:col-span-1 flex justify-center">
            <div className="relative group">
              {/* Purple glow ring */}
              <div className="absolute -inset-1 bg-gradient-to-br from-[#8247E5] to-[#FFD700] rounded-xl opacity-30 group-hover:opacity-60 transition-opacity duration-500 blur-sm" />
              <div className="relative w-52 h-68 bg-[#1a1a2e] rounded-xl overflow-hidden border border-[#8247E5]/30">
                <img
                  src={kevinimage.src}
                  alt="Jonah Laker"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Film strip accent */}
              <div className="absolute -left-3 top-4 bottom-4 w-2 flex flex-col gap-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex-1 bg-[#8247E5]/20 rounded-sm" />
                ))}
              </div>
            </div>
          </div>

          {/* Author Bio */}
          <div className="animate-on-scroll opacity-0 md:col-span-2">
            <div className="glass-panel rounded-2xl p-8 hover:glow-purple transition-all duration-500">
              <h3
                className="text-2xl mb-6 text-[#8247E5] normal-case"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Jonah Laker
              </h3>

              <div className="space-y-4 text-foreground/70 leading-relaxed">
                <p>
                  Jonah Laker is a speculative fiction writer and futurist who explores the
                  intersection of technology, consciousness, and human potential. With a background
                  in philosophy and computer science, his work examines the profound questions
                  facing humanity as we approach the singularity and beyond.
                </p>
                <p>
                  Fascinated by the convergence of artificial intelligence and human evolution,
                  Jonah has spent the last decade researching emerging technologies, consciousness
                  studies, and the philosophical implications of creating thinking machines.
                </p>
                <p>
                  THE AiGENT is his debut novella—a work that synthesizes his years of research and
                  creative vision into a compelling narrative set in the near future.
                </p>
              </div>

              {/* Info chips */}
              <div className="mt-8 flex flex-wrap gap-3">
                {[
                  { label: "Sydney, Australia", icon: "📍" },
                  { label: "Speculative Fiction", icon: "📖" },
                  { label: "AI Ethics", icon: "🧠" },
                  { label: "THE AiGENT Series", icon: "🎬" },
                ].map((chip, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-foreground/50 bg-[#1a1a2e] border border-[#2a2a3e] rounded-full"
                  >
                    <span>{chip.icon}</span>
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
