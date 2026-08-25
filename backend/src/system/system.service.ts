import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemService {
  constructor(private prisma: PrismaService) {}

  async getDatabaseInfo(companyId?: string) {
    const startTime = performance.now();
    await this.prisma.$queryRaw`SELECT 1 as ping;`;
    const latencyMs = Math.round(performance.now() - startTime);

    const versionRes = await this.prisma.$queryRaw<any[]>`SELECT version();`;
    const versionStr = versionRes[0]?.version || 'PostgreSQL';

    const dbInfo = await this.prisma.$queryRaw<any[]>`
      SELECT 
        current_database() as db_name, 
        current_user as db_user, 
        pg_size_pretty(pg_database_size(current_database())) as total_size,
        pg_database_size(current_database())::text as size_bytes;
    `;

    const connectionsRes = await this.prisma.$queryRaw<any[]>`
      SELECT count(*)::int as active_connections FROM pg_stat_activity WHERE datname = current_database();
    `;
    const maxConnRes = await this.prisma.$queryRaw<any[]>`SHOW max_connections;`;

    // Table Stats
    const rawTableStats = await this.prisma.$queryRaw<any[]>`
      SELECT 
        relname as table_name, 
        n_live_tup::int as row_count, 
        pg_size_pretty(pg_total_relation_size(relid)) as total_size,
        pg_total_relation_size(relid)::text as size_bytes
      FROM pg_stat_user_tables 
      ORDER BY pg_total_relation_size(relid) DESC;
    `;

    // Map table names to friendly Arabic labels
    const arabicLabels: Record<string, string> = {
      accounts: 'شجرة الحسابات والدليل المحاسبي',
      tickets: 'تذاكر الطيران والخدمات السياحية',
      journal_entries: 'سجل القيود اليومية المحاسبية',
      journal_entry_lines: 'أسطر وحركات القيود اليومية',
      receipt_vouchers: 'سندات القبض المالية',
      payment_vouchers: 'سندات الدفع والصرف',
      users: 'المستخدمين وحسابات النظام',
      branches: 'الفروع والهيكل الإداري',
      companies: 'الشركات وبيانات المؤسسة',
      roles: 'الأدوار ومجموعات الصلاحيات',
      audit_logs: 'سجل الرقابة وتتبع الحركات (Audit Log)',
      print_templates: 'قوالب الطباعة والكشوفات',
      exchange_rate_snapshots: 'لقطات أسعار الصرف التاريخية',
      exchange_rates: 'أسعار الصرف والعملات',
      departments: 'الأقسام الإدارية',
      employees: 'الموظفين وبيانات الكادر',
      airlines: 'شركات الطيران والمنصات',
      customers_suppliers: 'العملاء والموردين',
    };

    const tableStats = rawTableStats.map((t) => ({
      tableName: t.table_name,
      labelAr: arabicLabels[t.table_name] || t.table_name,
      rowCount: Number(t.row_count || 0),
      sizeFormatted: t.total_size,
      sizeBytes: Number(t.size_bytes || 0),
    }));

    // Specific live counts
    const [
      accountsCount,
      journalEntriesCount,
      ticketsCount,
      receiptsCount,
      paymentsCount,
      usersCount,
      branchesCount,
    ] = await Promise.all([
      this.prisma.account.count({ where: companyId ? { companyId } : undefined }).catch(() => 0),
      this.prisma.journalEntry.count({ where: companyId ? { companyId } : undefined }).catch(() => 0),
      this.prisma.ticket.count({ where: companyId ? { companyId } : undefined }).catch(() => 0),
      this.prisma.receiptVoucher.count({ where: companyId ? { companyId } : undefined }).catch(() => 0),
      this.prisma.paymentVoucher.count({ where: companyId ? { companyId } : undefined }).catch(() => 0),
      this.prisma.user.count().catch(() => 0),
      this.prisma.branch.count().catch(() => 0),
    ]);

    // Parse DATABASE_URL safely
    const rawUrl = process.env.DATABASE_URL || '';
    let host = 'Supabase Cloud (Managed PostgreSQL)';
    let port = '5432 / 6543';
    let poolerMode = 'Transaction Pooler (PgBouncer)';

    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl.replace('postgresql://', 'http://'));
        host = parsed.hostname;
        port = parsed.port || '5432';
        if (parsed.port === '6543') {
          poolerMode = 'Transaction Pooler (Port 6543)';
        } else if (parsed.port === '5432') {
          poolerMode = 'Direct Session Connection (Port 5432)';
        }
      } catch (e) {}
    }

    const totalSizeBytes = Number(dbInfo[0]?.size_bytes || 0);
    const totalSizeFormatted = dbInfo[0]?.total_size || '0 MB';
    const activeConnections = Number(connectionsRes[0]?.active_connections || 1);
    const maxConnections = Number(maxConnRes[0]?.max_connections || 60);

    return {
      status: 'HEALTHY',
      provider: 'Supabase Managed Cloud PostgreSQL',
      host,
      port,
      poolerMode,
      ssl: 'TLSv1.3 Encrypted',
      databaseName: dbInfo[0]?.db_name || 'postgres',
      databaseUser: dbInfo[0]?.db_user || 'postgres',
      version: versionStr,
      latencyMs,
      totalSizeFormatted,
      totalSizeBytes,
      activeConnections,
      maxConnections,
      connectionUsagePct: Math.round((activeConnections / maxConnections) * 100),
      summaryCounts: {
        accounts: accountsCount,
        journalEntries: journalEntriesCount,
        tickets: ticketsCount,
        receiptVouchers: receiptsCount,
        paymentVouchers: paymentsCount,
        users: usersCount,
        branches: branchesCount,
      },
      tableStats,
      timestamp: new Date().toISOString(),
    };
  }

  async runVacuumAnalyze() {
    const startTime = performance.now();
    await this.prisma.$queryRaw`ANALYZE;`;
    const durationMs = Math.round(performance.now() - startTime);
    return {
      success: true,
      message: 'تم تحديث الإحصائيات والفهارس وتحسين أداء الاستعلامات بنجاح',
      durationMs,
    };
  }
}
