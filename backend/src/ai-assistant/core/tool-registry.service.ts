import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AiTool, AiToolProvider } from '../types/ai-tool.types';
import { EntityTools } from '../tools/entity.tools';
import { AccountingTools } from '../tools/accounting.tools';
import { OperationsTools } from '../tools/operations.tools';
import { AnalyticsTools } from '../tools/analytics.tools';
import { MetaTools } from '../tools/meta.tools';
import { StatementTools } from '../tools/statement.tools';
import { ReferenceTools } from '../tools/reference.tools';
import { DataTools } from '../tools/data.tools';
import { MemoryTools } from '../tools/memory.tools';
import { BriefTools } from '../tools/brief.tools';

@Injectable()
export class ToolRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, AiTool>();

  constructor(
    private readonly entityTools: EntityTools,
    private readonly accountingTools: AccountingTools,
    private readonly operationsTools: OperationsTools,
    private readonly analyticsTools: AnalyticsTools,
    private readonly metaTools: MetaTools,
    private readonly statementTools: StatementTools,
    private readonly referenceTools: ReferenceTools,
    private readonly dataTools: DataTools,
    private readonly memoryTools: MemoryTools,
    private readonly briefTools: BriefTools,
  ) {}

  onModuleInit() {
    const providers: AiToolProvider[] = [
      this.entityTools,
      this.accountingTools,
      this.operationsTools,
      this.analyticsTools,
      this.metaTools,
      this.statementTools,
      this.referenceTools,
      this.dataTools,
      this.memoryTools,
      this.briefTools,
    ];

    for (const provider of providers) {
      for (const tool of provider.getTools()) {
        if (this.tools.has(tool.name)) {
          this.logger.warn(`Duplicate AI tool name ignored: ${tool.name}`);
          continue;
        }
        this.tools.set(tool.name, tool);
      }
    }

    this.logger.log(`AI tool registry ready with ${this.tools.size} tools`);
  }

  getAll(): AiTool[] {
    return Array.from(this.tools.values());
  }

  get(name: string): AiTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}
