/**
 * خبيئة خادمية دقيقة — الحل الجذري لأرضية الـ550ms.
 *
 * قاعدة البيانات بعيدة عن الخادم، فكل استعلام يدفع زمن ذهاب وإياب كاملاً عبر
 * الإنترنت (~550ms مقيساً من فاحص الأداء) مهما كان الاستعلام تافهاً. والقوائم
 * الساخنة — السنوات المالية، الفروع، قوالب الطباعة، الإشعارات — تُطلب في كل
 * تحميل صفحة ولا تتغير إلا حين يكتب أحدهم فيها.
 *
 * فالمبدأ: النتيجة تُحفظ لثوانٍ معدودة، وأي كتابة في المنطقة نفسها تُسقطها
 * فوراً — فلا يظهر أثر البطء إلا في أول طلب بعد تغيّر حقيقي، وهو الطلب الوحيد
 * الذي يستحقه.
 *
 * والطلبات المتزامنة على المفتاح البارد نفسه تتقاسم وعداً واحداً بدل أن تنطلق
 * كلها إلى قاعدة البيانات معاً (dedupe) — وهو ما يحدث فعلاً عند فتح الواجهة
 * لأن شاشات عدة تطلب المورد نفسه في اللحظة نفسها.
 */
/**
 * التجديد الاستباقي: البرد لا يصادفه المستخدم بعد أول مرة.
 *
 * الخبيئة وحدها تنقل الكلفة من كل طلب إلى أول طلب بعد الانقضاء — لكن أول طلب
 * هذا يقع على مستخدم حقيقي، وتحميل صفحة بارد يُطلق عشر نقاط منقضية معاً
 * فيتزاحم كل شيء (متوسط 1129ms في تقرير الأداء). مع refreshAhead يُعاد حساب
 * المداخل المستعملة في الخلفية قبيل انقضائها، فتبقى دافئة ما دام أحد يقرؤها —
 * والذي لم يُقرأ عشر دقائق يُترك ينقضي بهدوء.
 */
const REFRESH_IDLE_MS = 10 * 60 * 1000;

export class MicroCache {
  private store = new Map<
    string,
    { at: number; value: unknown; compute?: () => Promise<unknown>; lastRead: number }
  >();
  private inFlight = new Map<string, Promise<unknown>>();
  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 2000,
    private readonly opts: { refreshAhead?: boolean } = {},
  ) {}

  private ensureRefreshTimer() {
    if (!this.opts.refreshAhead || this.refreshTimer) return;
    const interval = Math.max(5_000, Math.floor(this.ttlMs / 3));
    this.refreshTimer = setInterval(() => this.refreshDueEntries(), interval);
    // لا يُبقي المؤقتُ العمليةَ حيةً — الخبيئة خادمة لا سيدة.
    this.refreshTimer.unref?.();
  }

  private refreshDueEntries() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (!entry.compute) continue;
      if (now - entry.lastRead > REFRESH_IDLE_MS) continue;
      if (now - entry.at < this.ttlMs * 0.6) continue;
      if (this.inFlight.has(key)) continue;
      const promise = entry
        .compute()
        .then((value) => {
          const current = this.store.get(key);
          if (current) {
            current.value = value;
            current.at = Date.now();
          }
        })
        .catch(() => {
          /* فشل التجديد يُبقي القيمة القديمة حتى انقضائها الطبيعي — لا ضرر جديد. */
        })
        .finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, promise);
    }
  }

  async wrap<T>(key: string, compute: () => Promise<T>): Promise<T> {
    this.ensureRefreshTimer();
    const hit = this.store.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) {
      hit.lastRead = Date.now();
      return hit.value as T;
    }

    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = compute()
      .then((value) => {
        if (this.store.size >= this.maxEntries) {
          // أبسط إخلاء ممكن: الخبيئة صغيرة والـTTL قصير، فالدقة هنا ترف.
          this.store.clear();
        }
        this.store.set(key, { at: Date.now(), value, compute, lastRead: Date.now() });
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  /** يُسقط كل مفتاح يبدأ بالبادئة — وبلا بادئة يُفرغ الخبيئة كلها. */
  invalidate(prefix?: string) {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
