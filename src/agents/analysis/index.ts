/**
 * @signpost/analysis — isomorphic analysis library
 *
 * Safe to import on the client (React pages) AND on the server (API routes).
 *
 * What lives here:
 *  - types      — plain TypeScript interfaces, zero runtime cost
 *  - schemas    — Supabase CRUD
 *
 * ExtractionService (extraction.ts) is intentionally NOT re-exported here.
 * It imports the AI SDK and model utilities which should only run server-side.
 * Import it directly in API routes:
 *   import { ExtractionService } from '@/lib/agents/analysis/extraction'
 *
 * What does NOT live here:
 *  - Bulk runners, cron jobs, background workers — those belong in the server repo.
 *    They use Node-only APIs (Buffer, fs, etc.) and do heavy memory/CPU work that
 *    must never land in the client bundle.
 */

export * from './types'
export * from './templates'
export * from './schemas'
