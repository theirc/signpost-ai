/**
 * Analysis Library Types
 * Isomorphic
 */

export interface ExtractionSchema {
  id: string
  team_id: string
  name: string
  description: string
  fields: ExtractionField[]
  filters: AnalysisFilters
  storage_target: 'contact' | 'message'
  enabled: boolean
  created_at: number
  updated_at: number
  last_run?: number
  run_count?: number
}

export interface ExtractionField {
  id: string
  name: string
  variable_name: string
  description: string
  extraction_method: ExtractionMethod
  required: boolean
  data_type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'enum'
  enum_options?: string[]
}

export interface ExtractionMethod {
  type: 'ai' | 'keyword' | 'pattern' | 'composite'

  // AI extraction
  ai_prompt?: string
  ai_model?: string
  ai_temperature?: number

  // Keyword extraction
  keywords?: string[]
  keyword_match?: 'any' | 'all' | 'exact' | 'phrase'
  case_sensitive?: boolean

  // Pattern extraction
  pattern?: string
  pattern_flags?: string
  extraction_group?: number

  // Composite (combine multiple methods)
  methods?: ExtractionMethod[]
  combine_logic?: 'first' | 'merge' | 'priority'
}

export interface AnalysisFilters {
  project_id?: string
  phone_id?: string
  date_range?: {
    start: number
    end: number
  }
  message_source?: ('incoming' | 'outgoing' | 'both')[]
  handled_by?: ('bot' | 'human' | 'both')[]
  has_flags?: boolean
  custom_vars?: Record<string, any>
}

export interface ExtractionJob {
  id: string
  schema_id: string
  team_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  started_at?: number
  completed_at?: number
  total_conversations: number
  processed_conversations: number
  extracted_fields: number
  errors?: string[]
}

export interface ExtractionResult {
  conversation_id: string
  contact_id: string
  extracted_data: Record<string, any>
  confidence?: Record<string, number>
  extracted_at: number
  schema_id: string
}

export interface SchemaTemplate {
  id: string
  name: string
  description: string
  category: 'support' | 'survey' | 'feedback' | 'custom'
  fields: Partial<ExtractionField>[]
}

/**
 * Minimal Telerivet message/contact shapes needed by the extraction engine.
 * Kept intentionally lean — consumers can extend these.
 */
export interface ConversationMessage {
  id: string
  direction: 'incoming' | 'outgoing'
  content: string
  time_created: number
  vars?: Record<string, any>
  contact_id?: string
}

export interface ConversationContact {
  id: string
  name?: string
  phone_number?: string
  vars?: Record<string, any>
}
