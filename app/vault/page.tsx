import dynamic from 'next/dynamic';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Metadata } from 'next';

const ContributorVaultComponent = dynamic(() =>
    import('@/components/contracts/ContributorVault').then((mod) => ({ default: mod.ContributorVaultComponent }))
);

export const metadata: Metadata = {
    title: 'Contributor Vault — Claim PINN44 Rewards | The Big Picture',
    description:
        'Track and claim your contributor rewards from The Big Picture blockchain film. Monitor locked and vested PINN44 tokens with instant and 90-day vesting schedules.',
    keywords: [
        'contributor rewards',
        'PINN44 vault',
        'token vesting',
        'claim rewards',
        'Polygon rewards',
        'The Big Picture',
    ],
    alternates: { canonical: 'https://the-big-picture.info/vault' },
    robots: { index: true, follow: true },
    openGraph: {
        siteName: 'The Big Picture',
        locale: 'en_US',
        type: 'website',
        title: 'Contributor Vault — Claim PINN44 Rewards',
        description:
            'Track and claim your contributor rewards from The Big Picture blockchain film. Monitor locked and vested PINN44 tokens.',
        url: 'https://the-big-picture.info/vault',
        images: [
            {
                url: '/placeholder-logo.png',
                width: 1200,
                height: 630,
                alt: 'Contributor Vault — PINN44 Rewards',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Contributor Vault — Claim PINN44 Rewards',
        description:
            'Track and claim your contributor rewards from The Big Picture blockchain film. Monitor locked and vested PINN44 tokens.',
        images: ['/placeholder-logo.png'],
    },
};

export default function VaultPage() {
    return (
        <main className="min-h-screen bg-[#121212]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'Article',
                        headline: 'Contributor Vault — Claim PINN44 Rewards',
                        description:
                            'Track and claim your contributor rewards from The Big Picture blockchain film. Monitor locked and vested PINN44 tokens with instant and 90-day vesting schedules.',
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
                            '@id': 'https://the-big-picture.info/vault',
                        },
                        image: 'https://the-big-picture.info/placeholder-logo.png',
                        keywords: 'contributor rewards, PINN44 vault, token vesting, claim rewards',
                    }),
                }}
            />
            <Header />
            <div className="container mx-auto px-4 pt-28 pb-20">
                <div className="max-w-4xl mx-auto">
                    <h1
                        className="text-4xl font-bold text-center mb-3 text-gradient-gold"
                        style={{ fontFamily: 'var(--font-heading)' }}
                    >
                        Contributor Vault
                    </h1>
                    <p className="text-center text-foreground/50 mb-12 max-w-2xl mx-auto">
                        Track your contributor earnings and claim unlocked rewards.
                        50% of rewards are available immediately, with 50% vested over 90 days.
                    </p>
                    <ContributorVaultComponent />
                </div>
            </div>
            <Footer />
        </main>
    );
}
