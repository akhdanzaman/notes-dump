import { useState } from 'react';
import { createRoutineDraft, routineDraftPatch, type RoutineMeta } from '../utils/routineDraft';

export function useRoutineDraft(meta: RoutineMeta, fallback = '') {
  const [draft, setDraft] = useState(() => createRoutineDraft(meta, fallback));
  return {
    draft, setDraft,
    resetRoutine: (next: RoutineMeta) => setDraft(createRoutineDraft(next, fallback)),
    getRoutinePatch: () => routineDraftPatch(draft),
  };
}
