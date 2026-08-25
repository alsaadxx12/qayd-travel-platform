import React from 'react';
import { AccountingTopBar } from './AccountingTopBar';

interface HeaderProps {
  onOpenSearch?: () => void;
  onNewJournalEntry?: () => void;
  onNewVoucher?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNewJournalEntry }) => {
  return <AccountingTopBar onNewJournalEntry={onNewJournalEntry} />;
};
