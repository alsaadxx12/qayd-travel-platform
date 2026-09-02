import React, { useEffect } from 'react';
import { ScrollVideo } from '../components/nova/ScrollVideo';
import { Navbar } from '../components/nova/Navbar';
import { SectionOne } from '../components/nova/SectionOne';
import { SectionTwo } from '../components/nova/SectionTwo';

export const NovaAiLandingPage: React.FC = () => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'NOVA_AI — Today AI Aligns With Bold Dreams';
    return () => {
      document.title = prevTitle;
    };
  }, []);

  return (
    <div
      className="relative nova-ai-root min-h-screen bg-transparent text-white selection:bg-[#F45A0A]/40 overflow-x-hidden font-sans"
      dir="ltr"
    >
      <ScrollVideo />
      <Navbar />
      <main className="relative z-10">
        <SectionOne />
        <div aria-hidden className="h-[80vh]" />
        <SectionTwo />
      </main>
    </div>
  );
};
