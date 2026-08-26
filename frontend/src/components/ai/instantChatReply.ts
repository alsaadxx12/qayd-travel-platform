export function instantChatReply(question: string, locale: 'ar' | 'en' = 'ar'): string | null {
  const q = (question || '').replace(/[\s!؟?.،,~]+$/g, '').trim();
  if (!q || q.length > 48) return null;
  const ar = locale !== 'en';

  if (
    /^(مرحبا|مرحباً|مرحباا+|اهلا|أهلا|أهلاً|اهلاً|السلام عليكم|سلام عليكم|السلام|سلام|hi+|hello|hey|yo|صباح الخير|مساء الخير)$/i.test(
      q,
    )
  ) {
    return ar ? 'مرحباً، تفضل. كيف أساعدك؟' : 'Hello — how can I help?';
  }
  if (/^(كيفك|شلونك|شلونكم|كيف حالك|how are you)$/i.test(q)) {
    return ar ? 'بخير، شكراً. ماذا تريد أن نراجع في النظام؟' : 'Doing well. What should we look up?';
  }
  if (/^(شكرا|شكرًا|شكراً|تسلم|مشكور|thanks|thank you|thx)$/i.test(q)) {
    return ar ? 'العفو. إذا احتجت شيئاً آخر أنا هنا.' : 'You are welcome.';
  }
  if (/^(تمام|زين|حسنا|حسناً|حسنًا|ok+|okay|done)$/i.test(q)) {
    return ar ? 'حاضر. أرسل سؤالك متى شئت.' : 'Ready when you are.';
  }
  return null;
}
