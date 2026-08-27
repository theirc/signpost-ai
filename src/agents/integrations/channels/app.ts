import { supabase } from "../../db"
import { saveAndEvaluate } from "./conversation"

// App is a direct front-end chat. The agent is already loaded/hydrated by the caller and passed in,
// and p arrives with p.integration = { contact, type: "app" } (contact = the contact id).
// We strip integration to disable the agent's internal contact/message/eval handling, run it, and
// then save + evaluate synchronously (no cache, no debounce) before returning the full p.
export async function app(a: Agent, p: AgentParameters): Promise<AgentParameters> {

  const contactId = p.integration?.contact
  p.uid ||= contactId

  delete p.integration

  await a.execute(p)
  if (p.error) return p

  if (contactId) {
    const { data } = await supabase.from("contacts").select().eq("id", contactId).single()
    const contact = data as unknown as Contact
    if (contact) {
      await saveAndEvaluate({
        agent: a,
        contact,
        message: p.input?.message,
        response: p.output?.response,
        apiKeys: p.apiKeys,
        integration: { type: "app" },
        type: "app",
        team: p.team,
      })
    }
  }

  return p

}
