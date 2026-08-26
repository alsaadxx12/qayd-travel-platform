/**
 * Shared contracts for the AI Copilot tool layer.
 *
 * Every tool returns two separate payloads:
 *  - `data`: compact JSON fed back into the model so it can reason and compose an answer.
 *  - `ui`:   rich blocks (cards/tables/charts) streamed straight to the client and never
 *            sent to the model, which keeps token usage low while the user still sees detail.
 */

export type JsonSchema = {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
};

export type AiUiBlockType =
  | 'account_card'
  | 'ticket_card'
  | 'voucher_card'
  | 'journal_card'
  | 'table'
  | 'kpi'
  | 'chart'
  | 'disambiguation'
  | 'entity_card'
  | 'generated_image'
  | 'pdf_file'
  | 'email_confirm';

export interface AiUiBlock {
  type: AiUiBlockType;
  payload: any;
}

export interface AiToolResult {
  ok: boolean;
  /** Compact result handed back to the model. Keep it small. */
  data: any;
  /** Rich rendering payloads for the chat UI. Not sent to the model. */
  ui?: AiUiBlock[];
  /** Short human-readable note, e.g. "عدة نتائج مطابقة". */
  note?: string;
  /** Follow-up prompts suggested to the user after this tool ran. */
  suggestions?: string[];
}

export interface AiPageContext {
  route?: string;
  entity?: string;
  recordId?: string;
  label?: string;
}

export interface AiRequestContext {
  userId: string;
  userName?: string;
  companyId: string;
  companyName?: string;
  tenantId?: string;
  role?: string;
  permissions: string[];
  allowedBranchIds: string[];
  canAccessAllBranches: boolean;
  branchAccessResolved: boolean;
  activeBranchId?: string;
  fiscalYear?: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  } | null;
  baseCurrency: string;
  locale: 'ar' | 'en';
  page?: AiPageContext;
  /** Entities resolved earlier in this conversation, used for pronoun/context follow-ups. */
  memory?: AiMemoryEntry[];
  ipAddress?: string;
}

export interface AiMemoryEntry {
  kind: string;
  id: string;
  label: string;
  extra?: Record<string, any>;
}

export interface AiTool {
  name: string;
  /** Bilingual description; the model relies on this to pick the right tool. */
  description: string;
  parameters: JsonSchema;
  /**
   * The user needs at least ONE of these permissions (OR semantics).
   * Empty array means the tool is available to any authenticated user.
   */
  requiredPermissions: string[];
  sensitivity: 'read' | 'write';
  handler: (args: any, ctx: AiRequestContext) => Promise<AiToolResult>;
}

export interface AiToolProvider {
  getTools(): AiTool[];
}

/** Event names streamed over SSE while the orchestrator works. */
export type AiStreamEvent =
  | { type: 'status'; message: string }
  | { type: 'tool_start'; name: string; label: string }
  | { type: 'tool_end'; name: string; ok: boolean; durationMs: number }
  | { type: 'ui'; blocks: AiUiBlock[] }
  | { type: 'delta'; text: string }
  | { type: 'suggestions'; items: string[] }
  | {
      type: 'done';
      conversationId: string;
      messageId: string;
      model: string;
      toolsUsed: string[];
    }
  | { type: 'error'; message: string };
