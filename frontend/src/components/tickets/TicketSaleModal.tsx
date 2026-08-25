import React from 'react';
import { TicketInvoiceEditorWorkspace } from './TicketInvoiceEditorWorkspace';

export interface TicketSaleModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
  initialData?: any;
}

export const TicketSaleModal: React.FC<TicketSaleModalProps> = (props) => {
  return <TicketInvoiceEditorWorkspace {...props} />;
};

export default TicketSaleModal;
