import Header from '@/components/header';
import Footer from '@/components/footer';
import { AirdropClaim } from '@/components/airdrop/AirdropClaim';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'PINN44 Airdrop - Claim Your Free Tokens | The Big Picture',
    description: 'Claim your free 100 PINN44 tokens. Gasless airdrop on Polygon Network for The Big Picture community.',
    openGraph: {
        title: 'PINN44 Airdrop',
        description: 'Claim your free 100 PINN44 tokens on Polygon Network',
        type: 'website',
    },
};

export default function AirdropPage() {
    return (
        <main className="min-h-screen">
            <Header />
            <AirdropClaim />
            <Footer />
        </main>
    );
}
