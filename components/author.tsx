export default function Author() {
  return (
    <section id="author" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-center mb-12 text-primary">About the Author</h2>

        <div className="grid md:grid-cols-3 gap-12 items-start">
          {/* Author Image Placeholder */}
          <div className="md:col-span-1 flex justify-center">
            <div className="w-48 h-64 bg-muted rounded-lg flex items-center justify-center border border-border">
              <span className="text-muted-foreground text-sm">Author Photo</span>
            </div>
          </div>

          {/* Author Bio */}
          <div className="md:col-span-2 space-y-6 text-foreground/80 leading-relaxed">
            <div>
              <h3 className="text-2xl font-serif text-primary mb-4">Jonah Laker</h3>
              <p>
                Jonah Laker is a speculative fiction writer and futurist who explores the intersection of technology,
                consciousness, and human potential. With a background in philosophy and computer science, his work
                examines the profound questions facing humanity as we approach the singularity and beyond.
              </p>
            </div>

            <p>
              Fascinated by the convergence of artificial intelligence and human evolution, Jonah has spent the last
              decade researching emerging technologies, consciousness studies, and the philosophical implications of
              creating thinking machines. His writing reflects a deep commitment to exploring not just what the future
              might look like, but what it means to maintain our humanity within it.
            </p>

            <p>
              THE AiGENT is his debut novella—a work that synthesizes his years of research and creative vision into a
              compelling narrative set in the near future. Through this story, he invites readers to participate in one
              of the most important conversations of our time: What does it mean to choose your own evolution?
            </p>

            <p>
              When not writing, Jonah can be found exploring Sydney's cultural landscape, engaging with AI ethics
              communities, and contemplating the nature of consciousness over coffee. He believes that speculative
              fiction is not about predicting the future, but about empowering readers to consciously shape it.
            </p>

            <div className="pt-4 space-y-2 text-sm">
              <p>
                <strong>Residence:</strong> Sydney, Australia
              </p>
              <p>
                <strong>Focus:</strong> Speculative Fiction, AI Ethics, Future Studies
              </p>
              <p>
                <strong>Current Project:</strong> THE AiGENT Novella Series
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
