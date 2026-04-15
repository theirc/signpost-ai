/**
 * Server-side Extraction Runner
 * Batch run: fetch contacts/messages from Supabase, extract per conversation, store results.
 */

import { ExtractionService } from './extraction'
import { fetchSchemas, markSchemaRun } from './schemas'
import type { ExtractionSchema, ConversationMessage, ConversationContact } from './types'
import { supabase } from '../db'

export type RunMode = 'new_only' | 'last_n' | 'date_range' | 'all'

export interface RunOptions {
  teamId: string
  apiKeys: APIKeys
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

async function fetchContacts(teamId: string): Promise<ConversationContact[]> {
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, name, created_at')
    .eq('team', teamId)
    .in('type', ['user', 'synthetic'])
  if (error) throw error

  const { data: latestRows, error: latestErr } = await supabase
    .from('messages')
    .select('contact, created_at')
    .eq('team', teamId)
    .order('created_at', { ascending: false })
    .limit(50000)
  if (latestErr) throw latestErr

  const latestByContact = new Map<string, number>()
  ;(latestRows || []).forEach((row: any) => {
    const cid = row.contact as string
    if (!cid || latestByContact.has(cid)) return
    const ts = Math.floor(new Date(row.created_at).getTime() / 1000)
    latestByContact.set(cid, ts)
  })

  return (contacts || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    phone_number: c.id,
    vars: {
      last_message_time: latestByContact.get(c.id) || Math.floor(new Date(c.created_at).getTime() / 1000),
    },
  }))
}

async function fetchMessages(teamId: string, contactId: string): Promise<ConversationMessage[]> {
  const { data: rows, error } = await supabase
    .from('messages')
    .select('id, contact, role, message, created_at')
    .eq('team', teamId)
    .eq('contact', contactId)
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) throw error

  return (rows || []).map((m: any) => ({
    id: m.id,
    direction: m.role === 'assistant' || m.role === 'human' ? 'outgoing' : 'incoming',
    content: m.message || '',
    time_created: Math.floor(new Date(m.created_at).getTime() / 1000),
    vars: {},
    contact_id: m.contact,
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

  const svc = new ExtractionService({ apiKeys: opts.apiKeys })

  let processed = 0
  let extractedFields = 0
  const errors: string[] = []

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(async (contact) => {
        const messages = await fetchMessages(opts.teamId, contact.id)
        if (messages.length === 0) return 0

        const result = await svc.extractFromConversation(messages, contact, schema)
        const latestMessageId = messages[messages.length - 1]?.id
        await svc.storeResults(result, schema, latestMessageId)

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

  const allContacts = await fetchContacts(opts.teamId)

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
