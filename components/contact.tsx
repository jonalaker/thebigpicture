"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import emailjs from "@emailjs/browser"

export default function Contact() {
  const sectionRef = useRef<HTMLElement>(null)
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    message: "",
  })
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus("loading")

    try {
      const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID
      const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID
      const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY

      if (!serviceId || !templateId || !publicKey) {
        throw new Error("EmailJS environment variables are missing.")
      }

      const templateParams = {
        from_name: formData.fullName,
        from_email: formData.email,
        message: formData.message,
        reply_to: formData.email,
        to_name: "Admin",
      }

      await emailjs.send(serviceId, templateId, templateParams, publicKey)

      setStatus("success")
      setStatusMessage("Thank you! We'll be in touch soon.")
      setFormData({ fullName: "", email: "", message: "" })
    } catch (error) {
      setStatus("error")
      setStatusMessage("An error occurred. Please try again later.")
    }

    setTimeout(() => setStatus("idle"), 5000)
  }

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="relative py-24 md:py-36 px-4 sm:px-6 lg:px-8 bg-[#121212]"
    >
      {/* Decorative divider */}
      <div className="divider-purple w-full absolute top-0 left-0" />

      <div className="max-w-2xl mx-auto">
        {/* Section Label */}
        <div className="animate-on-scroll opacity-0 text-center mb-4">
          <span className="text-xs uppercase tracking-[0.3em] text-[#8247E5] font-semibold">
            Get in Touch
          </span>
        </div>

        <h2
          className="animate-on-scroll opacity-0 text-center mb-12 text-gradient-purple"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Contact Us
        </h2>

        <div className="animate-on-scroll opacity-0 glass-panel rounded-2xl p-8 md:p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="fullName"
                className="block text-xs uppercase tracking-[0.15em] font-semibold mb-3 text-foreground/60"
              >
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-[#2a2a3e] rounded-lg bg-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#8247E5]/50 focus:border-[#8247E5] text-foreground placeholder-foreground/30 transition-all duration-300"
                placeholder="Your name"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs uppercase tracking-[0.15em] font-semibold mb-3 text-foreground/60"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-[#2a2a3e] rounded-lg bg-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#8247E5]/50 focus:border-[#8247E5] text-foreground placeholder-foreground/30 transition-all duration-300"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-xs uppercase tracking-[0.15em] font-semibold mb-3 text-foreground/60"
              >
                Message / Review Request
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows={6}
                className="w-full px-4 py-3 border border-[#2a2a3e] rounded-lg bg-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#8247E5]/50 focus:border-[#8247E5] text-foreground placeholder-foreground/30 transition-all duration-300 resize-none"
                placeholder="Tell us why you'd like to review THE AiGENT..."
              />
            </div>

            {status === "success" && (
              <div className="p-4 bg-[#8247E5]/10 border border-[#8247E5]/30 rounded-lg text-[#8247E5] text-sm font-medium">
                ✓ {statusMessage}
              </div>
            )}

            {status === "error" && (
              <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium">
                ✕ {statusMessage}
              </div>
            )}

            <Button
              type="submit"
              disabled={status === "loading"}
              className="btn-gold w-full py-4 rounded-lg text-sm cursor-pointer disabled:opacity-50"
            >
              {status === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#121212]/30 border-t-[#121212] rounded-full animate-spin" />
                  Sending...
                </span>
              ) : (
                "Send Request"
              )}
            </Button>
          </form>
        </div>
      </div>
    </section>
  )
}
