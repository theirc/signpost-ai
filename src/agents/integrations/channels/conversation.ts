import { supabase } from "../../db"
import { saveMessage } from "../messages"
import { evaluate, updateContact } from "../../evals/evals"

interface SaveAndEvaluateParams {
  agent: Agent
  contact: Contact
  message: string
  response: string
  apiKeys: APIKeys
  integration: IntegrationPayload
  type: IntegrationsTypes
  team: string
}

// Persist the interaction and run evaluations. For webhooks it's called fire-and-forget after answering
// (no lag, agent free to continue); for app it's awaited before returning. Replicates agent.updateEvaluations.
export async function saveAndEvaluate({ agent, contact, message, response, apiKeys, integration, type, team }: SaveAndEvaluateParams) {

  let userMessageId: string = null
  let agentMessageId: string = null

  try {
    if (message) {
      const um = await saveMessage({ contact: contact.id, role: "user", message, channel: type, team, agent: agent.id, integration })
      userMessageId = um.id
    }
    if (response) {
      const am = await saveMessage({ contact: contact.id, role: "assistant", message: response, channel: type, team, agent: agent.id, integration })
      agentMessageId = am.id
    }
  } catch (err) {
    console.error("[channels] Error saving messages:", err)
  }

  await runEvals(agent, contact, message, response, userMessageId, agentMessageId, apiKeys)

}

async function runEvals(agent: Agent, contact: Contact, message: string, response: string, userMessageId: string, agentMessageId: string, apiKeys: APIKeys) {

  if (!contact) return
  if (!message) return
  if (!userMessageId || !agentMessageId) return
  if (!apiKeys || !apiKeys.openai) return
  if (!agent.evalItems?.length) return

  try {

    const { data: items, error: itemsError } = await supabase.from("eval_items").select().in("id", agent.evalItems)
    if (itemsError) throw itemsError
    if (items.length === 0) return
    const { data: recent, error: messageError } = await supabase.from("messages").select().eq("contact", contact.id).order("created_at", { ascending: false }).limit(10)
    if (messageError) throw messageError
    const messages = (recent || []).slice().reverse()

    const result = await evaluate({
      userMessage: message,
      agentResponse: response,
      recentMessages: messages as any,
      contact,
      evalItems: items as any,
      keys: apiKeys,
      language: agent.summaryLanguage,
      agentSummary: agent.evaluation,
    })

    const updated = updateContact(contact, result, items as any)

    await supabase.from("agents").update({
      evaluation: result.agentEvaluation.summary,
    }).eq('id', agent.id)

    await supabase.from("messages").update({
      user_detected_items: result.detectedItems || null,
      escalation_from_level: result.escalation?.fromLevel || null,
      escalation_to_level: result.escalation?.toLevel || null,
      escalation_reasoning: result.escalation?.reasoning || null,
    }).eq('id', userMessageId)

    await supabase.from("messages").update({
      agent_appropriate: result.agentEvaluation?.appropriate || false,
      agent_concern_level: result.agentEvaluation?.concernLevel || null,
      agent_reasoning: result.agentEvaluation?.reasoning || null,
      narrative_update: (result.narrativeUpdate?.shouldUpdate && result.narrativeUpdate?.newSummary) ? result.narrativeUpdate?.newSummary : null,
      agent_detected_items: result.agentEvaluation?.detectedItems || null,
    }).eq('id', agentMessageId)

    await supabase.from('contacts').update({
      evaluation: updated.evaluation as any || null,
      severity: updated.severity || null,
      lasteval: new Date().toISOString(),
      summary: updated.summary || null,
    }).eq('id', contact.id)

  } catch (error) {
    console.error("Error during Evaluation:", error)
  }
}
