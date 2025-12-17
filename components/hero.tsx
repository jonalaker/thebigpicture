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
            DECENTRALISED STUDIOS first job posting:
            Submit a screenplay, adapted from the novella THE AiGENT
            Screenplay can be produced with AI assistance. Full liberty is granted to change the novella as preferred. Earn 1000 studio points if your submission is selected, 1 point currently equals 25cents (USD).
          </p>
          <p className="text-lg md:text-xl leading-relaxed mb-6">
            Storyboard, AI character creation, Music score, scene creation, promotional tailors and the final editing jobs will be posted at each stage in the production. All jobs earn point payouts plus a share in the films net sale proceeds.
            On sale of the film 1 point equals 1 percent of net profit (Approximately $5000, per 1million USD in sales)
          </p>
          <p className="text-lg md:text-xl leading-relaxed mb-6">
            AUTHORS: Send us your original novel for consideration for production of a feature film or series. On selection earn 2000 points at 25 cents per point -current value (USD) and 4 percent of net profit on sale.Approximately $20,000 USD per 1 million USD of sale value.
          </p>
          <p className="text-lg md:text-xl leading-relaxed mb-6">
            DECENTERALIASED STUDIOS is set-up as a community organisation, to be run my users through a Decentralised Autonomous Organisation. (DAO) ...Structured so that it can not be bought out by any corporations, or centralised institutions, without an eighty percent agreement of the DAO.
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
