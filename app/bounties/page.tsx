import Header from '@/components/header';
import Footer from '@/components/footer';
import { WorkSubmissionComponent } from '@/components/contracts';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Submit Work | The Big Picture',
    description: 'Submit your work and earn PINN44 tokens for completing tasks.',
    openGraph: {
        title: 'Submit Work — The Big Picture',
        description: 'Submit work and earn rewards',
        type: 'website',
    },
};

export default function BountiesPage() {
    return (
        <main className="min-h-screen bg-[#121212]">
            <Header />
            <div className="container mx-auto px-4 pt-28 pb-20">
                <div className="max-w-4xl mx-auto">
                    <h1
                        className="text-4xl font-bold text-center mb-3 text-gradient-purple-gold"
                        style={{ fontFamily: 'var(--font-heading)' }}
                    >
                        Submit Work
                    </h1>
                    <p className="text-center text-foreground/50 mb-8 max-w-2xl mx-auto">
                        Browse available tasks and submit your work to earn PINN44 tokens.
                        Upload your word files, videos etc, here.
                    </p>

                    <div className="mb-10 p-4 sm:p-5 rounded-xl border border-[#8247E5]/30 bg-[#8247E5]/10 shadow-[0_0_20px_rgba(130,71,229,0.15)] backdrop-blur-sm max-w-3xl mx-auto text-center">
                        <p className="text-base md:text-lg text-[#FFD700] font-semibold">
                            📖 The novella is available for download <br></br>(it's the first submission file in the list below).
                        </p>
                        <p className="text-sm mt-2 text-foreground/80 font-medium">
                            Next upcoming tasks: characters, storyboard, etc.
                        </p>
                    </div>

                    <WorkSubmissionComponent />

                    {/* MetaMask Gas Setup Guide */}
                    <details className="mt-10 rounded-xl border border-[#FFD700]/20 bg-[#1a1a2e]/80 backdrop-blur-lg overflow-hidden group">
                        <summary className="px-6 py-4 cursor-pointer flex items-center gap-3 text-foreground/70 hover:text-[#FFD700] transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                            <span className="text-xl">🔧</span>
                            <span className="font-semibold text-sm uppercase tracking-wider">Transaction Failing? MetaMask Gas Setup Guide</span>
                            <svg className="w-4 h-4 ml-auto transition-transform group-open:rotate-180 text-[#FFD700]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </summary>
                        <div className="px-6 pb-6 space-y-6 text-foreground/60 text-sm border-t border-[#FFD700]/10 pt-5">
                            {/* Modern MetaMask */}
                            <div>
                                <h3 className="text-[#FFD700] font-semibold mb-3 text-base">For MetaMask Extension (v10.29.0 or newer)</h3>
                                <ol className="list-decimal list-inside space-y-2">
                                    <li>Start your transaction as normal in MetaMask</li>
                                    <li>Click the <strong className="text-foreground/80">pencil icon ✏️</strong> next to the estimated gas fee</li>
                                    <li>Click <strong className="text-foreground/80">&quot;Advanced&quot;</strong> at the bottom of the pop-up</li>
                                    <li>
                                        Enter these exact values:
                                        <div className="mt-2 ml-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div className="p-3 rounded-lg bg-[#8247E5]/10 border border-[#8247E5]/20">
                                                <p className="text-xs text-foreground/40">Max priority fee</p>
                                                <p className="text-lg font-bold text-[#FFD700]">25 <span className="text-xs font-normal text-foreground/40">GWEI</span></p>
                                            </div>
                                            <div className="p-3 rounded-lg bg-[#8247E5]/10 border border-[#8247E5]/20">
                                                <p className="text-xs text-foreground/40">Max fee</p>
                                                <p className="text-lg font-bold text-[#FFD700]">25 <span className="text-xs font-normal text-foreground/40">GWEI</span></p>
                                            </div>
                                        </div>
                                        <p className="mt-2 ml-4 text-foreground/40 text-xs">Gas limit: Keep as estimated (or use 245710 if needed)</p>
                                    </li>
                                    <li>Click <strong className="text-foreground/80">&quot;Save&quot;</strong> to confirm</li>
                                </ol>
                            </div>

                            {/* Older MetaMask */}
                            <div className="p-4 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/15">
                                <h3 className="text-[#FFD700] font-semibold mb-2">For Older MetaMask Versions</h3>
                                <p className="mb-2">If you don&apos;t see the Advanced option:</p>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>Go to <strong className="text-foreground/80">Settings → Advanced</strong></li>
                                    <li>Toggle on <strong className="text-foreground/80">&quot;Advanced gas controls&quot;</strong></li>
                                    <li>Then follow the steps above</li>
                                </ol>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
            <Footer />
        </main>
    );
}
