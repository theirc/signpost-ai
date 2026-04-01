import { generateObject } from "ai"
import { z } from "zod"
import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { supabase } from "../db"

// --- Zod Schema ---

const EvaluationSchema = z.object({
  detectedItems: z.array(
    z.object({
      itemId: z.number().describe("ID of the matched evaluation item from the USER MESSAGE section"),
      severity: z.number().min(1).max(5).describe("Severity level from 1 (low) to 5 (critical)"),
      confidence: z.number().min(0).max(1).describe("Confidence of detection from 0 to 1"),
      reasoning: z.string().describe("Brief explanation of why this item was detected"),
    })
  ).describe("List of evaluation items detected in the user message"),

  agentEvaluation: z.object({
    appropriate: z.boolean().describe("Whether the agent response was appropriate given the context"),
    concernLevel: z.number().min(1).max(5).describe("How concerning the agent response is from 1 to 5"),
    reasoning: z.string().describe("Brief explanation of the agent response quality"),
    detectedItems: z.array(
      z.object({
        itemId: z.number().describe("ID of the matched evaluation item from the AGENT RESPONSE section"),
        severity: z.number().min(1).max(5).describe("Severity level from 1 (low) to 5 (critical)"),
        confidence: z.number().min(0).max(1).describe("Confidence of detection from 0 to 1"),
        reasoning: z.string().describe("Brief explanation of why this agent item was detected"),
      })
    ).describe("List of agent performance items detected in the agent response"),
  }),

  escalation: z.object({
    fromLevel: z.number().min(0).max(5).describe("Previous severity level before this interaction. Use 0 if no prior history."),
    toLevel: z.number().min(0).max(5).describe("Current severity level after this interaction. Use 0 if nothing detected."),
    reasoning: z.string().describe("Brief explanation of the current severity level and any changes from prior interaction."),
  }),

  narrativeUpdate: z.object({
    shouldUpdate: z.boolean().describe("Whether the narrative summary should be updated with new information"),
    newSummary: z.string().nullable().describe("Updated narrative summary if shouldUpdate is true, otherwise null. Must include all prior history plus new developments as a single cohesive paragraph."),
  }),

})

type InferredEvaluationResult = z.infer<typeof EvaluationSchema>

export type EvaluationResult = {
  detectedItems?: {
    itemId?: number
    severity?: number
    confidence?: number
    reasoning?: string
  }[]
  agentEvaluation?: {
    reasoning?: string
    detectedItems?: {
      itemId?: number
      severity?: number
      confidence?: number
      reasoning?: string
    }[]
    appropriate?: boolean
    concernLevel?: number
  }
  escalation?: {
    reasoning?: string
    fromLevel?: number
    toLevel?: number
  }
  narrativeUpdate?: {
    shouldUpdate?: boolean
    newSummary?: string
  }
}

// --- Main Function ---

export async function evaluate(userMessage: string, agentResponse: string, recentMessages: Message[], contact: Contact, evalItems: Evaluation_Item[], keys: APIKeys): Promise<EvaluationResult> {

  const openai = createOpenAI({ apiKey: keys.openai })


  const userItems = evalItems.filter(i => {
    if (i.weight == 0) return false
    return i.type !== "agent_response"
  })

  const agentItems = evalItems.filter(i => {
    if (i.weight == 0) return false
    return i.type === "agent_response"
  })

  // Split user items into risk and descalation for clarity in the prompt
  const riskItems = userItems.filter(i => i.weight > 0)
  const descalationItems = userItems.filter(i => i.weight < 0)

  const buildCatalog = (items: Evaluation_Item[]) =>
    items.map((item) =>
      `[${item.id}] ${item.name} (weight: ${item.weight}/100)\n` +
      `Description: ${item.description}\n` +
      `Key signals: ${item.key_signals}`
    ).join("\n\n")

  const recentContext = recentMessages.map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.message}`).join("\n")

  const system = `You are a conversation evaluation system for a humanitarian AI assistant that supports migrants and vulnerable populations.

Your role is to analyze interactions and detect risks, evaluate agent performance, and maintain a running profile of the user's situation.

## Risk Items — evaluate against USER MESSAGE
Detect these items based on what the user said. These increase the severity profile.

${buildCatalog(riskItems)}

## Descalation Items — evaluate against USER MESSAGE
Detect these items when the user indicates improvement, resolution, or protective factors. These reduce the severity profile. Only report if clearly confirmed by the user, not assumed.

${buildCatalog(descalationItems)}

## Items to evaluate against AGENT RESPONSE
Detect these items based on how the agent responded.

${buildCatalog(agentItems)}

## Instructions
- Analyze the user message, agent response, and recent context together.
- Use the contact's existing profile and narrative as background context only. Do not detect items based on the profile alone. Every detected item must be supported by explicit evidence in the current user message.
- detectedItems: match items from both Risk and Descalation sections based on the user message.
- agentEvaluation.detectedItems: only match items from the AGENT RESPONSE section.
- Do not repeat risk items already in the profile unless severity has changed.
- Descalation items can always be reported when clearly present.
- Detect escalation only if toLevel is strictly greater than fromLevel. If levels are equal, detected must be false.
- Only update the narrative summary if meaningful new information emerged. The summary must always include all prior history plus new developments. Never remove or summarize away existing information, only add.
- Be concise in all reasoning fields. One or two sentences maximum.
- Always return detectedItems and agentEvaluation.detectedItems as arrays, even if empty.
- Only report an item if there is direct and explicit evidence in the current message. Do not infer, extrapolate, or carry over assumptions from prior context unless the user explicitly references them in this message.
- A single message about movement restriction or relationship control must not trigger substance abuse, trafficking, or unrelated risk categories unless those are explicitly mentioned.
- Report any item with confidence >= 0.35. Below that threshold, omit the item entirely.
- Always respond in English regardless of the language used in the conversation.`

  const prompt = `## Contact Profile
Global Severity: ${contact.severity || 0}
Narrative: ${contact.summary || "No prior history."}
Known items: ${Object.keys(contact.evaluation || {}).length > 0
      ? Object.entries(contact.evaluation || {}).map(([id, v]) => `${id} (severity: ${v.lastSeverity || 0}, seen ${v.count || 0}x)`).join(", ")
      : "None"
    }

## Recent Conversation
${recentContext}

## Current Interaction
User: ${userMessage}
Agent: ${agentResponse}

Evaluate this interaction based on the catalog and contact profile above.`

  console.log("riskItems:", riskItems.length)
  console.log("descalationItems:", descalationItems.length)
  console.log("agentItems:", agentItems.length)

  const { object } = await generateObject({
    model: openai("gpt-5.4-nano"),
    schema: EvaluationSchema,
    schemaName: "ConversationEvaluation",
    schemaDescription: "Evaluation of a single interaction in a humanitarian support conversation",
    system,
    prompt,
  })

  return object

}

// --- Contact Updater ---

export function updateContact(contact: Contact, result: EvaluationResult, evalItems: Evaluation_Item[]): Contact {

  const now = new Date().toISOString()
  const updated = { ...contact }

  updated.evaluation = { ...contact.evaluation }

  // Build a quick weight lookup
  const weightMap = Object.fromEntries(evalItems.map(i => [i.id, i.weight]))

  for (const item of result.detectedItems) {
    const existing = updated.evaluation[item.itemId]

    if (existing) {
      existing.count += 1
      existing.lastSeverity = item.severity
      existing.lastSeen = now
    } else {
      updated.evaluation[item.itemId] = {
        count: 1,
        lastSeverity: item.severity,
        firstSeen: now,
        lastSeen: now,
      }
    }
  }

  // Recalculate global severity:
  // Sum positive severities weighted, then subtract descalation weights
  const positiveSeverities = Object.entries(updated.evaluation)
    .map(([id, v]) => {
      const w = weightMap[Number(id)] ?? 0
      return w > 0 ? v.lastSeverity : 0
    })

  const descalationTotal = result.detectedItems
    .filter(item => (weightMap[item.itemId] ?? 0) < 0)
    .reduce((acc, item) => acc + Math.abs(weightMap[item.itemId]), 0)

  // Base severity is the max of positive items, reduced by descalation
  const baseSeverity = positiveSeverities.length > 0 ? Math.max(...positiveSeverities) : 0

  // Each 20 points of descalation weight reduces severity by 1, min 0
  const descalationLevels = Math.floor(descalationTotal / 20)
  updated.severity = Math.max(0, baseSeverity - descalationLevels)

  if (result.narrativeUpdate.shouldUpdate && result.narrativeUpdate.newSummary) {
    updated.summary = result.narrativeUpdate.newSummary
  }

  updated.lasteval = now

  return updated

}





export async function generateSyntheticConversation(description: string, apiKey: string): Promise<{ role: "user" | "agent"; content: string }[]> {

  const openai = createOpenAI({ apiKey })

  const prompt = `
  
  ${description}

  - Do not label or annotate the messages, just generate the raw conversation

  ## Output Format
  Return a JSON array only, no markdown, no explanation. Each message must follow this exact structure:
  { "role": "user" | "agent", "content": "..." }
  
  `

  const { text } = await generateText({
    model: openai("gpt-4o"),
    prompt,
  })

  return JSON.parse(text) as { role: "user" | "agent"; content: string }[]
}