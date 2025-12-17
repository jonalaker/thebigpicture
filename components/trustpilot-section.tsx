import { Button } from "@/components/ui/button"

export default function TrustpilotSection() {
  return (
    <section className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground mb-3">
          Reader Feedback
        </p>
        <h2 className="text-3xl md:text-4xl font-serif text-primary mb-4">
          See what readers say on Trustpilot
        </h2>
        <p className="text-foreground/80 mb-8 max-w-2xl mx-auto">
          Discover honest reviews of <span className="font-semibold">THE AiGENT</span> from early readers around
          the world. Your opinion can join them after you&apos;ve read the novella.
        </p>
        <a
          href="https://www.trustpilot.com/review/the-big-picture.info"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button className="px-8 py-6 text-base rounded-full shadow-lg shadow-primary/30">
            Read our Trustpilot reviews
          </Button>
        </a>
      </div>
    </section>
  )
}



