import { create } from 'zustand';

export interface AiPageContext {
  route: string;
  entity?: string;
  recordId?: string;
  label?: string;
}

interface AiContextState {
  page: AiPageContext | null;
  setPage: (page: AiPageContext | null) => void;
}

export const useAiContextStore = create<AiContextState>((set) => ({
  page: null,
  setPage: (page) => set({ page }),
}));
