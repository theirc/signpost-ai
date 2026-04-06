/**
 * Isomorphic Extraction Engine
 *
 * Runs identically on browser and server/cron.
 * Reads conversations and persists extraction payloads in Supabase.
 *
 * Lives in src/lib/agents/analysis — no Next.js or DOM imports here.
 */

import { generateObject } from 'ai'
import { z } from 'zod'
import { createModel } from '../utils'
import { supabase } from '../db'
import type {
  ExtractionSchema,
  ExtractionField,
  ExtractionMethod,
  ExtractionResult,
  ConversationMessage,
  ConversationContact,
} from './types'

export interface ExtractionServiceOptions {
  /** Resolved API keys (openai, anthropic, etc.) */
  apiKeys: APIKeys
}

export class ExtractionService {
  private options: ExtractionServiceOptions

  constructor(options: ExtractionServiceOptions) {
    this.options = options
  }

  // ─────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────

  /**
   * Extract all fields defined in a schema from a single conversation.
   */
  async extractFromConversation(
    messages: ConversationMessage[],
    contact: ConversationContact,
    schema: ExtractionSchema
  ): Promise<ExtractionResult> {
    const extractedData: Record<string, any> = {}
    const confidence: Record<string, number> = {}

    const results = await Promise.allSettled(
      schema.fields.map(async (field) => {
        const result = await this.extractField(messages, contact, field)
        return { field, result }
      })
    )

    for (const outcome of results) {
      if (outcome.status === 'fulfilled') {
        const { field, result } = outcome.value
        if (result.value !== undefined && result.value !== null) {
          extractedData[field.variable_name] = result.value
          if (result.confidence !== undefined) {
            confidence[field.variable_name] = result.confidence
          }
        }
      } else {
        const failedField = schema.fields[results.indexOf(outcome)]
        console.error(`[analysis] Failed to extract field "${failedField?.name}":`, outcome.reason)
        if (failedField?.required) {
          throw new Error(`Required field "${failedField.name}" extraction failed`)
        }
      }
    }

    return {
      conversation_id: contact.id,
      contact_id: contact.id,
      extracted_data: extractedData,
      confidence,
      extracted_at: Date.now() / 1000,
      schema_id: schema.id,
    }
  }

  /**
   * Persist extraction results to Supabase (contact/message extraction payloads).
   */
  async storeResults(
    result: ExtractionResult,
    schema: ExtractionSchema,
    latestMessageId?: string
  ): Promise<void> {
    const payload = this.buildExtractionPayload(result, schema)

    if (schema.storage_target === 'contact') {
      const targetId = result.contact_id
      const { data: contactRow, error: contactErr } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', targetId)
        .single()
      if (contactErr || !contactRow) throw new Error(`Contact not found: ${targetId}`)

      const existingExtractions = (contactRow as any).extractions && typeof (contactRow as any).extractions === 'object'
        ? (contactRow as any).extractions
        : {}
      const nextExtractions = {
        ...existingExtractions,
        [schema.id]: payload,
      }

      const { error: updateErr } = await supabase
        .from('contacts')
        .update({ extractions: nextExtractions } as any)
        .eq('id', targetId)

      if (!updateErr) return

      // Fallback before migration exists: store in contacts.data JSON.
      const dataObj = this.parseJsonObject((contactRow as any).data)
      dataObj.analysis_extractions ||= {}
      dataObj.analysis_extractions[schema.id] = payload
      const { error: fallbackErr } = await supabase
        .from('contacts')
        .update({ data: JSON.stringify(dataObj) })
        .eq('id', targetId)
      if (fallbackErr) throw fallbackErr
      return
    }

    const messageId = latestMessageId || result.conversation_id
    const { data: messageRow, error: msgErr } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single()
    if (msgErr || !messageRow) throw new Error(`Message not found: ${messageId}`)

    const existingMsgExtractions = (messageRow as any).extractions && typeof (messageRow as any).extractions === 'object'
      ? (messageRow as any).extractions
      : {}
    const nextMsgExtractions = {
      ...existingMsgExtractions,
      [schema.id]: payload,
    }

    const { error: msgUpdateErr } = await supabase
      .from('messages')
      .update({ extractions: nextMsgExtractions } as any)
      .eq('id', messageId)
    if (!msgUpdateErr) return

    // Fallback before migration exists: store message-target extraction under contact.data.
    const { data: contactRow, error: contactErr } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', result.contact_id)
      .single()
    if (contactErr || !contactRow) throw msgUpdateErr
    const dataObj = this.parseJsonObject((contactRow as any).data)
    dataObj.analysis_message_extractions ||= {}
    dataObj.analysis_message_extractions[messageId] ||= {}
    dataObj.analysis_message_extractions[messageId][schema.id] = payload
    const { error: fallbackErr } = await supabase
      .from('contacts')
      .update({ data: JSON.stringify(dataObj) })
      .eq('id', result.contact_id)
    if (fallbackErr) throw fallbackErr
  }

  // ─────────────────────────────────────────────────────────────────
  // Field extraction dispatch
  // ─────────────────────────────────────────────────────────────────

  private async extractField(
    messages: ConversationMessage[],
    contact: ConversationContact,
    field: ExtractionField
  ): Promise<{ value: any; confidence?: number }> {
    const method = field.extraction_method
    switch (method.type) {
      case 'ai':        return this.extractWithAI(messages, contact, field, method)
      case 'keyword':   return this.extractWithKeywords(messages, field, method)
      case 'pattern':   return this.extractWithPattern(messages, field, method)
      case 'composite': return this.extractWithComposite(messages, contact, field, method)
      default:          throw new Error(`Unknown extraction method: ${(method as any).type}`)
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Extraction strategies
  // ─────────────────────────────────────────────────────────────────

  private async extractWithAI(
    messages: ConversationMessage[],
    _contact: ConversationContact,
    field: ExtractionField,
    method: ExtractionMethod
  ): Promise<{ value: any; confidence?: number }> {
    const { apiKeys } = this.options
    const prompt = method.ai_prompt
      || (field.description
        ? `Extract the ${field.name}: ${field.description}`
        : `Extract the value for "${field.name}" from the conversation.`)

    const modelName = method.ai_model || 'openai/gpt-4.1-nano'
    const model = createModel(apiKeys, modelName)
    if (!model) throw new Error(`Failed to create model: ${modelName}`)

    const conversationText = messages
      .map((m) => `${m.direction === 'incoming' ? 'User' : 'Bot'}: ${m.content}`)
      .join('\n')

    const isEnum = field.data_type === 'enum' && (field.enum_options?.length ?? 0) >= 2
    const schema = z.object({
      value: this.buildValueSchema(field),
      confidence: z.number().min(0).max(1).describe('Confidence score 0–1'),
      reasoning: z.string().optional().describe('Brief explanation'),
    })

    const typeContext = isEnum
      ? `This field must be one of: ${field.enum_options!.join(', ')}. If none match, set value to null.`
      : `Data type: ${field.data_type}`

    const { object } = await generateObject({
      model,
      schema,
      messages: [
        {
          role: 'system',
          content: `You are a data extraction assistant. Extract the requested information from the conversation.
If the information is not found, set value to null with confidence 0.
${typeContext}
Field description: ${field.description}`,
        },
        {
          role: 'user',
          content: `${prompt}\n\nConversation:\n${conversationText}\n\nExtract the value for: ${field.name}`,
        },
      ],
      temperature: method.ai_temperature ?? 0.3,
    })

    const value = object.value !== null && object.value !== undefined
      ? this.convertToDataType(object.value, field.data_type)
      : null

    return { value, confidence: object.confidence ?? 0.5 }
  }

  private async extractWithKeywords(
    messages: ConversationMessage[],
    field: ExtractionField,
    method: ExtractionMethod
  ): Promise<{ value: any; confidence?: number }> {
    if (!method.keywords || method.keywords.length === 0) {
      throw new Error('Keyword extraction requires keywords')
    }

    const allText = messages.map((m) => m.content).join(' ')
    const searchText = method.case_sensitive ? allText : allText.toLowerCase()
    const keywords = method.case_sensitive
      ? method.keywords
      : method.keywords.map((k) => k.toLowerCase())

    let matchedKeywords: string[] = []
    for (const keyword of keywords) {
      const matches = method.keyword_match === 'phrase'
        ? searchText.includes(keyword)
        : searchText.split(/\s+/).includes(keyword)
      if (matches) {
        matchedKeywords.push(keyword)
        if (method.keyword_match === 'any') break
      }
    }

    const found = method.keyword_match === 'all'
      ? matchedKeywords.length === keywords.length
      : matchedKeywords.length > 0

    const value = field.data_type === 'boolean'
      ? found
      : found ? matchedKeywords.join(', ') : null

    return { value: this.convertToDataType(value, field.data_type), confidence: found ? 0.9 : 0 }
  }

  private async extractWithPattern(
    messages: ConversationMessage[],
    field: ExtractionField,
    method: ExtractionMethod
  ): Promise<{ value: any; confidence?: number }> {
    if (!method.pattern) throw new Error('Pattern extraction requires a regex pattern')

    const allText = messages.map((m) => m.content).join('\n')
    const regex = new RegExp(method.pattern, method.pattern_flags || 'i')
    const match = allText.match(regex)
    if (!match) return { value: null, confidence: 0 }

    const extractedValue = match[method.extraction_group ?? 0]
    return { value: this.convertToDataType(extractedValue, field.data_type), confidence: 0.95 }
  }

  private async extractWithComposite(
    messages: ConversationMessage[],
    contact: ConversationContact,
    field: ExtractionField,
    method: ExtractionMethod
  ): Promise<{ value: any; confidence?: number }> {
    if (!method.methods || method.methods.length === 0) {
      throw new Error('Composite extraction requires sub-methods')
    }

    const results: Array<{ value: any; confidence?: number }> = []
    for (const subMethod of method.methods) {
      try {
        const result = await this.extractField(messages, contact, {
          ...field,
          extraction_method: subMethod,
        })
        results.push(result)
        if (method.combine_logic === 'first' && result.value !== null) return result
      } catch (err) {
        console.error('[analysis] Sub-method extraction failed:', err)
      }
    }

    if (results.length === 0) return { value: null, confidence: 0 }

    if (method.combine_logic === 'priority') {
      return results.find((r) => r.value !== null) || { value: null, confidence: 0 }
    }

    if (method.combine_logic === 'merge') {
      const values = results.filter((r) => r.value !== null).map((r) => r.value)
      if (values.length === 0) return { value: null, confidence: 0 }
      const merged = Array.isArray(values[0]) ? values.flat() : values.join(', ')
      const avgConf = results.reduce((s, r) => s + (r.confidence ?? 0), 0) / results.length
      return { value: merged, confidence: avgConf }
    }

    return results[0] || { value: null, confidence: 0 }
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────

  private buildValueSchema(field: ExtractionField): z.ZodTypeAny {
    switch (field.data_type) {
      case 'number':  return z.number().nullable().describe('Extracted numeric value')
      case 'boolean': return z.boolean().nullable().describe('Extracted boolean value')
      case 'date':    return z.string().nullable().describe('Extracted date as ISO string')
      case 'json':    return z.any().nullable().describe('Extracted structured data')
      case 'enum': {
        const opts = field.enum_options || []
        if (opts.length < 2) return z.string().nullable().describe('One of the allowed values')
        return z.enum(opts as [string, ...string[]]).nullable().describe(`One of: ${opts.join(', ')}`)
      }
      case 'string':
      default: return z.string().nullable().describe('Extracted text value')
    }
  }

  private convertToDataType(value: any, dataType: string): any {
    if (value === null || value === undefined) return null
    switch (dataType) {
      case 'number': {
        const n = parseFloat(value)
        return isNaN(n) ? null : n
      }
      case 'boolean':
        if (typeof value === 'boolean') return value
        if (typeof value === 'string') {
          const l = value.toLowerCase()
          if (l === 'true' || l === 'yes' || l === '1') return true
          if (l === 'false' || l === 'no' || l === '0') return false
        }
        return Boolean(value)
      case 'date': {
        const d = new Date(value)
        return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000)
      }
      case 'json':
        if (typeof value === 'object') return value
        try { return JSON.parse(value) } catch { return null }
      case 'enum':
        return value !== null ? String(value) : null
      case 'string':
      default:
        return String(value)
    }
  }

  private buildExtractionPayload(result: ExtractionResult, schema: ExtractionSchema): Record<string, any> {
    return {
      schema_id: schema.id,
      schema_name: schema.name,
      extracted_at: result.extracted_at,
      extracted_data: result.extracted_data,
      confidence: result.confidence || {},
    }
  }

  private parseJsonObject(raw: unknown): Record<string, any> {
    if (!raw) return {}
    if (typeof raw === "object") return raw as Record<string, any>
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === "object" ? parsed : {}
      } catch {
        return {}
      }
    }
    return {}
  }

}