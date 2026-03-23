/**
 * Schema Persistence
 * Isomorphic CRUD for extraction schemas stored in Supabase (eval_configs table).
 * Safe to call from browser, API routes, or cron jobs.
 */

import { supabase } from '../db'
import type { ExtractionSchema } from './types'

function rowToSchema(row: any): ExtractionSchema {
  const cfg = row.config as any
  return {
    id: row.id,
    team_id: row.team_id,
    name: row.name,
    description: cfg.description || '',
    fields: cfg.fields || [],
    filters: cfg.filters || {},
    storage_target: cfg.storage_target || 'contact',
    enabled: cfg.enabled ?? true,
    created_at: new Date(row.created_at).getTime() / 1000,
    updated_at: new Date(row.updated_at).getTime() / 1000,
    last_run: cfg.last_run,
    run_count: cfg.run_count || 0,
  }
}

function schemaToConfig(schema: ExtractionSchema) {
  return {
    description: schema.description,
    fields: schema.fields,
    filters: schema.filters,
    storage_target: schema.storage_target,
    enabled: schema.enabled,
    last_run: schema.last_run,
    run_count: schema.run_count || 0,
  }
}

export async function fetchSchemas(teamId: string): Promise<ExtractionSchema[]> {
  const { data, error } = await supabase
    .from('eval_configs')
    .select('*')
    .eq('team_id', teamId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data || []).map(rowToSchema)
}

export async function createSchema(schema: ExtractionSchema): Promise<ExtractionSchema> {
  const { data, error } = await supabase
    .from('eval_configs')
    .insert({ team_id: schema.team_id, name: schema.name, config: schemaToConfig(schema) as any })
    .select()
    .single()

  if (error) throw error
  return rowToSchema(data)
}

export async function updateSchema(
  schema: ExtractionSchema,
  existingSchemas?: ExtractionSchema[]
): Promise<ExtractionSchema> {
  // If the extraction definition changed, clear last_run so all conversations get re-processed
  const existing = existingSchemas?.find((s) => s.id === schema.id)
  const definitionChanged =
    existing &&
    (JSON.stringify(existing.fields) !== JSON.stringify(schema.fields) ||
      JSON.stringify(existing.filters) !== JSON.stringify(schema.filters) ||
      existing.storage_target !== schema.storage_target)

  const config = {
    ...schemaToConfig(schema),
    last_run: definitionChanged ? undefined : schema.last_run,
  }

  const { data, error } = await supabase
    .from('eval_configs')
    .update({ name: schema.name, config: config as any, updated_at: new Date().toISOString() })
    .eq('id', schema.id)
    .select()
    .single()

  if (error) throw error
  return rowToSchema(data)
}

export async function deleteSchema(schemaId: string): Promise<void> {
  const { error } = await supabase.from('eval_configs').delete().eq('id', schemaId)
  if (error) throw error
}

export async function markSchemaRun(
  schemaId: string,
  runCount: number
): Promise<void> {
  const now = Date.now() / 1000
  const { data: row, error: selectError } = await supabase
    .from('eval_configs')
    .select('config')
    .eq('id', schemaId)
    .single()

  if (selectError) throw selectError
  if (!row) return

  const cfg = { ...(row.config as any), last_run: now, run_count: runCount }
  const { error: updateError } = await supabase
    .from('eval_configs')
    .update({
      config: cfg as any,
      updated_at: new Date().toISOString(),
    })
    .eq('id', schemaId)

  if (updateError) throw updateError
}
