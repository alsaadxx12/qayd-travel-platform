import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const databaseUrl = PrismaService.normalizeDatabaseUrl(process.env.DATABASE_URL);
    super(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);
  }

  /**
   * تطبيع رابط القاعدة — الحماية من خطأ التهيئة لا انتظار وقوعه.
   *
   * مجمّع Supabase بوضع المعاملات (منفذ 6543) يوزّع الاستعلامات على اتصالات
   * خلفية متغيّرة، وPrisma بلا `pgbouncer=true` يستعمل جملاً محضّرة تلتصق
   * باتصال بعينه — فتظهر أخطاء 500 متقطعة («prepared statement already
   * exists») يمر بعض الطلبات وتسقط أخرى، وهو بالضبط ما وقع في الإنتاج حين
   * ضُبط المنفذ يدوياً دون الملحق. فمتى رأينا مجمّع المعاملات ألحقنا الملحق
   * بأنفسنا مهما كتب المشغّل، وضُبطت حدود التجمّع إن غابت.
   */
  private static normalizeDatabaseUrl(databaseUrl?: string): string | undefined {
    if (!databaseUrl) return databaseUrl;
    let url = databaseUrl;
    const sep = () => (url.includes('?') ? '&' : '?');

    const isTransactionPooler = url.includes('pooler.supabase.com:6543');
    if (isTransactionPooler && !url.includes('pgbouncer=')) {
      url = `${url}${sep()}pgbouncer=true`;
    }
    if (!url.includes('connection_limit=')) {
      const connectionLimit = process.env.PRISMA_CONNECTION_LIMIT || '15';
      const poolTimeout = process.env.PRISMA_POOL_TIMEOUT || '20';
      url = `${url}${sep()}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;
    }
    return url;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
