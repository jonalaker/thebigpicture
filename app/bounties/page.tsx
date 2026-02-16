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
                    <p className="text-center text-foreground/50 mb-12 max-w-2xl mx-auto">
                        Browse available tasks and submit your work to earn PINN44 tokens.
                        Upload files via IPFS and compete for rewards.
                    </p>
                    <WorkSubmissionComponent />
                </div>
            </div>
            <Footer />
        </main>
    );
}
