import React from 'react';
import { Share2, ArrowDown } from 'lucide-react';
import { Reveal } from './Reveal';

export const SectionOne: React.FC = () => {
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'NOVA_AI',
          text: 'Today AI Aligns With Bold Dreams',
          url: window.location.href,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard');
    }
  };

  return (
    <section
      id="main"
      className="relative flex min-h-screen flex-col justify-end supports-[height:100svh]:min-h-[100svh]"
    >
      {/* Content row */}
      <div className="relative flex flex-col gap-10 px-5 pb-16 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:px-8 md:px-12 md:pb-20">
        {/* Left Column: Headline */}
        <h1 className="max-w-xl text-4xl font-medium uppercase leading-[1.05] tracking-tight text-white drop-shadow-lg sm:text-5xl md:text-6xl lg:text-7xl">
          <Reveal as="span" delay={100} className="block pl-6 sm:pl-12">
            Today AI
          </Reveal>
          <Reveal as="span" delay={220} className="block">
            Aligns <span className="normal-case italic font-light text-orange-400/90">with</span>
          </Reveal>
          <Reveal as="span" delay={340} className="block pl-10 sm:pl-20 text-white">
            <span className="text-[#F45A0A]">//</span> Bold
          </Reveal>
          <Reveal as="span" delay={460} className="block pl-16 sm:pl-32">
            Dreams
          </Reveal>
        </h1>

        {/* Right Column: Meta, Paragraph, CTA */}
        <div className="flex w-full max-w-xs flex-col items-start">
          <Reveal delay={400} className="w-full">
            <div className="mb-6 flex w-full items-center justify-between font-mono text-white sm:mb-8">
              <span className="text-lg font-bold text-orange-400">( A )</span>
              <span className="text-xs text-white/70">[ 001 /004 ]</span>
            </div>
          </Reveal>

          <Reveal delay={520}>
            <p className="mb-6 text-sm leading-relaxed text-white/85 drop-shadow-md sm:mb-8">
              NovaAI is where your bravest work finds its true expression. We hand you the means not
              only to form the future.
            </p>
          </Reveal>

          <Reveal delay={640} className="w-full">
            <a
              href="#contact"
              className="block w-full rounded-full border border-white/60 px-8 py-3 text-center font-mono text-xs uppercase tracking-[0.15em] text-white transition-all duration-300 hover:bg-[#F45A0A] hover:border-[#F45A0A] hover:text-white hover:shadow-[0_0_25px_rgba(244,90,10,0.5)] active:scale-[0.98]"
            >
              Begin Today
            </a>
          </Reveal>
        </div>
      </div>

      {/* Absolute Bottom-Left Share Button */}
      <div className="absolute bottom-5 left-5 z-20 sm:bottom-6 sm:left-8 md:left-12">
        <Reveal delay={760}>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share"
            className="flex items-center justify-center text-white/80 transition-colors duration-300 hover:text-[#F45A0A] cursor-pointer"
          >
            <Share2 size={18} />
          </button>
        </Reveal>
      </div>

      {/* Absolute Bottom-Center ArrowDown Bounce */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 sm:bottom-6 pointer-events-none">
        <Reveal delay={760}>
          <div className="animate-bounce text-white/80 hover:text-orange-400 transition-colors">
            <ArrowDown size={18} />
          </div>
        </Reveal>
      </div>
    </section>
  );
};
