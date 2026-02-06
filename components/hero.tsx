"use client"

import { Button } from "@/components/ui/button"

export default function Hero() {
  const handleLearnMore = () => {
    document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section className="relative py-20 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="mb-8 text-primary leading-tight">Join the EXCITING FIRST Blockchain Coordinated Feature Film</h1>

        <div className="prose prose-lg max-w-3xl mx-auto mb-12 font-serif text-foreground/90">
          <p className="text-lg md:text-xl leading-relaxed mb-6">
            Sign in with MetaMask wallet, submit job, including your own guru.com name.
          </p>

          <p className="text-lg md:text-xl leading-relaxed mb-6">
            Successful job selected, and then contracted on guru.com, and paid from Safepay.
          </p>

          <div className="p-4 rounded-lg bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 mb-6">
            <p className="text-lg md:text-xl leading-relaxed">
              <strong className="text-purple-400">Also earn an extra 2000 tokens</strong> that may be sell-able after the ICO is launched: at 1 cent per PINN e.g: <span className="text-green-400 font-bold">2000 PINN tokens = $20</span> (This is only the minimum PINN value)
            </p>
          </div>

          <p className="text-lg md:text-xl leading-relaxed mb-6 text-blue-300">
            You will have access to the files to view the successfully selected proceeding jobs, so that your subsequently submitted jobs can be matched to them.
          </p>

          <span className="block mb-6 text-center text-2xl">🎬</span>

          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
            Available Tasks &amp; Rewards
          </h2>

          <div className="space-y-3 text-left">
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 flex justify-between items-center">
              <span className="font-semibold">Characters and Voices</span>
              <span className="text-green-400 font-bold">$75 + 2000 PINNs</span>
            </div>

            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 flex justify-between items-center">
              <span className="font-semibold">Storyboard</span>
              <span className="text-green-400 font-bold">$75 + 2000 PINNs</span>
            </div>

            <div className="p-3 rounded-lg bg-blue-900/30 border border-blue-500/30 flex justify-between items-center">
              <span className="font-semibold">20 segments of video (5 Minutes each)</span>
              <span className="text-green-400 font-bold">$30 + 810 PINNs each</span>
            </div>

            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 flex justify-between items-center">
              <span className="font-semibold">Music Score</span>
              <span className="text-green-400 font-bold">$75 + 2000 PINNs</span>
            </div>

            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 flex justify-between items-center">
              <span className="font-semibold">Final Edit</span>
              <span className="text-green-400 font-bold">$100 + 2700 PINNs</span>
            </div>
          </div>

          <span className="block my-6 text-center text-2xl">💰</span>

          <div className="p-4 rounded-lg bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 mb-6">
            <p className="text-lg md:text-xl leading-relaxed text-center">
              <strong className="text-green-400">A FURTHER cash bonus</strong> will be paid to contributors on successful sale of the film — your PINN balance dictating your percentage share of profit!
            </p>
          </div>

          <span className="block mb-6 text-center text-2xl">🚀</span>

          <p className="text-xl md:text-2xl leading-relaxed text-center font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400">
            JOIN the first AI / BLOCKCHAIN ENTERTAINMENT&apos;S TRAILBLAZING first PROJECT — NOW!
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
