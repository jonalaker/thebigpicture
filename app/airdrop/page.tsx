import Header from '@/components/header';
import Footer from '@/components/footer';
import { AirdropClaim } from '@/components/airdrop/AirdropClaim';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'PINN44 Airdrop — Claim Your Free Tokens | The Big Picture',
    description: 'Claim your free 100 PINN44 tokens. Gasless airdrop on Polygon Network for The Big Picture community.',
    openGraph: {
        title: 'PINN44 Airdrop',
        description: 'Claim your free 100 PINN44 tokens on Polygon Network',
        type: 'website',
    },
};

export default function AirdropPage() {
    return (
        <main className="min-h-screen bg-[#121212]">
            <Header />
            <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mx-auto">
                    <h1
                        className="text-4xl font-bold text-center mb-3 text-gradient-purple-gold"
                        style={{ fontFamily: 'var(--font-heading)' }}
                    >
                        Free Airdrop
                    </h1>
                    <p className="text-center text-foreground/50 mb-10 max-w-lg mx-auto">
                        Claim your free PINN44 tokens — no gas fees required.
                    </p>
                </div>
            </div>
            <AirdropClaim />
            <Footer />
        </main>
    );
}
