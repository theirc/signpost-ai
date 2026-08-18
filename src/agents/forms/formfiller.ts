import { z } from "zod"
import { CoreMessage, generateObject } from "ai"
import { createModel } from "../utils"
import { supabase } from "../db"
import { evalFormula, keywordMatch } from "../formlogic"
import { EVAL_MODEL } from "../evals/evals"

// Default to the same model the evals use.
const DEFAULT_MODEL = `openai/${EVAL_MODEL}`

const DEFAULT_INSTRUCTIONS =
  "You are extracting structured facts from a support conversation to fill a form. " +
  "For each field, follow its instruction. Only fill a field when the conversation " +
  "gives clear evidence; otherwise return null with confidence 0. Report an honest " +
  "confidence between 0 and 1 for every field."

declare global {
  interface FormFieldMeta {
    source?: FormEventSource
    confidence?: number | null
    locked?: boolean
    updated_at?: string
  }

  type FormEventSource = "agent" | "human" | "import"
}

type TranscriptMsg = { role: string; text: string }

function buildSchema(fields: FormFieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const f of fields) {
    let valueSchema: z.ZodTypeAny
    if (f.type === "group") {
      const entryShape: Record<string, z.ZodTypeAny> = {}
      for (const sf of f.subfields || []) entryShape[sf.name] = scalarSchema(sf)
      valueSchema = z.array(z.object(entryShape)).nullable()
    } else {
      valueSchema = scalarSchema(f)
    }
    shape[f.name] = z
      .object({
        value: valueSchema,
        confidence: z.number().min(0).max(1),
      })
      .describe(f.extraction?.instruction || f.title || f.name)
  }
  return z.object(shape)
}

function scalarSchema(f: FormFieldDef): z.ZodTypeAny {
  const hasOptions = f.list && f.list.length > 0
  if (f.type === "number") return z.number().nullable()
  if (f.type === "boolean") return z.boolean().nullable()
  if (f.type === "date") {
    // Kept as a string so it survives JSON and the model can return absolute dates.
    return z.string().describe('Calendar date in ISO format "YYYY-MM-DD"').nullable()
  }
  if (f.type === "multiselect") {
    const item = hasOptions ? z.enum(f.list!.map((o) => o.value) as [string, ...string[]]) : z.string()
    return z.array(item).nullable()
  }
  if (f.type === "list" && hasOptions) {
    return z.enum(f.list!.map((o) => o.value) as [string, ...string[]]).nullable()
  }
  return z.string().nullable()
}

function transcriptToMessages(transcript: TranscriptMsg[]): CoreMessage[] {
  return transcript
    .filter((m) => m.text && (m.role === "user" || m.role === "assistant" || m.role === "human" || m.role === "system"))
    .map((m) => {
      // "system" rows are the history worker's summary; keep them as a user turn so earlier facts stay visible.
      if (m.role === "system") {
        return { role: "user", content: `[Earlier conversation summary]\n${m.text}` }
      }
      return { role: m.role === "assistant" ? "assistant" : "user", content: m.text }
    }) as CoreMessage[]
}

function valuesEqual(a: any, b: any) {
  if (a === b) return true
  if (a == null && b == null) return true
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export interface RunFormFillerArgs {
  apiKeys: APIKeys
  team?: string
  agentId?: number
  contactId: string
  formIds: string[]
  transcript: TranscriptMsg[]
  triggeringMessageId?: string
  model?: string
  instructions?: string
}

export interface FilledFormSummary {
  formId: string
  title: string
  values: Record<string, any>
  fields: FormFieldDef[]
  fieldMeta: Record<string, FormFieldMeta>
  version: number
  changed: { field: string; from: any; to: any; confidence: number }[]
}

// Idempotent: only fields whose value actually changes produce an event.
export async function runFormFiller(args: RunFormFillerArgs): Promise<FilledFormSummary[]> {
  const { apiKeys, team, agentId, contactId, formIds, transcript, triggeringMessageId } = args
  if (!contactId || !formIds?.length) return []

  const { data: formRows, error: formErr } = await supabase
    .from("forms")
    .select("id, title, fields")
    .in("id", formIds)
  if (formErr) console.error("[formfiller] forms load error:", formErr)
  if (formErr || !formRows?.length) {
    console.log("[formfiller] no forms found for ids:", formIds)
    return []
  }

  const summaries: FilledFormSummary[] = []

  for (const formRow of formRows) {
    const allFields = ((formRow.fields as unknown as FormFieldDef[]) || [])
    const calculatedFields = allFields.filter((f) => f.calculated?.formula && f.name)
    // Gate on the formula, not `!f.calculated`: the editor registers a `calculated` object on every field.
    const fillable = allFields.filter((f) => f.extraction?.enabled && f.name && !f.calculated?.formula)
    console.log("[formfiller] form:", formRow.title, "| fields:", allFields.map((f) => f.name), "| fillable:", fillable.map((f) => `${f.name}:${f.extraction?.method || "ai"}`), "| calc:", calculatedFields.map((f) => `${f.name}=${f.calculated?.formula}`))
    if (!fillable.length && !calculatedFields.length) continue

    const { data: existing } = await supabase
      .from("form_records")
      .select("*")
      .eq("form", formRow.id)
      .eq("contact", contactId)
      .maybeSingle()

    const currentValues: Record<string, any> = (existing?.values as any) || {}
    const currentMeta: Record<string, FormFieldMeta> = (existing?.field_meta as any) || {}

    const nextValues = { ...currentValues }
    const nextMeta = { ...currentMeta }
    const changed: FilledFormSummary["changed"] = []
    const now = new Date().toISOString()

    // visibleWhen is intentionally NOT applied here: it only governs panel display, so fields still fill in the background.
    const targetFields = fillable.filter((f) => {
      if (f.extraction?.lockAfterHuman && currentMeta[f.name]?.source === "human") return false
      return true
    })

    const aiFields = targetFields.filter((f) => (f.extraction?.method || "ai") !== "keyword")
    const keywordFields = targetFields.filter((f) => f.extraction?.method === "keyword")

    // ── AI extraction ──
    if (aiFields.length) {
      const model = createModel(apiKeys, args.model || DEFAULT_MODEL)
      if (model) {
        const schema = buildSchema(aiFields)
        const fieldGuide = aiFields
          .map((f) => `- ${f.name} (${f.type}): ${f.extraction?.instruction || f.title}`)
          .join("\n")
        try {
          const { object } = await generateObject({
            model,
            schema,
            messages: [
              { role: "system", content: (args.instructions || DEFAULT_INSTRUCTIONS) + "\n\nFields:\n" + fieldGuide },
              ...transcriptToMessages(transcript),
            ],
          })
          const extracted = object as Record<string, { value: any; confidence: number }>
          for (const f of aiFields) {
            const result = extracted[f.name]
            if (!result) continue
            const { value, confidence } = result
            if (value === null || value === undefined) continue
            if (confidence < (f.extraction?.minConfidence ?? 0)) continue
            const prev = currentValues[f.name] ?? null
            if (valuesEqual(prev, value)) continue
            nextValues[f.name] = value
            nextMeta[f.name] = { source: "agent", confidence, locked: false, updated_at: now }
            changed.push({ field: f.name, from: prev, to: value, confidence })
          }
        } catch (err) {
          console.error("[formfiller] AI extraction failed for form", formRow.id, err)
        }
      }
    }

    // ── Keyword detection ──
    if (keywordFields.length) {
      const transcriptText = transcript.map((m) => m.text).join("\n")
      for (const f of keywordFields) {
        const value = keywordMatch(f, transcriptText)
        if (value === null || value === undefined) continue
        const prev = currentValues[f.name] ?? null
        if (valuesEqual(prev, value)) continue
        nextValues[f.name] = value
        nextMeta[f.name] = { source: "agent", confidence: 1, locked: false, updated_at: now }
        changed.push({ field: f.name, from: prev, to: value, confidence: 1 })
      }
    }

    // ── Calculated fields (recompute from the merged values) ──
    for (const f of calculatedFields) {
      const formula = f.calculated!.formula
      const computed = evalFormula(formula, nextValues)
      const resolved = formula.replace(/\{([^}]+)\}/g, (_, name) => {
        const v = nextValues[name.trim()]
        return `${name.trim()} (${v === null || v === undefined || v === "" ? "empty" : JSON.stringify(v)})`
      })
      console.log(`[formfiller] calc ${f.name}: ${resolved} = ${JSON.stringify(computed)}`)
      const prev = currentValues[f.name] ?? null
      if (valuesEqual(prev, computed)) continue
      nextValues[f.name] = computed
      nextMeta[f.name] = { source: "agent", confidence: 1, locked: false, updated_at: now }
      changed.push({ field: f.name, from: prev, to: computed, confidence: 1 })
    }

    let recordId = existing?.id as string | undefined
    let version = existing?.version ?? 0

    if (changed.length > 0) {
      version = version + 1
      if (recordId) {
        await supabase
          .from("form_records")
          .update({ values: nextValues, field_meta: nextMeta as any, version })
          .eq("id", recordId)
      } else {
        const { data: created } = await supabase
          .from("form_records")
          .insert({
            form: formRow.id,
            contact: contactId,
            team: team ?? null,
            agent: agentId ?? null,
            values: nextValues,
            field_meta: nextMeta as any,
            version,
          })
          .select("id")
          .single()
        recordId = created?.id
      }

      if (recordId) {
        const events = changed.map((c) => ({
          record: recordId!,
          team: team ?? null,
          field: c.field,
          old_value: (c.from ?? null) as any,
          new_value: (c.to ?? null) as any,
          source: "agent" as FormEventSource,
          actor: agentId != null ? `agent:${agentId}` : "agent",
          confidence: c.confidence,
          message: triggeringMessageId ?? null,
        }))
        await supabase.from("form_record_events").insert(events)
      }
    }

    summaries.push({
      formId: formRow.id,
      title: formRow.title || "",
      values: nextValues,
      fields: allFields,
      fieldMeta: nextMeta,
      version,
      changed,
    })
  }

  return summaries
}

// Loads form definitions and current records without running extraction (no LLM call).
export async function loadFormSummaries(
  formIds: string[],
  contactId: string,
): Promise<FilledFormSummary[]> {
  if (!contactId || !formIds?.length) return []

  const { data: formRows, error: formErr } = await supabase
    .from("forms")
    .select("id, title, fields")
    .in("id", formIds)
  if (formErr || !formRows?.length) return []

  const { data: records } = await supabase
    .from("form_records")
    .select("*")
    .in("form", formIds)
    .eq("contact", contactId)
  const recordByForm = new Map((records || []).map((r) => [r.form as string, r]))

  return formRows.map((formRow) => {
    const rec = recordByForm.get(formRow.id)
    return {
      formId: formRow.id,
      title: formRow.title || "",
      values: (rec?.values as any) || {},
      fields: ((formRow.fields as unknown as FormFieldDef[]) || []),
      fieldMeta: (rec?.field_meta as any) || {},
      version: rec?.version ?? 0,
      changed: [],
    }
  })
}

function describeField(f: FormFieldDef, value: any): string {
  const parts: string[] = []
  parts.push(f.type)
  if (f.required) parts.push("required")

  if (f.calculated?.formula) {
    parts.push(`calculated as \`${f.calculated.formula}\` (read-only — never ask the user for this; it is derived automatically)`)
  } else if (f.extraction?.enabled) {
    const method = f.extraction.method || "ai"
    if (method === "keyword") {
      const kws = (f.extraction.keywords || []).join(", ")
      parts.push(`auto-filled by keyword match [${f.extraction.keywordMatch || "any"}: ${kws}]`)
    } else {
      parts.push(`auto-extracted by AI — instruction: "${f.extraction.instruction || f.title || f.name}"`)
    }
    if (f.extraction.lockAfterHuman) parts.push("locked once a human edits it")
  } else {
    parts.push("entered manually (the agent does not fill this)")
  }

  if (f.visibleWhen?.length) {
    const conds = f.visibleWhen
      .map((c) => {
        if (c.operator === "isEmpty") return `${c.field} is empty`
        if (c.operator === "isNotEmpty") return `${c.field} is not empty`
        return `${c.field} ${c.operator} ${JSON.stringify(c.value)}`
      })
      .join(" AND ")
    parts.push(`conditional — only applies when ${conds}`)
  }

  if (f.list?.length) parts.push(`options: ${f.list.map((o) => o.value).join(", ")}`)

  const cur = value === null || value === undefined || value === "" ? "(empty)" : JSON.stringify(value)
  return `  - ${f.name} (${f.title || f.name}) [${parts.join("; ")}] = ${cur}`
}

export function renderFormMemory(summaries: FilledFormSummary[]): string {
  const lines: string[] = []
  for (const s of summaries) {
    const known = Object.entries(s.values).filter(([, v]) => v !== null && v !== undefined && v !== "")
    const missingRequired = s.fields
      .filter((f) => f.required && (s.values[f.name] == null || s.values[f.name] === ""))
      .map((f) => f.title || f.name)

    if (!s.fields.length && !known.length && !missingRequired.length) continue
    lines.push(`Form "${s.title}":`)

    if (s.fields.length) {
      lines.push("  Schema:")
      for (const f of s.fields) lines.push("  " + describeField(f, s.values[f.name]))
    }

    if (known.length) {
      lines.push("  Known: " + known.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", "))
    }
    if (missingRequired.length) {
      lines.push("  Still needed: " + missingRequired.join(", "))
    }
  }
  return lines.join("\n")
}

