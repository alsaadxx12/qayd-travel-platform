import { useState, useEffect, useCallback } from 'react';

/**
 * Available Arabic font families for the application.
 * All fonts are loaded from Google Fonts in index.html.
 */
export const FONT_OPTIONS = [
  {
    id: 'ibm-plex',
    name: 'IBM Plex Sans Arabic',
    family: "'IBM Plex Sans Arabic', 'Segoe UI', system-ui, sans-serif",
    label: 'IBM Plex Sans Arabic (المعتمد)',
    description: 'خط تقني فخم واحترافي بجميع أوزانه — الأنسب للمحاسبة والبيانات',
    sampleWeight: '700',
  },
  {
    id: 'alexandria',
    name: 'Alexandria',
    family: "'Alexandria', 'Segoe UI', system-ui, sans-serif",
    label: 'Alexandria (الإسكندرية)',
    description: 'خط هندسي حديث وأنيق جداً للواجهات المالية',
    sampleWeight: '700',
  },
  {
    id: 'noto-kufi',
    name: 'Noto Kufi Arabic',
    family: "'Noto Kufi Arabic', 'Segoe UI', system-ui, sans-serif",
    label: 'Noto Kufi Arabic',
    description: 'خط كوفي عصري — حاد وواضح',
    sampleWeight: '700',
  },
  {
    id: 'tajawal',
    name: 'Tajawal',
    family: "'Tajawal', 'Segoe UI', system-ui, sans-serif",
    label: 'Tajawal',
    description: 'خط عربي رفيع وأنيق للمستندات الرسمية',
    sampleWeight: '700',
  },
  {
    id: 'cairo',
    name: 'Cairo',
    family: "'Cairo', 'Segoe UI', system-ui, sans-serif",
    label: 'Cairo',
    description: 'خط عربي دارج وشائع القراءة',
    sampleWeight: '700',
  },
  {
    id: 'readex-pro',
    name: 'Readex Pro',
    family: "'Readex Pro', 'Segoe UI', system-ui, sans-serif",
    label: 'Readex Pro',
    description: 'خط حديث واضح ومريح للعين',
    sampleWeight: '600',
  },
  {
    id: 'rubik',
    name: 'Rubik',
    family: "'Rubik', 'Segoe UI', system-ui, sans-serif",
    label: 'Rubik',
    description: 'خط مستدير ودافئ للواجهات السريعة',
    sampleWeight: '700',
  },
  {
    id: 'inter',
    name: 'Inter',
    family: "'Inter', 'IBM Plex Sans Arabic', system-ui, sans-serif",
    label: 'Inter (Western / Numbers)',
    description: 'خط دولي للأرقام والجداول الدقيقة',
    sampleWeight: '700',
  },
] as const;

export type FontId = typeof FONT_OPTIONS[number]['id'];

const STORAGE_KEY = 'codescope-font-id';
const DEFAULT_FONT: FontId = 'ibm-plex';

/**
 * Hook to manage the application font with localStorage persistence.
 */
export function useFont() {
  const [fontId, setFontIdState] = useState<FontId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && FONT_OPTIONS.some(f => f.id === saved)) {
      return saved as FontId;
    }
    return DEFAULT_FONT;
  });

  const currentFont = FONT_OPTIONS.find(f => f.id === fontId) || FONT_OPTIONS[0];

  // Apply font to document
  useEffect(() => {
    document.documentElement.style.setProperty('--font-arabic', currentFont.family);
    document.body.style.fontFamily = currentFont.family;
    localStorage.setItem(STORAGE_KEY, fontId);
  }, [fontId, currentFont.family]);

  const setFontId = useCallback((id: FontId) => {
    setFontIdState(id);
  }, []);

  return {
    fontId,
    setFontId,
    currentFont,
    fonts: FONT_OPTIONS,
  };
}
