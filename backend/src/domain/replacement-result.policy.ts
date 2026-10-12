export type ReplacementResult =
  | { status: 'READY_FOR_REVIEW'; source: 'CERTIFIED_LIBRARY' | 'RAW_RECIPE_CORPUS' | 'AI_FROM_SCRATCH' }
  | { status: 'HELD' | 'NO_CANDIDATE' | 'PREPARATION_FAILED' };
