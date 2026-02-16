import Link from "next/link"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative bg-[#0a0a0a] text-foreground/80 py-16 px-4 sm:px-6 lg:px-8">
      {/* Purple gradient top border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#8247E5] to-transparent" />

      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-10 mb-14">
          {/* Brand */}
          <div>
            <h3
              className="text-xl font-bold mb-4 text-gradient-purple-gold normal-case"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              The Big Picture
            </h3>
            <p className="text-sm text-foreground/40 leading-relaxed">
              A trailblazing film production studio pioneering the future of
              collaborative, blockchain-coordinated cinema.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] font-semibold mb-5 text-[#8247E5]">
              Navigation
            </h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: "Home", href: "/" },
                { label: "About the Book", href: "#about" },
                { label: "Author", href: "#author" },
                { label: "Contact", href: "#contact" },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-foreground/40 hover:text-[#FFD700] transition-colors duration-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] font-semibold mb-5 text-[#8247E5]">
              Legal
            </h4>
            <ul className="space-y-3 text-sm">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((label) => (
                <li key={label}>
                  <Link
                    href="#"
                    className="text-foreground/40 hover:text-[#FFD700] transition-colors duration-300"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] font-semibold mb-5 text-[#8247E5]">
              Connect
            </h4>
            <ul className="space-y-3 text-sm">
              {["Twitter", "Instagram", "LinkedIn", "Discord"].map((label) => (
                <li key={label}>
                  <Link
                    href="#"
                    className="text-foreground/40 hover:text-[#FFD700] transition-colors duration-300"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#2a2a3e] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-foreground/30 uppercase tracking-wider">
            © {currentYear} The Big Picture. All rights reserved.
          </p>
          <p className="text-xs text-foreground/20 uppercase tracking-wider">
            <span className="text-[#FFD700]">Blockchain-Powered</span>{" "}
            <span className="text-foreground/30">Cinema</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
