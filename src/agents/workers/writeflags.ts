import { z } from "zod"
import { supabase } from "../db"

declare global {
  interface WriteFlagsWorker extends AIWorker {
    fields: {
      flag_ids: NodeIO
      reasoning: NodeIO
      triggered: NodeIO
      tool: NodeIO
    }
    parameters: {
      flag_id?: string
      toolName?: string
      toolDescription?: string
    }
  }
}

const BUILTIN_FLAG_COL: Record<string, "highrisk" | "lowconf" | "askhuman"> = {
  high_risk: "highrisk",
  low_confidence: "lowconf",
  asked_human: "askhuman",
}

// Normalize flag IDs that the model commonly gets wrong to their canonical form.
const FLAG_ID_ALIASES: Record<string, string> = {
  highrisk: "high_risk",
  "high-risk": "high_risk",
  highrisk_flag: "high_risk",
  lowconf: "low_confidence",
  low_conf: "low_confidence",
  "low-confidence": "low_confidence",
  lowconfidence: "low_confidence",
  askhuman: "asked_human",
  ask_human: "asked_human",
  "ask-human": "asked_human",
  human: "asked_human",
  hitl: "asked_human",
}

function normalizeFlagId(id: string): string {
  const lower = id.trim().toLowerCase()
  return FLAG_ID_ALIASES[lower] ?? id.trim()
}

async function writeFlagsToMessage(flagIds: string[], reasoning: string, userMessageId: string, p: AgentParameters) {
  const now = new Date().toISOString()
  const upd: Record<string, unknown> = {}
  const customFlags: any[] = []

  for (const flagId of flagIds) {
    const col = BUILTIN_FLAG_COL[flagId]
    if (col) {
      upd[col] = 1
    } else {
      customFlags.push({ flagId, status: "flagged", reasoning, confidence: 1, detectedAt: now })
    }
  }
  if (customFlags.length) upd.custom_message_flags = customFlags

  if (Object.keys(upd).length) {
    const { error } = await supabase.from("messages").update(upd as any).eq("id", userMessageId)
    if (error) throw new Error(`Failed to write flags: ${error.message}`)
  }

  console.log(`[writeFlags] Wrote flags for message ${userMessageId}:`, { flagIds, reasoning })
  ;(p as any).flagsWrittenByTool = true

  // Surface in the flow simulator so it's visible on the edge
  if (p.agent) {
    p.agent.toolCallNodes = [
      ...(p.agent.toolCallNodes || []),
      {
        name: "write_flags (node)",
        arguments: JSON.stringify({ flag_ids: flagIds, reasoning }),
        result: JSON.stringify({ flagged: flagIds }),
        sourceWorkerId: "",
      },
    ]
  }
}

function getTool(w: WriteFlagsWorker, p: AgentParameters): ToolConfig {
  const name = (w.parameters.toolName || "write_flags").trim().replace(/\s+/g, "_")
  const configuredFlagId = w.parameters.flag_id

  // If this node is pre-configured to a single flag, pull its detection_prompt
  // from the agent's escalation flags so the model gets the same condition text
  // that the background eval uses.
  let description = w.parameters.toolDescription || ""
  if (!description && configuredFlagId && p.agent?.escalationFlags) {
    const flagDef = p.agent.escalationFlags.find((f: AgentEscalationFlag) => f.id === configuredFlagId)
    if (flagDef?.detection_prompt) {
      description = `Call this tool when the following condition is met: ${flagDef.detection_prompt}`
    }
  }
  if (!description) {
    description = "Write escalation flags for the current message. Call this when you detect a condition that needs to be flagged for human review."
  }

  return {
    name,
    description,
    parameters: z.object({
      flag_ids: z.array(z.string()).describe(
        configuredFlagId
          ? `Flag IDs to set. Must be exactly: ["${configuredFlagId}"]`
          : 'Flag IDs to set. Use exact values only: "high_risk", "low_confidence", "asked_human". No variations.'
      ),
    }),
    async execute({ flag_ids }: { flag_ids: string[] }): Promise<string> {
      console.log("[writeFlags tool] Called with:", { flag_ids })
      const userMessageId = (p as any).userMessageId as string | undefined
      if (!userMessageId) {
        console.warn("[writeFlags tool] No userMessageId on p — flags noted but not persisted")
        return JSON.stringify({ flagged: flag_ids })
      }

      const rawIds = configuredFlagId ? [configuredFlagId] : flag_ids
      if (!rawIds.length) return JSON.stringify({ error: "No flag IDs provided" })

      const ids = rawIds.map(normalizeFlagId)

      try {
        await writeFlagsToMessage(ids, "", userMessageId, p)
        return JSON.stringify({ flagged: ids })
      } catch (err: any) {
        console.error("[writeFlags tool]", err)
        return JSON.stringify({ flagged: ids, note: "write failed internally" })
      }
    },
  }
}

async function execute(worker: WriteFlagsWorker, p: AgentParameters) {
  const userMessageId = (p as any).userMessageId as string | undefined
  if (!userMessageId) {
    worker.fields.triggered.value = false
    return
  }

  const rawIds = worker.parameters.flag_id || worker.fields.flag_ids.value
  if (!rawIds) {
    worker.fields.triggered.value = false
    return
  }

  const flagIds: string[] = (Array.isArray(rawIds)
    ? rawIds
    : String(rawIds).split(",").map(s => s.trim()).filter(Boolean)
  ).map(normalizeFlagId)

  if (!flagIds.length) {
    worker.fields.triggered.value = false
    return
  }

  const reasoning = (worker.fields.reasoning.value as string) || ""

  try {
    await writeFlagsToMessage(flagIds, reasoning, userMessageId, p)
    worker.fields.triggered.value = true
  } catch (err) {
    console.error("[writeFlags]", err)
    worker.fields.triggered.value = false
  }
}

function create(agent: Agent) {
  const w = agent.initializeWorker(
    {
      type: "writeFlags",
      conditionable: true,
      parameters: {
        flag_id: "",
        toolName: "write_flags",
        toolDescription: "",
      },
    },
    [
      { type: "string", direction: "input", title: "Flag IDs", name: "flag_ids" },
      { type: "string", direction: "input", title: "Reasoning", name: "reasoning" },
      { type: "boolean", direction: "output", title: "Triggered", name: "triggered" },
      { type: "tool", direction: "input", title: "Tool", name: "tool" },
    ],
    writeFlags
  )
  w.getTool = getTool
  return w
}

export const writeFlags: WorkerRegistryItem = {
  title: "Write Flags",
  category: "tool",
  type: "writeFlags",
  description: "Writes escalation flags to the current message. Use as a flow node or wire it into an LLM Agent's Tool handle so the model can call it mid-generation.",
  execute,
  create,
  get registry() { return writeFlags },
}
