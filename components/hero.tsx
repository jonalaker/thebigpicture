"use client"

import { Button } from "@/components/ui/button"

export default function Hero() {
  const handleLearnMore = () => {
    document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section className="relative py-20 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="mb-8 text-primary leading-tight">Request an Exclusive Reviewer's Preview of Our New Novella</h1>

        <div className="prose prose-lg max-w-2xl mx-auto mb-12 font-serif text-foreground/90">
          {/* <p className="text-lg md:text-xl leading-relaxed mb-6">
            Imagine a world where your thoughts shape reality. Where the next step in human evolution isn't a theory,
            but a choice.
          </p> */}

          <p className="text-lg md:text-xl leading-relaxed mb-6">
            A family, a concert, a conspiracy. In the heart of Sydney, 2044, the old world clashes with the new. Will
            humanity embrace the dawn of hyper-selection, or cling to the fading echoes of the past? What if the next
            step in human evolution wasn't a choice, but a necessity?
          </p>

          <p className="text-lg md:text-xl leading-relaxed mb-6">
          Sign up (underlined link to above sign up) to out DECENTRALISED STUDIO PORTAL. We will send you the novella: The AiGENT,  a free join-up gift - from the author.         
           </p>
           <p className="text-lg md:text-xl leading-relaxed mb-6">
           DECENTERALIAZED STUDIO is a decentralised platform, designed to be run my users through a Decentralised Autonomous Organisation. (DAO)
It’s structured so it can never be bought out by media/internet corps, or centralised institutions.
           </p>
        </div>

        <Button
          onClick={handleLearnMore}
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 text-base"
        >
          Learn More
        </Button>
      </div>
    </section>
  )
}
