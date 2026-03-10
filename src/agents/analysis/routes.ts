/**
 * Analysis HTTP handlers — server only.
 * All validation, team/api_keys loading, and response logic for analysis endpoints.
 * Import in src/index.ts and mount; keeps index thin like other routes.
 */

import { Request, Response } from 'express'
import { supabase } from '../db'
import { fetchSchemas } from './schemas'
import { ExtractionService } from './extraction'
import { runExtraction } from './runner'

async function getApiKeys(teamId: string): Promise<APIKeys> {
  const { data } = await supabase.from('api_keys').select('*').eq('team_id', teamId)
  return (data || []).reduce<APIKeys>((acc, k) => {
    if (k.type && k.key) (acc as any)[k.type] = k.key
    return acc
  }, {})
}

async function assertTeam(teamId: string): Promise<void> {
  const { data, error } = await supabase.from('teams').select('*').eq('id', teamId).single()
  if (!data || error) throw new Error('team_id is not valid')
}

export async function handleRun(req: Request, res: Response): Promise<void> {
  try {
    const { team_id, project_id, schema_id, phone_id, mode, last_n, date_from, date_to } = req.body || {}
    if (!team_id) { res.status(400).json({ error: 'team_id is required' }); return }
    if (!project_id) { res.status(400).json({ error: 'project_id is required' }); return }

    await assertTeam(team_id)
    const apiKeys = await getApiKeys(team_id)
    if (!apiKeys.telerivet) { res.status(400).json({ error: 'No Telerivet API key found for this team' }); return }

    const results = await runExtraction({
      teamId: team_id,
      projectId: project_id,
      apiKeys,
      telerivetApiKey: apiKeys.telerivet,
      schemaId: schema_id,
      phoneId: phone_id,
      mode: mode || 'new_only',
      lastN: last_n,
      dateFrom: date_from,
      dateTo: date_to,
    })
    res.json({ results })
  } catch (err: any) {
    console.error('Analysis run error:', err)
    res.status(500).json({ error: err?.message || 'Unknown error' })
  }
}

export async function handleExtract(req: Request, res: Response): Promise<void> {
  try {
    const { team_id, schema_id, schema, messages, contact, project_id, telerivet_api_key, store } = req.body || {}
    if (!team_id) { res.status(400).json({ error: 'team_id is required' }); return }
    if (!messages || !Array.isArray(messages)) { res.status(400).json({ error: 'messages array is required' }); return }
    if (!contact) { res.status(400).json({ error: 'contact is required' }); return }

    await assertTeam(team_id)
    const apiKeys = await getApiKeys(team_id)

    let extractionSchema = schema
    if (!extractionSchema && schema_id) {
      const schemas = await fetchSchemas(team_id)
      extractionSchema = schemas.find((s) => s.id === schema_id) ?? null
      if (!extractionSchema) { res.status(404).json({ error: `Schema ${schema_id} not found` }); return }
    }
    if (!extractionSchema) { res.status(400).json({ error: 'schema or schema_id is required' }); return }

    const telerivetKey = telerivet_api_key || apiKeys.telerivet || ''
    const svc = new ExtractionService({ apiKeys, telerivetApiKey: telerivetKey })
    const result = await svc.extractFromConversation(messages, contact, extractionSchema)

    if (store && project_id) {
      await svc.storeResults(result, extractionSchema, project_id)
    }
    res.json(result)
  } catch (err: any) {
    console.error('Analysis error:', err)
    res.status(500).json({ error: err?.message || 'Unknown error' })
  }
}

export async function handleGetSchemas(req: Request, res: Response): Promise<void> {
  const team_id = req.query.team_id as string
  if (!team_id) { res.status(400).json({ error: 'team_id is required' }); return }
  try {
    const schemas = await fetchSchemas(team_id)
    res.json(schemas)
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Unknown error' })
  }
}
