"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function About() {
  return (
    <section id="about" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-center mb-4 text-primary">THE AiGENT</h2>

        <div className="text-center mb-12">
          <p className="text-subtitle mb-8 text-foreground/80 text-lg leading-relaxed">
            Discover a thought-provoking novella that challenges our understanding of human evolution, consciousness,
            and choice in the digital age. Set in Sydney 2044, THE AiGENT explores what happens when artificial
            intelligence and human potential collide.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 mb-12">
          <div>
            <h3 className="text-2xl mb-4 text-primary font-serif">About the Story</h3>
            <p className="text-foreground/80 leading-relaxed mb-6">
              In a near-future Sydney, a revolutionary technology emerges that allows humanity to shape their own
              evolution. But every choice comes with consequences. As a family navigates this new reality against the
              backdrop of a concert and a conspiracy, readers are pulled into a narrative that challenges everything we
              believe about free will and human destiny.
            </p>
            <p className="text-foreground/80 leading-relaxed">
              THE AiGENT is a speculative fiction novella that will leave you questioning the nature of progress,
              consciousness, and what it truly means to be human.
            </p>
          </div>

          <div className="flex flex-col justify-center">
            <div className="bg-background rounded-lg p-8 border border-border">
              <div className="text-center">
                <div className="text-5xl font-serif text-accent mb-4">✧</div>
                <p className="text-sm uppercase tracking-widest text-muted-foreground mb-6">Exclusive Opportunity</p>
                <p className="text-foreground/80 mb-8 leading-relaxed">
                  Get early access to THE AiGENT before its official release. As a valued reviewer, your feedback will
                  help shape the final version of this groundbreaking novella.
                </p>
                <Link href="#contact">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">
                    Request Your Free Reviewer's Copy
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
