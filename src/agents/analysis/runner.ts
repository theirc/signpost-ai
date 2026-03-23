/**
 * Server-side Extraction Runner
 * Batch run: fetch contacts from Telerivet, extract per conversation, store results.
 * Node-only (Buffer, direct fetch) — do not import from client.
 */

import { ExtractionService } from './extraction'
import { fetchSchemas, markSchemaRun } from './schemas'
import type { ExtractionSchema, ConversationMessage, ConversationContact } from './types'

export type RunMode = 'new_only' | 'last_n' | 'date_range' | 'all'

export interface RunOptions {
  teamId: string
  projectId: string
  apiKeys: APIKeys
  telerivetApiKey: string
  phoneId?: string
  schemaId?: string
  mode?: RunMode
  lastN?: number
  dateFrom?: number
  dateTo?: number
}

export interface RunResult {
  schema_id: string
  schema_name: string
  total_conversations: number
  processed_conversations: number
  extracted_fields: number
  errors: string[]
  started_at: number
  completed_at: number
}

const BATCH_SIZE = 10
const TELERIVET_BASE = 'https://api.telerivet.com/v1'

async function telerivetGet(path: string, apiKey: string): Promise<any> {
  const auth = Buffer.from(`${apiKey}:`).toString('base64')
  const res = await fetch(`${TELERIVET_BASE}${path}`, {
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Telerivet GET ${path} failed: ${res.status}`)
  return res.json()
}

async function fetchContacts(projectId: string, apiKey: string, phoneId?: string): Promise<ConversationContact[]> {
  const contacts: ConversationContact[] = []
  let cursor: string | undefined

  while (true) {
    const params = new URLSearchParams({ limit: '200', sort_dir: 'desc' })
    if (phoneId) params.set('phone_id', phoneId)
    if (cursor) params.set('cursor', cursor)

    const data = await telerivetGet(`/projects/${projectId}/contacts?${params}`, apiKey)
    const rows: any[] = data.data || []

    for (const c of rows) {
      contacts.push({
        id: c.id,
        name: c.name,
        phone_number: c.phone_number,
        vars: { ...(c.vars || {}), last_message_time: c.last_message_time ?? c.time_updated },
      })
    }

    if (!data.next_cursor) break
    cursor = data.next_cursor
  }

  return contacts
}

async function fetchMessages(projectId: string, contactId: string, apiKey: string, phoneId?: string): Promise<ConversationMessage[]> {
  const params = new URLSearchParams({ contact_id: contactId, limit: '200' })
  if (phoneId) params.set('phone_id', phoneId)

  const data = await telerivetGet(`/projects/${projectId}/messages?${params}`, apiKey)
  const rows: any[] = data.data || []

  return rows.map((m: any) => ({
    id: m.id,
    direction: m.direction as 'incoming' | 'outgoing',
    content: m.content || '',
    time_created: m.time_created,
    vars: m.vars,
    contact_id: m.contact_id,
  }))
}

function filterContacts(contacts: ConversationContact[], schema: ExtractionSchema, opts: RunOptions): ConversationContact[] {
  const mode = opts.mode || 'new_only'

  switch (mode) {
    case 'new_only': {
      const lastRun = schema.last_run || 0
      return contacts.filter((c) => {
        const t = (c.vars as any)?.last_message_time || 0
        return t > lastRun
      })
    }
    case 'last_n':
      return contacts.slice(0, opts.lastN || 100)
    case 'date_range': {
      const from = opts.dateFrom || 0
      const to = opts.dateTo || Infinity
      return contacts.filter((c) => {
        const t = (c.vars as any)?.last_message_time || 0
        return t >= from && t <= to
      })
    }
    case 'all':
    default:
      return contacts
  }
}

async function runSchema(schema: ExtractionSchema, allContacts: ConversationContact[], opts: RunOptions): Promise<RunResult> {
  const started_at = Date.now() / 1000
  const eligible = filterContacts(allContacts, schema, opts)

  const svc = new ExtractionService({ apiKeys: opts.apiKeys, telerivetApiKey: opts.telerivetApiKey })

  let processed = 0
  let extractedFields = 0
  const errors: string[] = []

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(async (contact) => {
        const messages = await fetchMessages(opts.projectId, contact.id, opts.telerivetApiKey, opts.phoneId)
        if (messages.length === 0) return 0

        const result = await svc.extractFromConversation(messages, contact, schema)
        const latestMessageId = messages[0]?.id
        await svc.storeResults(result, schema, opts.projectId, latestMessageId)

        return Object.keys(result.extracted_data).length
      })
    )

    for (const r of results) {
      processed++
      if (r.status === 'fulfilled') {
        extractedFields += r.value
      } else {
        errors.push(String(r.reason))
      }
    }
  }

  await markSchemaRun(schema.id, (schema.run_count || 0) + 1)

  return {
    schema_id: schema.id,
    schema_name: schema.name,
    total_conversations: eligible.length,
    processed_conversations: processed,
    extracted_fields: extractedFields,
    errors,
    started_at,
    completed_at: Date.now() / 1000,
  }
}

export async function runExtraction(opts: RunOptions): Promise<RunResult[]> {
  const schemas = await fetchSchemas(opts.teamId)
  const toRun = opts.schemaId
    ? schemas.filter((s) => s.id === opts.schemaId && s.enabled)
    : schemas.filter((s) => s.enabled)

  if (toRun.length === 0) return []

  const allContacts = await fetchContacts(opts.projectId, opts.telerivetApiKey, opts.phoneId)

  const results: RunResult[] = []
  for (const schema of toRun) {
    try {
      results.push(await runSchema(schema, allContacts, opts))
    } catch (err) {
      results.push({
        schema_id: schema.id,
        schema_name: schema.name,
        total_conversations: 0,
        processed_conversations: 0,
        extracted_fields: 0,
        errors: [String(err)],
        started_at: Date.now() / 1000,
        completed_at: Date.now() / 1000,
      })
    }
  }

  return results
}
