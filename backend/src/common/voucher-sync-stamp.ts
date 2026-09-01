/**
 * ختم مزامنة السندات — الردّ على استطلاع «آخر تعديل» من الذاكرة لا من القاعدة.
 *
 * الواجهة تستطلع `/receipt-vouchers/last-modified` كل 3 ثوانٍ من كل جلسة
 * مفتوحة، وكان كل استطلاع ثلاث رحلات متوازية إلى قاعدة بيانات بعيدة
 * (~650ms وسطياً في فاحص الأداء) — أي حِمل دائم يتزايد بعدد الجلسات دون أن
 * يتغيّر شيء غالباً.
 *
 * المبدأ: الختم المحسوب يُحفظ هنا لمدة تحقّق، وكل كتابة سند — قبضاً أو دفعاً —
 * تُسقطه فوراً، فيُعاد حسابه في الاستطلاع التالي (≤3s) ويصل التغيير إلى بقية
 * الأجهزة بالسرعة نفسها التي صُمّم لها الاستطلاع. وبين الكتابات تُخدم آلاف
 * الاستطلاعات من الذاكرة بلا أي رحلة.
 *
 * المقايضة المصرَّح بها: كتابةٌ لا تمرّ بهذا الخادم (تعديل مباشر في القاعدة،
 * أو نسخة خادم ثانية) تظهر خلال مهلة إعادة التحقق لا فوراً — 60 ثانية، وهي
 * مقبولة لنشرٍ بنسخة واحدة كهذا النظام.
 */
const VERIFY_TTL_MS = 60_000;

type Stamp = { count: number; lastModified: string | null; hash: string };
const stamps = new Map<string, { at: number; stamp: Stamp }>();

export const voucherSyncStamp = {
  get(companyId: string): Stamp | null {
    const hit = stamps.get(companyId);
    if (hit && Date.now() - hit.at < VERIFY_TTL_MS) return hit.stamp;
    return null;
  },

  set(companyId: string, stamp: Stamp) {
    stamps.set(companyId, { at: Date.now(), stamp });
  },

  /** تُستدعى من كل كتابة سند قبضٍ أو دفعٍ — فيتجدد الختم في الاستطلاع التالي. */
  invalidate(companyId?: string) {
    if (companyId) stamps.delete(companyId);
    else stamps.clear();
  },
};
