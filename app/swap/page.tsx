import Header from '@/components/header';
import Footer from '@/components/footer';
import { FixedPriceSwapComponent } from '@/components/contracts';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Buy PINN44 — Private Token Sale | The Big Picture',
    description: 'Buy PINN44 tokens at a fixed price before public DEX listing. Early access private sale on Polygon Network.',
    openGraph: {
        title: 'Buy PINN44 — Private Sale',
        description: 'Fixed-price PINN44 token sale before DEX listing',
        type: 'website',
    },
};

export default function SwapPage() {
    return (
        <main className="min-h-screen bg-[#121212]">
            <Header />
            <div className="container mx-auto px-4 pt-28 pb-20">
                <div className="max-w-2xl mx-auto">
                    <h1
                        className="text-4xl font-bold text-center mb-3 text-gradient-purple-gold"
                        style={{ fontFamily: 'var(--font-heading)' }}
                    >
                        Buy PINN44
                    </h1>
                    <div className="bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-lg p-4 mb-6 text-center max-w-lg mx-auto shadow-lg shadow-[#FFD700]/5">
                        <p className="text-[#FFD700] font-bold text-lg mb-1 flex justify-center items-center gap-2">
                            <span>⚠️</span> BETA TESTING PHASE
                        </p>
                        <p className="text-foreground/80 text-sm">
                            The Private Token Sale is currently in a safe testing environment on the Polygon Amoy Testnet. You can buy PINN44 tokens using <strong>free Test USDC</strong>.
                        </p>
                    </div>
                    <p className="text-center text-foreground/50 mb-12 max-w-lg mx-auto text-sm">
                        Practice buying PINN44 tokens at a fixed price before our official Mainnet launch and public DEX listing.
                    </p>
                    <FixedPriceSwapComponent />
                </div>
            </div>
            <Footer />
        </main>
    );
}
