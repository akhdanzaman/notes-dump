import { DbSchema, SyncProgress } from "../types";

export type SyncProgressCallback = (progress: SyncProgress) => void;

export type SyncResult = {
  success: boolean;
  method: 'cloud' | 'local' | 'skipped_not_hydrated' | 'skipped_no_changes' | 'error';
  mergedData?: DbSchema;
  error?: string;
};
