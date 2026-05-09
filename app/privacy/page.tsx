import { PrivacyHero } from "@/components/privacy/privacy-hero";
import { ArchitectureOverview } from "@/components/privacy/architecture-overview";
import { FHEPrimitives } from "@/components/privacy/fhe-primitives";
import { EncryptedFlow } from "@/components/privacy/encrypted-flow";
import { StateManagement } from "@/components/privacy/state-management";
import { CallbackSystem } from "@/components/privacy/callback-system";
import { UseCases } from "@/components/privacy/use-cases";
import { TechnicalSpecs } from "@/components/privacy/technical-specs";
import { ScrollProgress } from "@/components/landing/scroll-progress";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Architecture - Walnut Protocol',
  description: 'Deep dive into Walnut\'s confidential lending infrastructure powered by Fhenix CoFHE and Fully Homomorphic Encryption.',
};

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen bg-[#FAFAFA] text-gray-900 overflow-hidden">
      {/* Noise texture overlay */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none z-50"
           style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}
      />
      
      {/* Animated grid background */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
        <div className="absolute inset-0"
             style={{
               backgroundImage: 'linear-gradient(to right, rgba(10, 217, 220, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(10, 217, 220, 0.3) 1px, transparent 1px)',
               backgroundSize: '80px 80px',
             }}
        />
      </div>

      <ScrollProgress />
      
      <PrivacyHero />
      <ArchitectureOverview />
      <FHEPrimitives />
      <EncryptedFlow />
      <StateManagement />
      <CallbackSystem />
      <UseCases />
      <TechnicalSpecs />
    </main>
  );
}
