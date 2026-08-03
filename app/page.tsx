import { Navigation } from "@/components/landing/navigation";
import { HeroSection, IntroPanel } from "@/components/landing/hero-section";
import { MetricsStrip } from "@/components/landing/metrics-strip";
import { ProblemSection } from "@/components/landing/problem-section";
import { SolutionSection } from "@/components/landing/solution-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FooterSection } from "@/components/landing/footer-section";
import { ScrollProgress } from "@/components/landing/scroll-progress";
import { PageLoader } from "@/components/landing/page-loader";
import { WaveChangelog } from "@/components/changelog/WaveChangelog";

export default function Home() {
  return (
    <>
      <PageLoader />
      <main className="relative min-h-screen overflow-x-hidden noise-overlay">
        <ScrollProgress />
        <Navigation />
        <HeroSection />
        <MetricsStrip />
        <IntroPanel />
        <ProblemSection />
        <SolutionSection />
        <FeaturesSection />
        <HowItWorksSection />
        <CtaSection />
        <FooterSection />
      </main>
    </>
  );
}
