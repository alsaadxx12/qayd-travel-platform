import { Injectable } from '@nestjs/common';
import { AiMemoryEntry, AiToolResult } from '../types/ai-tool.types';

/**
 * Pulls resolved entities out of tool results so follow-up questions
 * ("اعرض آخر خمس حركات") can reuse the same account/ticket without asking again.
 */
@Injectable()
export class ConversationMemoryService {
  fromToolResult(toolName: string, result: AiToolResult): AiMemoryEntry[] {
    if (!result?.ok || !result.data) return [];
    const entries: AiMemoryEntry[] = [];
    const data = result.data;

    const push = (kind: string, id?: string, label?: string, extra?: Record<string, any>) => {
      if (!id || !label) return;
      entries.push({ kind, id, label, extra });
    };

    if (toolName === 'searchEntity') {
      if (data.exact && data.match) {
        push(data.match.kind, data.match.id, data.match.label, { accountId: data.match.accountId });
      }
    }

    if (toolName === 'exportAccountStatementPdf' || toolName === 'emailAccountStatement') {
      if (data.account?.id) {
        push('account', data.account.id, data.account.name || data.account.nameAr, { accountId: data.account.id });
      }
    }

    if (data.account?.id) {
      push('account', data.account.id, data.account.name || data.account.nameAr, { code: data.account.code });
    }

    if (data.ticket?.id) {
      push('ticket', data.ticket.id, data.ticket.invoiceNumber || data.ticket.pnr, {
        pnr: data.ticket.pnr,
        customer: data.ticket.customer,
      });
    }

    if (data.entry?.entryNumber) {
      push('journal', data.entry.id, data.entry.entryNumber);
    }

    return entries;
  }

  merge(existing: AiMemoryEntry[] | undefined, incoming: AiMemoryEntry[]): AiMemoryEntry[] {
    const merged = [...(existing || [])];
    for (const item of incoming) {
      const idx = merged.findIndex((m) => m.kind === item.kind && m.id === item.id);
      if (idx >= 0) merged[idx] = item;
      else merged.push(item);
    }
    return merged.slice(-12);
  }
}
