import Header from '@/components/header';
import Footer from '@/components/footer';
import { StakingVestingComponent } from '@/components/contracts';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Staking & Vesting | The Big Picture',
    description: 'Stake PINN44 tokens to unlock tier benefits and earn rewards. View and claim your vested tokens.',
    openGraph: {
        title: 'PINN44 Staking',
        description: 'Stake tokens for tier access and rewards',
        type: 'website',
    },
};

export default function StakingPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20">
            <Header />
            <div className="container mx-auto px-4 py-20">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl font-bold text-center mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        Staking & Vesting
                    </h1>
                    <p className="text-center text-gray-400 mb-12 max-w-2xl mx-auto">
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
