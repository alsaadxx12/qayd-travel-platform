/**
 * مصدرٌ واحد لسرّ التوقيع.
 *
 * القيمة الاحتياطية القديمة كانت مكتوبة في الكود — والمستودع عام — فكل من قرأها
 * يستطيع صياغة توكن مدير صالح. القاعدة الآن: سرٌّ من البيئة أو لا إقلاع، ولا
 * يُسمح بسرّ التطوير غير الآمن إلا حيث أُعلن تجاوز التطوير صراحةً.
 */
export function requireJwtSecret(): string {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (secret) return secret;
  if (process.env.ALLOW_DEV_BYPASS === 'true') return 'dev-only-insecure-secret';
  throw new Error(
    'JWT_SECRET غير مضبوط. أضِف متغير البيئة JWT_SECRET بقيمة عشوائية طويلة قبل تشغيل الخادم.',
  );
}
