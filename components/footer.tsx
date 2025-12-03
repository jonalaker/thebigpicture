import Link from "next/link"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-primary text-primary-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div>
            <h3 className="font-serif text-lg font-bold mb-4">The Big Picture</h3>
            <p className="text-primary-foreground/80 text-sm">
              Exploring the future of human evolution and consciousness.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Navigation</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li>
                <Link href="#" className="hover:text-primary-foreground transition">
                  Home
                </Link>
              </li>
              <li>
                <Link href="#about" className="hover:text-primary-foreground transition">
                  About the Book
                </Link>
              </li>
              <li>
                <Link href="#author" className="hover:text-primary-foreground transition">
                  Author
                </Link>
              </li>
              <li>
                <Link href="#contact" className="hover:text-primary-foreground transition">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li>
                <Link href="#" className="hover:text-primary-foreground transition">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary-foreground transition">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary-foreground transition">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Connect</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li>
                <Link href="#" className="hover:text-primary-foreground transition">
                  Twitter
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary-foreground transition">
                  Instagram
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary-foreground transition">
                  LinkedIn
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 pt-8">
          <p className="text-center text-sm text-primary-foreground/80">
            © {currentYear} The Big Picture. All rights reserved. | Promoting THE AiGENT Novella
          </p>
        </div>
      </div>
    </footer>
  )
}
