import Header from '@/components/header';
import Footer from '@/components/footer';
import { FixedPriceSwapComponent } from '@/components/contracts';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Buy PINN44 — Private Token Sale | The Big Picture',
    description:
        'Buy PINN44 tokens at a fixed price before the public DEX listing. Early access to the private sale on Polygon Network. Join The Big Picture film community.',
    keywords: [
        'buy PINN44',
        'token sale',
        'private sale',
        'Polygon token',
        'crypto presale',
        'The Big Picture',
    ],
    alternates: { canonical: 'https://the-big-picture.info/swap' },
    robots: { index: true, follow: true },
    openGraph: {
        siteName: 'The Big Picture',
        locale: 'en_US',
        type: 'website',
        title: 'Buy PINN44 — Private Token Sale',
        description:
            'Buy PINN44 tokens at a fixed price before the public DEX listing. Early access private sale on Polygon Network.',
        url: 'https://the-big-picture.info/swap',
        images: [
            {
                url: '/placeholder-logo.png',
                width: 1200,
                height: 630,
                alt: 'Buy PINN44 — Private Token Sale',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Buy PINN44 — Private Token Sale',
        description:
            'Buy PINN44 tokens at a fixed price before the public DEX listing. Early access private sale on Polygon Network.',
        images: ['/placeholder-logo.png'],
    },
};

export default function SwapPage() {
    return (
        <main className="min-h-screen bg-[#121212]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'Article',
                        headline: 'Buy PINN44 — Private Token Sale',
                        description:
                            'Buy PINN44 tokens at a fixed price before the public DEX listing. Early access to the private sale on Polygon Network.',
                        author: {
                            '@type': 'Organization',
                            name: 'The Big Picture',
                        },
                        publisher: {
                            '@type': 'Organization',
                            name: 'The Big Picture',
                            logo: {
                                '@type': 'ImageObject',
                                url: 'https://the-big-picture.info/placeholder-logo.png',
                            },
                        },
                        mainEntityOfPage: {
                            '@type': 'WebPage',
                            '@id': 'https://the-big-picture.info/swap',
                        },
                        image: 'https://the-big-picture.info/placeholder-logo.png',
                        keywords: 'buy PINN44, token sale, private sale, Polygon token, crypto presale',
                    }),
                }}
            />
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
