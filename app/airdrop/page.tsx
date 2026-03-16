import dynamic from 'next/dynamic';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Metadata } from 'next';

const AirdropClaim = dynamic(() =>
    import('@/components/airdrop/AirdropClaim').then((mod) => ({ default: mod.AirdropClaim }))
);

export const metadata: Metadata = {
    title: 'PINN44 Airdrop — Claim Your Free Tokens | The Big Picture',
    description:
        'Claim your free 100 PINN44 tokens in a gasless airdrop on Polygon Network. No gas fees required. Join The Big Picture film community and start earning today.',
    keywords: [
        'PINN44 airdrop',
        'free tokens',
        'Polygon airdrop',
        'gasless claim',
        'crypto airdrop',
        'The Big Picture',
    ],
    alternates: { canonical: 'https://the-big-picture.info/airdrop' },
    robots: { index: true, follow: true },
    openGraph: {
        siteName: 'The Big Picture',
        locale: 'en_US',
        type: 'website',
        title: 'PINN44 Airdrop — Claim Your Free Tokens',
        description:
            'Claim your free 100 PINN44 tokens in a gasless airdrop on Polygon Network. No gas fees required. Join The Big Picture community.',
        url: 'https://the-big-picture.info/airdrop',
        images: [
            {
                url: '/placeholder-logo.png',
                width: 1200,
                height: 630,
                alt: 'PINN44 Airdrop — Free Token Claim',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'PINN44 Airdrop — Claim Your Free Tokens',
        description:
            'Claim your free 100 PINN44 tokens in a gasless airdrop on Polygon Network. No gas fees required. Join The Big Picture community.',
        images: ['/placeholder-logo.png'],
    },
};

export default function AirdropPage() {
    return (
        <main className="min-h-screen bg-[#121212]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'Article',
                        headline: 'PINN44 Airdrop — Claim Your Free Tokens',
                        description:
                            'Claim your free 100 PINN44 tokens in a gasless airdrop on Polygon Network. No gas fees required. Join The Big Picture film community.',
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
                            '@id': 'https://the-big-picture.info/airdrop',
                        },
                        image: 'https://the-big-picture.info/placeholder-logo.png',
                        keywords: 'PINN44 airdrop, free tokens, Polygon airdrop, gasless claim, crypto airdrop',
                    }),
                }}
            />
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
