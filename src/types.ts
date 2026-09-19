import type { GameInfo } from './games.js';
export const VERSION = '0.1.0-beta.2';
export const SCHEMA = 2;
export const LIMITS = { fileBytes: 512 * 1024, totalBytes: 32 * 1024 * 1024, files: 5000,
  responseBytes: 8000, hookBytes: 4000, hookIndexBytes: 1024 * 1024, receipts: 40 };
export interface Identity { root: string; gitDir: string | null; id: string; head: string | null }
export interface SymbolInfo { name: string; line: number; endLine: number }
export interface Fact { kind: string; name: string; value: string }
export interface Document {
  path: string; hash: string; bytes: number; terms: Record<string, number>;
  symbols: SymbolInfo[]; facts: Fact[]; parser: string; parseIncomplete: boolean; game: GameInfo;
}
export interface Snapshot {
  schema: number; identity: Identity; generation: string; reconciledAt: string;
  documents: Document[]; omissions: Record<string, number>; scannedBytes: number; assets: string[];
}
export interface Evidence {
  path: string; startLine: number; endLine: number; excerpt: string; sha256: string;
  sourceVerifiedAt: string; reasons: string[]; facts: Fact[];
}
export interface Brief {
  schema: number; receiptId: string; observedAt: string; indexReconciledAt: string | null;
  coverage: 'reconciled' | 'cached-best-effort' | 'unavailable';
  evidence: Evidence[]; omissions: Record<string, number>;
  invalidated: Array<{ path: string; reason: string }>;
  footprint: { bytes: number; estimatedTokens: number; estimateMethod: string };
  note: string;
}
