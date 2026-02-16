import Header from '@/components/header';
import Footer from '@/components/footer';
import { ContributorVaultComponent } from '@/components/contracts';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Contributor Vault | The Big Picture',
    description: 'View and claim your contributor rewards. Track your locked and vested PINN44 tokens.',
    openGraph: {
        title: 'Contributor Vault',
        description: 'View and claim your rewards',
        type: 'website',
    },
};

export default function VaultPage() {
    return (
        <main className="min-h-screen bg-[#121212]">
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
