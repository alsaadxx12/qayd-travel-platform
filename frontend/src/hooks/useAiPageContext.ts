import { useEffect } from 'react';
import { AiPageContext, useAiContextStore } from '../store/useAiContextStore';

/** Pages call this so the Copilot knows which record the user is looking at. */
export function useAiPageContext(page: AiPageContext | null) {
  const setPage = useAiContextStore((s) => s.setPage);

  useEffect(() => {
    setPage(page);
    return () => setPage(null);
  }, [page?.route, page?.entity, page?.recordId, page?.label, setPage]);
}
