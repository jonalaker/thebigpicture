"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import emailjs from "@emailjs/browser"

export default function Contact() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    message: "",
  })
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")

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
      /* 
       * NOTE: You need to set the following environment variables in your .env.local file:
       * NEXT_PUBLIC_EMAILJS_SERVICE_ID
       * NEXT_PUBLIC_EMAILJS_TEMPLATE_ID
       * NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
       */
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
        to_name: "Admin", // You can customize this in your EmailJS template
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
    <section id="contact" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-center mb-12 text-primary">Get in Touch</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium mb-2 text-foreground">
              Full Name
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent text-foreground"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2 text-foreground">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent text-foreground"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium mb-2 text-foreground">
              Message / Review Request
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              required
              rows={6}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent text-foreground resize-none"
              placeholder="Tell us why you'd like to review THE AiGENT..."
            />
          </div>

          {status === "success" && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">{statusMessage}</div>
          )}

          {status === "error" && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{statusMessage}</div>
          )}

          <Button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-3"
          >
            {status === "loading" ? "Sending..." : "Send Request"}
          </Button>
        </form>
      </div>
    </section>
  )
}
