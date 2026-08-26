import { Module } from '@nestjs/common';
import { AIAssistantService } from './ai-assistant.service';
import { AIAssistantController } from './ai-assistant.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountsModule } from '../accounts/accounts.module';
import { ReportsModule } from '../reports/reports.module';
import { JournalEntriesModule } from '../journal-entries/journal-entries.module';
import { CashboxesBanksModule } from '../cashboxes-banks/cashboxes-banks.module';
import { PdfModule } from '../pdf/pdf.module';
import { EmailModule } from '../email/email.module';
import { ToolRegistryService } from './core/tool-registry.service';
import { LlmProviderService } from './core/llm-provider.service';
import { AiPermissionService } from './core/ai-permission.service';
import { ContextBuilderService } from './core/context-builder.service';
import { SystemKnowledgeService } from './core/system-knowledge.service';
import { ConversationService } from './core/conversation.service';
import { ConversationMemoryService } from './core/conversation-memory.service';
import { LearningService } from './core/learning.service';
import { AiAuditService } from './core/ai-audit.service';
import { AiOrchestratorService } from './core/ai-orchestrator.service';
import { StatementArtifactService } from './core/statement-artifact.service';
import { EntityTools } from './tools/entity.tools';
import { AccountingTools } from './tools/accounting.tools';
import { OperationsTools } from './tools/operations.tools';
import { AnalyticsTools } from './tools/analytics.tools';
import { MetaTools } from './tools/meta.tools';
import { StatementTools } from './tools/statement.tools';
import { AiBillingService } from './core/ai-billing.service';

@Module({
  imports: [
    PrismaModule,
    AccountsModule,
    ReportsModule,
    JournalEntriesModule,
    CashboxesBanksModule,
    PdfModule,
    EmailModule,
  ],
  controllers: [AIAssistantController],
  providers: [
    AIAssistantService,
    ToolRegistryService,
    LlmProviderService,
    AiBillingService,
    AiPermissionService,
    ContextBuilderService,
    SystemKnowledgeService,
    ConversationService,
    ConversationMemoryService,
    LearningService,
    AiAuditService,
    StatementArtifactService,
    AiOrchestratorService,
    EntityTools,
    AccountingTools,
    OperationsTools,
    AnalyticsTools,
    MetaTools,
    StatementTools,
  ],
  exports: [AIAssistantService],
})
export class AIAssistantModule {}
