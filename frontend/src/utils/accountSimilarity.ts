/**
 * Intelligent Arabic & English Account Similarity Matcher
 * Identifies exact matches, typos, common prefixes/suffixes, and similar account names in the database.
 */

export interface AccountCandidate {
  id: string;
  code?: string;
  nameAr: string;
  nameEn?: string;
  name?: string;
  type?: string;
  category?: string;
  balanceIQD?: number;
  balanceUSD?: number;
  phone?: string | null;
}

export interface SimilarAccountMatch {
  account: AccountCandidate;
  score: number; // 0 to 100 percentage
  matchReason: string;
}

/**
 * Normalizes Arabic and English text for robust linguistic comparison.
 */
export function normalizeAccountText(text: string): string {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic diacritics / tashkeel
    .replace(/ـ+/g, '') // remove tatweel / kashida
    .replace(/[أإآآ]/g, 'ا') // normalize Alef forms
    .replace(/ة/g, 'ه') // normalize Teh Marbuta
    .replace(/[ىي]/g, 'ي') // normalize Alef Maksura & Yeh
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ') // replace punctuation with spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips the Arabic definite article "ال" (al-) from the start of words if word length > 3.
 * e.g. "الاصدار" -> "اصدار", "الجديد" -> "جديد", "الطيران" -> "طيران"
 */
export function stripAlFromWord(word: string): string {
  if (!word || word.length <= 3) return word;
  if (word.startsWith('ال')) {
    return word.slice(2);
  }
  return word;
}

/**
 * Normalizes common variations and removes corporate noise words.
 */
export function stripCorporateNoise(text: string): string {
  const normalized = normalizeAccountText(text);
  return normalized
    .replace(/\b(شركه|شركة|مكتب|وكاله|وكالة|مجموعه|مجموعة|كروب|جروب|للسياحه والسفر|للسياحة والسفر|للسياحه|للسياحة|والسياحه|والسياحة|العامه|العامة|المحدوده|المحدودة|العالميه|العالمية|للتجاره|للطيران|خطوط|سياحه|سياحة|طيران|company|agency|travel|tourism|co|ltd|group|intl|international)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates Levenshtein Distance between two strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const a = s1;
  const b = s2;
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Checks if two Arabic words match, taking into account "ال" prefix and minor typos.
 */
function areWordsSimilar(w1: string, w2: string): boolean {
  if (w1 === w2) return true;
  const noAl1 = stripAlFromWord(w1);
  const noAl2 = stripAlFromWord(w2);
  if (noAl1 === noAl2) return true;

  // Check phonetic equivalences (e.g. سستم vs سيستم)
  const normPhonetic = (w: string) => w.replace(/ي/g, '').replace(/و/g, '');
  if (normPhonetic(noAl1) === normPhonetic(noAl2) && noAl1.length > 2) return true;

  const maxL = Math.max(noAl1.length, noAl2.length);
  if (maxL >= 4) {
    const dist = levenshteinDistance(noAl1, noAl2);
    if (dist <= 1) return true;
  }
  return false;
}

/**
 * Calculates similarity percentage (0-100) between two account names.
 */
export function calculateAccountSimilarity(rawInput: string, candidateName: string): { score: number; reason: string } {
  if (!rawInput || !candidateName) return { score: 0, reason: '' };

  const normInput = normalizeAccountText(rawInput);
  const normCandidate = normalizeAccountText(candidateName);

  // 1. Exact normalized match
  if (normInput === normCandidate) {
    return { score: 100, reason: 'تطابق تام في الاسم' };
  }

  const coreInput = stripCorporateNoise(rawInput);
  const coreCandidate = stripCorporateNoise(candidateName);

  // 2. Exact core brand match (ignoring "شركة", "وكالة", etc.)
  if (coreInput && coreCandidate && coreInput === coreCandidate) {
    return { score: 98, reason: 'تطابق الاسم التجاري الأساسي' };
  }

  // Extract word tokens and stripped "ال" tokens
  const wordsInput = (coreInput || normInput).split(' ').filter((w) => w.length > 1);
  const wordsCandidate = (coreCandidate || normCandidate).split(' ').filter((w) => w.length > 1);

  const cleanWordsInput = wordsInput.map(stripAlFromWord);
  const cleanWordsCandidate = wordsCandidate.map(stripAlFromWord);

  // 3. Compare stripped "ال" join string (e.g. "ماستر الاصدار جديد" vs "ماستر الاصدار الجديد")
  if (cleanWordsInput.join(' ') === cleanWordsCandidate.join(' ') && cleanWordsInput.length > 0) {
    return { score: 97, reason: 'تطابق الكلمات مع اختلاف أداة التعريف (ال)' };
  }

  // 4. Substring inclusion
  if (coreInput && coreCandidate) {
    if (normCandidate.includes(normInput) || normInput.includes(normCandidate)) {
      return { score: 92, reason: 'الاسم وارد بالكامل ضمن الحساب' };
    }
    if (coreCandidate.includes(coreInput) || coreInput.includes(coreCandidate)) {
      return { score: 90, reason: 'تطابق جزئي في الاسم التجاري' };
    }
  }

  // 5. Fuzzy Word-by-Word Matching
  if (wordsInput.length > 0 && wordsCandidate.length > 0) {
    let matchedInputCount = 0;
    const matchedWordsList: string[] = [];

    for (const wIn of wordsInput) {
      const foundMatch = wordsCandidate.some((wCan) => areWordsSimilar(wIn, wCan));
      if (foundMatch) {
        matchedInputCount++;
        matchedWordsList.push(wIn);
      }
    }

    const inputMatchRatio = matchedInputCount / wordsInput.length;
    const candidateMatchRatio = matchedInputCount / wordsCandidate.length;

    // All input words found in candidate (e.g. "سيستم فلاي" in "سيستم فلاي للسياحة والسفر")
    if (inputMatchRatio === 1.0) {
      return { score: 95, reason: `تطابق جميع كلمات البحث (${matchedWordsList.join('، ')})` };
    }

    // High proportion of matching words
    if (inputMatchRatio >= 0.65 || (matchedInputCount >= 2 && wordsInput.length <= 3)) {
      const score = Math.round(Math.max(inputMatchRatio, candidateMatchRatio) * 88);
      return { score: Math.max(score, 75), reason: `تشابه قوي في الكلمات (${matchedWordsList.join('، ')})` };
    }

    if (matchedInputCount >= 1 && wordsInput.length <= 2) {
      return { score: 65, reason: `تشابه في كلمة (${matchedWordsList.join('، ')})` };
    }
  }

  // 6. Levenshtein edit distance on core names
  const testA = coreInput || normInput;
  const testB = coreCandidate || normCandidate;
  const maxLen = Math.max(testA.length, testB.length);

  if (maxLen > 3) {
    const dist = levenshteinDistance(testA, testB);
    const ratio = (maxLen - dist) / maxLen;
    if (ratio >= 0.7) {
      const score = Math.round(ratio * 85);
      return { score, reason: 'تشابه إملائي متقارب جداً' };
    }
  }

  return { score: 0, reason: '' };
}

/**
 * Finds all similar candidate accounts from a list, sorted by similarity score descending.
 */
export function findSimilarAccounts(
  rawInput: string,
  candidates: AccountCandidate[],
  minScore: number = 35,
  maxResults: number = 8
): SimilarAccountMatch[] {
  if (!rawInput || !rawInput.trim() || !Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  const matches: SimilarAccountMatch[] = [];
  const seenIds = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate) continue;
    const candId = candidate.id || candidate.code || candidate.nameAr;
    if (seenIds.has(candId)) continue;

    const nameAr = candidate.nameAr || candidate.name || '';
    const nameEn = candidate.nameEn || '';

    const resAr = calculateAccountSimilarity(rawInput, nameAr);
    const resEn = nameEn ? calculateAccountSimilarity(rawInput, nameEn) : { score: 0, reason: '' };

    const best = resAr.score >= resEn.score ? resAr : resEn;

    if (best.score >= minScore) {
      seenIds.add(candId);
      matches.push({
        account: candidate,
        score: best.score,
        matchReason: best.reason,
      });
    }
  }

  // Sort highest similarity score first
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, maxResults);
}
