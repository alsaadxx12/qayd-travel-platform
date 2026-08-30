import React from 'react';
import { AccountCard } from './AccountCard';
import { TicketCardBlock } from './TicketCard';
import { DataTableBlock } from './DataTableBlock';
import { KpiBlock } from './KpiBlock';
import { ChartBlock } from './ChartBlock';
import { DisambiguationBlock } from './DisambiguationBlock';
import { JournalCard } from './JournalCard';
import { GeneratedImageBlock } from './GeneratedImageBlock';
import { PdfFileBlock } from './PdfFileBlock';
import { SourcesBlock } from './SourcesBlock';
import { EmailConfirmBlock } from './EmailConfirmBlock';
import { EntityCardBlock } from './EntityCardBlock';
import { StatementEmailBlock } from './StatementEmailBlock';

export const UiBlocks: React.FC<{ blocks?: any[]; onPrompt?: (text: string) => void }> = ({
  blocks,
  onPrompt,
}) => {
  if (!blocks?.length) return null;
  return (
    <div className="flex flex-col gap-2 mt-2">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'account_card':
            return <AccountCard key={i} payload={block.payload} onPrompt={onPrompt} />;
          case 'ticket_card':
            return <TicketCardBlock key={i} payload={block.payload} onPrompt={onPrompt} />;
          case 'table':
            return <DataTableBlock key={i} payload={block.payload} onPrompt={onPrompt} />;
          case 'kpi':
            return <KpiBlock key={i} payload={block.payload} />;
          case 'chart':
            return <ChartBlock key={i} payload={block.payload} />;
          case 'disambiguation':
            return <DisambiguationBlock key={i} payload={block.payload} onPrompt={onPrompt} />;
          case 'entity_card':
            return <EntityCardBlock key={i} payload={block.payload} onPrompt={onPrompt} />;
          case 'generated_image':
            return <GeneratedImageBlock key={i} payload={block.payload} />;
          case 'pdf_file':
            return <PdfFileBlock key={i} payload={block.payload} />;
          case 'sources':
            return <SourcesBlock key={i} payload={block.payload} />;
          // Renders the statement and mails it from the browser — see the block for
          // why the server does not do this.
          case 'statement_email_client':
            return <StatementEmailBlock key={i} payload={block.payload} />;
          case 'email_confirm':
            return <EmailConfirmBlock key={i} payload={block.payload} onPrompt={onPrompt} />;
          case 'journal_card':
          case 'voucher_card':
            return <JournalCard key={i} payload={block.payload} />;
          default:
            return null;
        }
      })}
    </div>
  );
};
