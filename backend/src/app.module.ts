import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { JournalEntriesModule } from './journal-entries/journal-entries.module';
import { ReceiptVouchersModule } from './receipt-vouchers/receipt-vouchers.module';
import { PaymentVouchersModule } from './payment-vouchers/payment-vouchers.module';
import { VouchersModule } from './vouchers/vouchers.module';
import { CashboxesBanksModule } from './cashboxes-banks/cashboxes-banks.module';
import { CustomersSuppliersModule } from './customers-suppliers/customers-suppliers.module';
import { ReportsModule } from './reports/reports.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { BranchesModule } from './branches/branches.module';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module';
import { SmartParserModule } from './smart-parser/smart-parser.module';
import { AirlinesModule } from './airlines/airlines.module';
import { EmployeesModule } from './employees/employees.module';
import { RolesModule } from './roles/roles.module';
import { TicketsModule } from './tickets/tickets.module';
import { DepartmentsModule } from './departments/departments.module';
import { PrintTemplatesModule } from './print-templates/print-templates.module';
import { SequencesModule } from './sequences/sequences.module';
import { PdfModule } from './pdf/pdf.module';
import { SystemModule } from './system/system.module';
import { EmailModule } from './email/email.module';
import { FiscalYearsModule } from './fiscal-years/fiscal-years.module';
import { TenantsModule } from './tenants/tenants.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FeedbackModule } from './feedback/feedback.module';
import { AIAssistantModule } from './ai-assistant/ai-assistant.module';
import { StatementPortalModule } from './statement-portal/statement-portal.module';

@Module({
  imports: [
    PrismaModule,
    TenantsModule,
    SubscriptionsModule,
    NotificationsModule,
    FeedbackModule,
    AIAssistantModule,
    AuthModule,
    AccountsModule,
    JournalEntriesModule,
    ReceiptVouchersModule,
    PaymentVouchersModule,
    VouchersModule,
    CashboxesBanksModule,
    CustomersSuppliersModule,
    ReportsModule,
    AuditLogsModule,
    BranchesModule,
    ExchangeRateModule,
    SmartParserModule,
    AirlinesModule,
    EmployeesModule,
    RolesModule,
    TicketsModule,
    DepartmentsModule,
    PrintTemplatesModule,
    SequencesModule,
    PdfModule,
    SystemModule,
    EmailModule,
    FiscalYearsModule,
    StatementPortalModule,
  ],
})
export class AppModule {}
