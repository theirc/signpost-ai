import { faker } from "@faker-js/faker"
import { supabase } from "../../db"
import { contacts } from "../contacts"
import { cache, loadApiKeys } from "./cache"

interface Command {
  aliases: string[]
  run: (contactId: string) => Promise<string>
}

// Commands run in the channel layer, before the agent is loaded. Aliases carry the translations:
// adding a language is adding a string. They must never throw: a failing command answers with text.
//
// These are internal and must NEVER be published to a provider's command menu (Telegram's setMyCommands,
// BotFather, or any equivalent): they are meant to be unguessable, not discoverable.
const commands: Command[] = [
  { aliases: ["/reset", "/إعادة تشغيل"], run: reset },
  { aliases: ["/deanonymizeme"], run: deanonymize },
  { aliases: ["/anonymizeme"], run: anonymize },
  { aliases: ["/deleteme"], run: deleteMe },
]

const byAlias = new Map<string, Command>()
for (const command of commands) for (const alias of command.aliases) byAlias.set(alias, command)

// Pure lookup, no network and no db: channels call it before spending anything on the message.
export function matchCommand(message: string): Command | null {
  if (typeof message !== "string") return null
  const clean = message.trim().toLowerCase()
  if (!clean || clean[0] !== "/") return null
  return byAlias.get(clean) || null
}

// Returns the response text when a command ran, null when the message was not a command.
export async function processCommand(message: string, contactId: string): Promise<string | null> {
  try {
    const command = matchCommand(message)
    if (!command || !contactId) return null
    return await command.run(contactId)
  } catch (err) {
    console.error("[commands] Unexpected command error:", err)
    return "Command failed."
  }
}

// Exported so the contact CRUD page can run the same cleanup before deleting the contact row itself.
export async function reset(contactId: string): Promise<string> {

  await supabase.from("states").delete().eq("id", contactId)
  await supabase.from("history").delete().eq("uid", contactId)
  await supabase.from("messages").delete().eq("contact", contactId)

  const patch = {
    evaluation: null,
    severity: 0,
    lasteval: null,
    summary: null,
    hitl: null,
    hitled: null,
    extractions: null,
    internal_comments: null,
    moderation_data: null,
    no_reply_needed: null,
  }

  await supabase.from("contacts").update(patch).eq("id", contactId)

  cache.updateContact(contactId, patch)
  cache.clearPending(contactId)

  return "The chat history and state has been reset."
}

// Same cleanup as /reset, then the contact row itself. Once the row is gone the cache entry is evicted
// outright rather than patched, so the next message from this contact starts completely fresh.
async function deleteMe(contactId: string): Promise<string> {

  await reset(contactId)
  await supabase.from("contacts").delete().eq("id", contactId)
  cache.evictContact(contactId)

  return "This contact and all its data have been deleted."
}

// Contacts are stored with a faker name while the real identity stays encrypted in contacts.data, so
// de-anonymizing is decrypting that payload and writing the real name back. Both commands only touch the
// name: the avatar is always a faker portrait, there is no real one to restore or to hide.
async function deanonymize(contactId: string): Promise<string> {

  const { data: contact } = await supabase.from("contacts").select("data,team").eq("id", contactId).single()
  if (!contact) return "Contact not found."

  const apiKeys = await loadApiKeys(contact.team)
  const payload = await contacts.decrypt(contact, apiKeys?.codec)
  if (!payload) return "Invalid encrypted data."

  const name = payload.name || payload.phone
  if (!name) return "Invalid encrypted data."

  await supabase.from("contacts").update({ name }).eq("id", contactId)
  cache.updateContact(contactId, { name })

  return `Contact de-anonymized: ${name}.`
}

// Same name generation used when the contact is created in getOrCreateContact. contacts.data is never
// touched, so anonymize/de-anonymize can be alternated indefinitely.
async function anonymize(contactId: string): Promise<string> {

  const patch = { name: faker.person.fullName({ sex: faker.person.sexType() }) }

  await supabase.from("contacts").update(patch).eq("id", contactId)
  cache.updateContact(contactId, patch)

  return `Contact anonymized as ${patch.name}.`
}
