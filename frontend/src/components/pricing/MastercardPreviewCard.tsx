import React, { useState } from 'react';
import { Tooltip } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';

interface MastercardPreviewCardProps {
  cardHolder: string;
  cardNumber: string;
  bankName?: string;
  expiryDate?: string;
  cardType?: string;
  instructions?: string;
  allowCopy?: boolean;
}

export const MastercardPreviewCard: React.FC<MastercardPreviewCardProps> = ({
  cardHolder = 'AZIZ KHAMEES SEDEQ',
  cardNumber = '5826553934',
  bankName = 'مصرف الرافدين',
  expiryDate = '12/28',
  cardType = 'Qi Card Mastercard',
  instructions,
  allowCopy = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(cardNumber.replace(/\s+/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3 font-sans" dir="rtl">
      {/* ── 100% Programmatic Vector Designed Qi Card (No static background images) ── */}
      <div className="relative w-full max-w-[390px] h-[235px] mx-auto rounded-[24px] overflow-hidden shadow-2xl border border-emerald-500/50 select-none group bg-gradient-to-br from-[#0c4e2b] via-[#157a44] to-[#0a3f22] p-5 flex flex-col justify-between text-white ring-1 ring-emerald-400/20">
        {/* Vector Background Graphic: SVG World Map / Globe Wireframe Watermark */}
        <svg
          className="absolute -right-8 -bottom-12 w-[340px] h-[340px] opacity-[0.18] pointer-events-none text-emerald-200"
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
        >
          {/* Globe Outline & Latitudes/Longitudes */}
          <circle cx="50" cy="50" r="46" strokeWidth="1.2" />
          <ellipse cx="50" cy="50" rx="46" ry="18" />
          <ellipse cx="50" cy="50" rx="46" ry="34" />
          <ellipse cx="50" cy="50" rx="18" ry="46" />
          <ellipse cx="50" cy="50" rx="34" ry="46" />
          <line x1="4" y1="50" x2="96" y2="50" strokeDasharray="1 1" />
          <line x1="50" y1="4" x2="50" y2="96" strokeDasharray="1 1" />
        </svg>

        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-emerald-400/10 blur-xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-teal-400/10 blur-xl pointer-events-none" />

        {/* ── TOP ROW ── */}
        <div className="flex items-start justify-between z-10">
          {/* Top-Left: Vector Qi Card "Q" Logo & Chip */}
          <div className="space-y-2">
            {/* Qi Yellow Logo */}
            <div className="flex items-center gap-1">
              <svg className="w-11 h-11" viewBox="0 0 100 100" fill="none">
                {/* Yellow Ring */}
                <circle cx="50" cy="46" r="32" stroke="#FACC15" strokeWidth="13" />
                {/* Yellow diagonal stroke through bottom right */}
                <line x1="46" y1="42" x2="78" y2="76" stroke="#FACC15" strokeWidth="13" strokeLinecap="round" />
                <circle cx="50" cy="46" r="14" fill="#0c4e2b" />
              </svg>
            </div>

            {/* Smart EMV Gold Metallic Chip */}
            <div className="w-12 h-9 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300 shadow-md relative overflow-hidden flex items-center justify-center">
              <div className="w-full h-[1px] bg-amber-900/40 absolute top-3" />
              <div className="w-full h-[1px] bg-amber-900/40 absolute bottom-3" />
              <div className="h-full w-[1px] bg-amber-900/40 absolute left-4" />
              <div className="h-full w-[1px] bg-amber-900/40 absolute right-4" />
              <div className="w-2.5 h-2.5 rounded-full border border-amber-900/50" />
            </div>
          </div>

          {/* Top-Right: Rafidain Bank Emblem & Waves */}
          <div className="flex flex-col items-end space-y-1.5">
            {/* Bank Emblem */}
            <div className="flex items-center gap-2 bg-emerald-950/40 backdrop-blur-xs px-2.5 py-1 rounded-xl border border-emerald-400/20">
              <div className="text-right">
                <span className="text-[12px] font-black text-white block leading-tight">
                  {bankName || 'مصرف الرافدين'}
                </span>
                <span className="text-[8px] font-mono text-emerald-200 tracking-wider block font-bold">
                  RAFIDAIN BANK
                </span>
              </div>
              <div className="w-7 h-7 rounded-full border border-emerald-300/60 flex items-center justify-center p-0.5">
                <svg className="w-5 h-5 text-emerald-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v10M9 10l3-3 3 3M9 14l3 3 3-3" />
                </svg>
              </div>
            </div>

            {/* Contactless Waves */}
            <div className="flex items-center gap-1 pr-1 opacity-90">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 4a14 14 0 0 1 0 16" />
                <path d="M8.5 7a9.5 9.5 0 0 1 0 10" />
                <path d="M5 10a5 5 0 0 1 0 4" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── BOTTOM ROW: DYNAMIC USER DATA & MASTERCARD LOGO ── */}
        <div className="flex items-end justify-between z-10 pt-2">
          {/* Cardholder Name & Account Number (Pure Dynamic Text) */}
          <div className="text-left select-text space-y-0.5" dir="ltr">
            {/* Dynamic Name */}
            <div className="font-sans font-black text-[16px] text-white tracking-wider uppercase leading-tight drop-shadow-md">
              {cardHolder || 'AZIZ KHAMEES SEDEQ'}
            </div>

            {/* Dynamic Account Number */}
            <div className="font-mono font-bold text-[18px] text-emerald-100 tracking-[0.14em] leading-tight drop-shadow-md">
              {cardNumber || '5826553934'}
            </div>
          </div>

          {/* Bottom Right: Copy Button & Mastercard Logo */}
          <div className="flex flex-col items-end space-y-2">
            {allowCopy && (
              <Tooltip label={copied ? 'تم النسخ بنجاح!' : 'نسخ رقم الحساب'} withArrow position="top">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-0.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 active:scale-95 transition-all text-[11px] font-bold text-emerald-200 border border-emerald-400/30 flex items-center gap-1 cursor-pointer shadow-sm"
                >
                  {copied ? <IconCheck size={12} className="text-emerald-400" /> : <IconCopy size={12} />}
                  <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </Tooltip>
            )}

            {/* Authentic Mastercard Dual Circles */}
            <div className="flex items-center shrink-0">
              <div className="w-8 h-8 rounded-full bg-[#EB001B] shadow-md" />
              <div className="w-8 h-8 rounded-full bg-[#F79E1B] -ml-3.5 shadow-md mix-blend-screen" />
            </div>
          </div>
        </div>
      </div>

      {/* Instructions Box Below Card */}
      {instructions && (
        <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-medium leading-relaxed max-w-[390px] mx-auto text-center shadow-2xs">
          {instructions}
        </div>
      )}
    </div>
  );
};

export default MastercardPreviewCard;
