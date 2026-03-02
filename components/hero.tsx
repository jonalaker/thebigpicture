"use client"

import { Button } from "@/components/ui/button"
import { useEffect, useRef } from "react"

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)

  const handleLearnMore = () => {
    document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })
  }

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
    <section ref={sectionRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* ═══ Cinematic Background ═══ */}
      <div className="absolute inset-0 bg-[#0a0a0f]" />

      {/* Animated gradient base */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(130,71,229,0.3), transparent), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(255,215,0,0.08), transparent), radial-gradient(ellipse 60% 40% at 20% 100%, rgba(130,71,229,0.12), transparent)",
        }}
      />

      {/* Spotlight beam — sweeps slowly */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: "conic-gradient(from 200deg at 50% -10%, transparent 0deg, rgba(130,71,229,0.15) 30deg, transparent 60deg, transparent 300deg, rgba(255,215,0,0.06) 340deg, transparent 360deg)",
          animation: "spin 25s linear infinite",
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              background: i % 3 === 0 ? "rgba(255,215,0,0.4)" : "rgba(130,71,229,0.3)",
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${6 + Math.random() * 8}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Vignette edges */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, #0a0a0f 100%)",
        }}
      />

      {/* Film grain texture */}
      <div className="film-grain absolute inset-0" />

      {/* ═══ Content ═══ */}
      <div className="relative z-10 max-w-5xl mx-auto text-center px-4 sm:px-6 lg:px-8 py-32">
        {/* Tagline */}
        <div className="animate-on-scroll opacity-0 mb-8 sm:mb-10">
          <span className="inline-block px-5 py-2 sm:px-6 sm:py-2.5 text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] font-semibold text-[#FFD700] border border-[#FFD700]/30 rounded-full bg-[#FFD700]/10 shadow-[0_0_20px_rgba(255,215,0,0.15)] backdrop-blur-md">
            🎬 The trailblazing film production studio -pioneering the future
            of blockchain profit sharing and collaborative coordination.
          </span>
        </div>

        {/* Main Heading */}
        <h2
          className="animate-on-scroll opacity-0 mb-8 sm:mb-10 leading-[1.1] sm:leading-tight text-gradient-purple-gold text-[clamp(1.25rem,6vw,4rem)] font-extrabold tracking-tight drop-shadow-xl whitespace-nowrap"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Join the First<br />
          Blockchain Coordinated<br />
          Feature Film Production.<br />
          <span className="text-foreground/90 font-medium whitespace-normal text-[clamp(1rem,4vw,2.25rem)] mt-4 sm:mt-6 block drop-shadow-md">Write the screenplay. Sign in with</span>
        </h2>

        {/* Detailed Instructions block */}
        <div className="animate-on-scroll opacity-0 glass-panel rounded-xl p-6 md:p-8 max-w-3xl mx-auto mb-12 glow-purple text-left space-y-4 shadow-lg">
          <p className="text-base md:text-lg text-[#FFD700] font-semibold mb-2">
            Step 1: <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">Click here to add your MetaMask wallet</a> to accept payments and coordinate your contributions.
          </p>


          <div className="space-y-5 text-base md:text-lg text-foreground/80 leading-relaxed px-2">
            <div className="text-center mb-6">
              <span className="text-foreground font-semibold tracking-wide text-lg sm:text-xl block mb-2">
                Be part of AI Blockchain Feature Film Production<br />
                Write the screenplay
              </span>
            </div>
            <p className="flex items-start gap-2">
              <span className="text-[#8247E5] mt-1">✦</span>
              <span>Sign in with MetaMask wallet, submit job, including your own guru.com name.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-[#8247E5] mt-1">✦</span>
              <span>When the successful freelancer's job is selected, initial payment is made for expenses.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-[#FFD700] mt-1">✦</span>
              <span>
                Also earn an extra <strong className="text-[#FFD700] drop-shadow-sm font-bold bg-[#FFD700]/10 px-2 py-0.5 rounded">2000 tokens</strong> that may be sell-able after the ICO is launched: at 1 cent per PINN e.g: <span className="text-green-400 font-bold tracking-wide">2000 PINN tokens = $20</span>
                <span className="text-sm text-foreground/50 italic ml-2 block mt-1">(This is only the minimum PINN value)</span>
              </span>
            </p>
            <div className="mt-6 border-l-2 border-[#8247E5]/40 pl-4 py-2 bg-gradient-to-r from-[#8247E5]/5 to-transparent rounded-r-lg">
              <p className="text-sm md:text-base text-foreground/70">
                You will have access to the files to view the successfully selected proceeding jobs, so that your subsequently submitted jobs can be matched to them.
              </p>
            </div>
          </div>


        </div>

        {/* ═══ Tasks Grid ═══ */}
        <div className="animate-on-scroll opacity-0 mb-10">
          <h2
            className="text-2xl md:text-3xl mb-6 text-gradient-gold"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Available Tasks & Rewards
          </h2>

          <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto text-left">
            {[
              { task: "Characters & Voices", reward: "$75 + 2,000 PINNs" },
              { task: "Storyboard", reward: "$75 + 2,000 PINNs" },
              { task: "20 segments of video (5 Minutes each)", reward: "$30 + 810 PINNs each" },
              { task: "Music Score", reward: "$75 + 2,000 PINNs" },
              { task: "Final Edit", reward: "$100 + 2,700 PINNs" },
            ].map((item, i) => (
              <div
                key={i}
                className="glass-panel rounded-lg p-4 flex justify-between items-center gap-4 hover:border-[#8247E5]/40 transition-all duration-300 hover:glow-purple group"
              >
                <span className="font-semibold text-sm text-foreground/90 group-hover:text-foreground transition-colors">
                  {item.task}
                </span>
                <span className="text-[#FFD700] font-bold text-sm whitespace-nowrap">
                  {item.reward}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Profit Share Box */}
        <div className="animate-on-scroll opacity-0 glass-panel rounded-xl p-5 max-w-xl mx-auto mb-10 border-[#FFD700]/20">
          <p className="text-base md:text-lg leading-relaxed text-foreground/80">
            <span className="text-[#FFD700] font-bold">💰 Cash Bonus</span> — Additional profit share
            paid on successful film sale, proportional to your PINN balance!
          </p>
        </div>

        {/* CTA */}
        <div className="animate-on-scroll opacity-0 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            onClick={handleLearnMore}
            size="lg"
            className="btn-gold px-10 py-4 text-base rounded-lg shadow-lg cursor-pointer"
          >
            Learn More
          </Button>
          <Button
            onClick={() => window.location.href = "/bounties"}
            size="lg"
            className="btn-purple px-10 py-4 text-base rounded-lg shadow-lg cursor-pointer"
          >
            Check Progress/Submit Work
          </Button>
        </div>

        {/* Scroll indicator */}
        <div className="animate-on-scroll opacity-0 mt-16 animate-float">
          <div className="w-6 h-10 border-2 border-[#8247E5]/40 rounded-full mx-auto flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-[#8247E5] rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    </section>
  )
}
