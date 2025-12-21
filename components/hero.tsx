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
            A family, a concert, a conspiracy. In the heart of Sydney, 2044, the old world<br></br> clashes with the new. Will humanity embrace the dawn of hyper-selection, or cling to the fading echoes of the past? What if the next step in human evolution wasn't a choice, but a necessity?
          </p>

          <p className="text-lg md:text-xl leading-relaxed mb-6">
            Sign up  to out DECENTRALISED STUDIO PORTAL. We will send you the novella: The AiGENT,  a free join-up gift - from the author.
          </p>
          <p className="text-lg md:text-xl leading-relaxed mb-6">
            <h2>DECENTRALISED STUDIOS <br></br>first job posting</h2>
            <br></br>
            <span className="mb-2">Submit a screenplay, adapted from the novella THE AiGENT </span><br></br>
            Your screenplay can be produced with AI assistance. Full liberty is granted to change the novella as necessary. Earn 1000 studio points if your submission is selected, 1 point currently equals 25cents (USD) payable on completion of the film          </p>
          <p className="text-lg md:text-xl leading-relaxed mb-6">
            Storyboard, AI character creation, Music score, scene creation, promotional tailors and the final editing jobs will be posted at each stage in the production. All winning jobs earn the a point payout, to be advised, plus a bonus on successful release. On successful release of the film, 500 points equals(Approximately $2,500 bonus)
          </p>
          <span className="mb-4">ooooooooooooooooooooooooo</span>
          <p className="text-lg md:text-xl leading-relaxed mb-6">
            AUTHORS: Send us your original novel for consideration. We can make it a <br></br> feature film or series.<br></br>
            On selection receive 2000 points. Receive 25 cents (USD) per point on <br></br>completion of the film and a bonus on successful release of the film:<br></br> Approximately $20,000 USD
          </p>
          <span>0000000000000000000000000</span>
          <p className="text-lg md:text-xl leading-relaxed mb-6">
            Points earned can be used to vote on creative decisions
          </p>
          <span>oooooooooooooooooooooooooo</span>
          <p className="text-lg md:text-xl leading-relaxed mb-6">
            DECENTERALISED STUDIOS is a community organisation,  run my users through a Decentralised Autonomous Organisation. (DAO) ...Structured so that it can not be bought out by any corporations, or centralised institutions, (without an eighty percent agreement of the DAO)          </p>
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
