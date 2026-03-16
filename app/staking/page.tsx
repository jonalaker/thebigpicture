import Header from '@/components/header';
import Footer from '@/components/footer';
import { StakingVestingComponent } from '@/components/contracts';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Stake PINN44 Tokens — Staking & Vesting | The Big Picture',
    description:
        'Stake your PINN44 tokens to unlock higher-tier tasks, earn staking rewards, and access exclusive benefits. View and claim vested tokens as they unlock.',
    keywords: [
        'PINN44 staking',
        'token vesting',
        'crypto staking',
        'Polygon staking',
        'earn rewards',
        'The Big Picture',
    ],
    alternates: { canonical: 'https://the-big-picture.info/staking' },
    robots: { index: true, follow: true },
    openGraph: {
        siteName: 'The Big Picture',
        locale: 'en_US',
        type: 'website',
        title: 'Stake PINN44 Tokens — Staking & Vesting',
        description:
            'Stake your PINN44 tokens to unlock higher-tier tasks, earn staking rewards, and access exclusive benefits on Polygon.',
        url: 'https://the-big-picture.info/staking',
        images: [
            {
                url: '/placeholder-logo.png',
                width: 1200,
                height: 630,
                alt: 'PINN44 Staking & Vesting',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Stake PINN44 Tokens — Staking & Vesting',
        description:
            'Stake your PINN44 tokens to unlock higher-tier tasks, earn staking rewards, and access exclusive benefits on Polygon.',
        images: ['/placeholder-logo.png'],
    },
};

export default function StakingPage() {
    return (
        <main className="min-h-screen bg-[#121212]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'Article',
                        headline: 'Stake PINN44 Tokens — Staking & Vesting',
                        description:
                            'Stake your PINN44 tokens to unlock higher-tier tasks, earn staking rewards, and access exclusive benefits. View and claim vested tokens as they unlock.',
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
                            '@id': 'https://the-big-picture.info/staking',
                        },
                        image: 'https://the-big-picture.info/placeholder-logo.png',
                        keywords: 'PINN44 staking, token vesting, crypto staking, Polygon staking, earn rewards',
                    }),
                }}
            />
            <Header />
            <div className="container mx-auto px-4 pt-28 pb-20">
                <div className="max-w-4xl mx-auto">
                    <h1
                        className="text-4xl font-bold text-center mb-3 text-gradient-purple-gold"
                        style={{ fontFamily: 'var(--font-heading)' }}
                    >
                        Staking & Vesting
                    </h1>
                    <p className="text-center text-foreground/50 mb-12 max-w-2xl mx-auto">
                        Stake your PINN44 tokens to access higher-tier tasks and earn staking rewards.
                        View and claim your vested tokens as they unlock.
                    </p>
                    <StakingVestingComponent />
                </div>
            </div>
            <Footer />
        </main>
    );
}
