import Header from "@/components/header"
import Hero from "@/components/hero"
import About from "@/components/about"
import Author from "@/components/author"
import Contact from "@/components/contact"
import Footer from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <About />
      <Author />
      <Contact />
      <Footer />
    </main>
  )
}
