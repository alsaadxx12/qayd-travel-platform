import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from './Reveal';

const navItems = [
  { label: 'main', href: '#main' },
  { label: 'tiers', href: '#tiers' },
  { label: 'features', href: '#features' },
  { label: 'talk to us', href: '#contact' },
];

export const Navbar: React.FC = () => {
  return (
    <header className="pointer-events-none select-none">
      {/* Top-Left Brand Corner */}
      <div className="fixed left-5 top-5 z-50 sm:left-8 sm:top-7 md:left-12 pointer-events-auto">
        <Reveal>
          <a
            href="#main"
            className="font-mono text-lg font-medium tracking-tight text-white drop-shadow-md transition-colors duration-300 hover:text-[#F45A0A] sm:text-xl md:text-2xl flex items-center gap-1"
          >
            <span>(NOVA_AI)</span>
          </a>
        </Reveal>

        <Reveal delay={150}>
          <div className="mt-6 font-mono text-[10px] text-white/60 sm:mt-8 sm:text-xs">
            <span className="hover:text-orange-400 transition-colors">[ v.01b ]</span>
          </div>
        </Reveal>
      </div>

      {/* Top-Right Navigation Corner */}
      <nav
        aria-label="Main Navigation"
        className="fixed right-5 top-5 z-50 sm:right-8 sm:top-7 md:right-12 pointer-events-auto"
      >
        <ul className="flex flex-col items-end gap-1.5 sm:gap-2">
          {navItems.map((item, i) => (
            <li key={item.label}>
              <Reveal delay={100 + i * 120}>
                <a
                  href={item.href}
                  className="group flex items-center gap-1 font-mono text-xs text-white/80 drop-shadow-md transition-colors duration-300 hover:text-white sm:text-sm hover:text-[#F45A0A]"
                >
                  <span>{item.label}</span>
                  <ArrowUpRight
                    size={14}
                    className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#F45A0A]"
                  />
                </a>
              </Reveal>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
};
