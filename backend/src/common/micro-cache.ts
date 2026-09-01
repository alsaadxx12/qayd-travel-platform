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
export class MicroCache {
  private store = new Map<string, { at: number; value: unknown }>();
  private inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 2000,
  ) {}

  async wrap<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) {
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
        this.store.set(key, { at: Date.now(), value });
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
