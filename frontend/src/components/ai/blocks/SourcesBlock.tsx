import React from 'react';
import { IconExternalLink, IconWorldSearch } from '@tabler/icons-react';
import { CopilotCardShell, CopilotCardHeader } from './blockUtils.tsx';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
}

/**
 * Web-search citations. A generic table is the wrong shape for these: a raw URL
 * wraps over five lines and reads as noise. What matters is the site and the
 * headline — the full address only needs to be reachable, not displayed.
 */
export const SourcesBlock: React.FC<{ payload: any }> = ({ payload }) => {
  const items: Array<{ title?: string; url: string }> = (payload.items || payload.rows || []).filter(
    (s: any) => s?.url,
  );
  if (!items.length) return null;

  return (
    <CopilotCardShell>
      <CopilotCardHeader>{payload.title || 'مصادر حديثة'}</CopilotCardHeader>
      <ul className="divide-y divide-slate-100">
        {items.slice(0, 5).map((s, i) => (
          <li key={`${s.url}-${i}`}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#FFF7F0] transition-colors focus:outline-none focus-visible:bg-[#FFF3E8]"
            >
              <span className="shrink-0 w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 grid place-items-center text-slate-400 group-hover:border-orange-200 group-hover:text-[#F45A0A] transition-colors">
                <IconWorldSearch size={14} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] font-bold text-slate-800 truncate group-hover:text-[#C2410C]">
                  {s.title || hostOf(s.url)}
                </span>
                <span dir="ltr" className="block text-[10.5px] text-slate-400 truncate text-right">
                  {hostOf(s.url)}
                </span>
              </span>
              <IconExternalLink
                size={14}
                className="shrink-0 text-slate-300 group-hover:text-[#F45A0A] transition-colors"
              />
            </a>
          </li>
        ))}
      </ul>
    </CopilotCardShell>
  );
};
