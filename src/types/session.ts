export interface Session {
  key: string;
  displayName?: string;
  derivedTitle?: string;
  updatedAt: number | null;
  kind: 'direct' | 'group' | 'global' | 'unknown';
  totalTokens?: number;
  model?: string;
}

