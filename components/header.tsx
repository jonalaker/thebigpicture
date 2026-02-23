"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navItems = [
    { label: "Home", href: "/" },
    { label: "About", href: "/#about" },
    { label: "Author", href: "/#author" },
    { label: "Buy PINN44", href: "/swap" },
    { label: "Airdrop", href: "/airdrop" },
    { label: "Staking", href: "/staking" },
    { label: "Submit Work", href: "/bounties" },
    { label: "Vault", href: "/vault" },
    { label: "Contact", href: "/#contact" },
  ]

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
        ? "bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-[#8247E5]/20 shadow-[0_4px_30px_rgba(130,71,229,0.1)]"
        : "bg-transparent"
        }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-3">
          <span className="whitespace-nowrap text-xl sm:text-2xl font-bold uppercase tracking-widest text-gradient-purple-gold"
            style={{ fontFamily: "var(--font-heading)" }}>
            The-Big-Picture.info
          </span>
          <span className="hidden md:inline text-[10px] uppercase tracking-[0.3em] text-[#FFD700]/60 font-semibold border border-[#FFD700]/20 px-2 py-0.5 rounded">
            Film Studio
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="relative px-4 py-2 text-xs uppercase tracking-[0.15em] font-semibold text-foreground/70 hover:text-[#FFD700] transition-all duration-300 group"
            >
              {item.label}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-gradient-to-r from-[#8247E5] to-[#FFD700] transition-all duration-300 group-hover:w-3/4" />
            </Link>
          ))}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="lg:hidden relative p-2 text-foreground hover:text-[#FFD700] transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Navigation */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          }`}
      >
        <div className="bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-[#8247E5]/20 px-4 py-6">
          <div className="flex flex-col gap-1">
            {navItems.map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                className="px-4 py-3 text-sm uppercase tracking-[0.15em] font-semibold text-foreground/70 hover:text-[#FFD700] hover:bg-[#8247E5]/10 rounded-lg transition-all duration-300"
                onClick={() => setIsOpen(false)}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
