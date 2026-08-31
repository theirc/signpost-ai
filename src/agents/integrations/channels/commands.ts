import { faker } from "@faker-js/faker"
import { supabase } from "../../db"
import { codec } from "../encoder"
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

async function reset(contactId: string): Promise<string> {

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

// Contacts are stored with a faker name while the real identity stays encrypted in contacts.data, so
// de-anonymizing is decrypting that payload and writing the real name back. Both commands only touch the
// name: the avatar is always a faker portrait, there is no real one to restore or to hide.
async function deanonymize(contactId: string): Promise<string> {

  const { data: contact } = await supabase.from("contacts").select("data,team").eq("id", contactId).single()
  if (!contact) return "Contact not found."

  const apiKeys = await loadApiKeys(contact.team)
  const payload = await parseContactData(contact.data, apiKeys?.codec)
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

// contacts.data is not guaranteed to hold what we expect: decrypt throws on a bad key or corrupt input,
// legacy rows hold plain json, and someone may have written anything in there. Never throws, null on invalid.
async function parseContactData(raw: any, codecKey: string): Promise<IntegrationPayload | null> {

  if (typeof raw !== "string" || !raw.trim()) return null

  let parsed: any = null

  try {
    parsed = JSON.parse(raw)
  } catch {
    if (!codecKey) {
      console.error("[commands] No codec key available to decrypt contact data")
      return null
    }
    try {
      parsed = JSON.parse(await codec.decrypt(raw, codecKey))
    } catch (err) {
      console.error("[commands] Could not decrypt contact data:", err)
      return null
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.error("[commands] Contact data is not an object")
    return null
  }

  if (!parsed.name && !parsed.phone && !parsed.external_id && !parsed.contact_id) {
    console.error("[commands] Contact data has no identity fields")
    return null
  }

  return parsed as IntegrationPayload
}
