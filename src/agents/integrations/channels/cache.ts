import { supabase } from "../../db"
import { getOrCreateContact } from "../messages"
import mergeWith from "lodash/mergeWith"

declare global {

  interface ChannelInput {
    content: string
    files: { url: string, type: string, filename?: string }[]
    audio?: { audio: string, ext: string }
    from: string
    contactName?: string
    message_id?: string
  }

  interface DebounceState {
    items: ChannelInput[]
    timer?: ReturnType<typeof setTimeout>
    running?: boolean
    run?: (input: ChannelInput) => Promise<void>
  }

  interface CachedContact {
    contact: Contact
    runtime: { debounce?: DebounceState }
    lastAccess: number
  }

}

const TTL = 6 * 60 * 60 * 1000       // evict contacts inactive for 6h
const SWEEP_INTERVAL = 10 * 60 * 1000 // check for eviction every 10min

const store = new Map<string, CachedContact>()
const idToKey = new Map<string, string>()
let started = false

function normalizePhone(phone: string): string {
  return (phone || "").replace(/\D/g, "")
}

// Phone for the providers that have one, provider id (ie. "messenger:<psid>") for the ones that don't.
function contactKey(integration: IntegrationPayload): string {
  return normalizePhone(integration.phone) || integration.external_id || ""
}

function replaceArrays(_target: any, source: any) {
  if (Array.isArray(source)) return source
}

function sweep() {
  const cutoff = Date.now() - TTL
  for (const [key, entry] of store) {
    if (entry.lastAccess > cutoff) continue
    const d = entry.runtime.debounce
    if (d?.running || d?.timer) continue
    store.delete(key)
    idToKey.delete(entry.contact.id)
  }
}

function init() {
  if (started) return
  started = true

  supabase
    .channel("contacts-cache")
    .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, (payload) => {
      const row = (payload.new ?? payload.old) as any
      const id = row?.id
      if (!id) return
      const key = idToKey.get(id)
      if (!key) return
      if (payload.eventType === "DELETE") {
        store.delete(key)
        idToKey.delete(id)
        return
      }
      const entry = store.get(key)
      if (entry) mergeWith(entry.contact, payload.new, replaceArrays)
    })
    .subscribe()

  setInterval(sweep, SWEEP_INTERVAL)
}

async function getContact(integration: IntegrationPayload, team: string, codecKey: string): Promise<CachedContact | null> {

  const key = contactKey(integration)
  if (!key || !codecKey) return null

  const existing = store.get(key)
  if (existing) {
    existing.lastAccess = Date.now()
    return existing
  }

  init()

  const contact = await getOrCreateContact(integration, codecKey, team)
  if (!contact?.id) return null

  const entry: CachedContact = { contact, runtime: {}, lastAccess: Date.now() }
  store.set(key, entry)
  idToKey.set(contact.id, key)
  return entry
}

// Realtime keeps the cached contact in sync, but it lands asynchronously. Commands answer right away,
// so they apply their own patch with the same merge the realtime handler uses.
function updateContact(contactId: string, patch: any) {
  const key = idToKey.get(contactId)
  if (!key) return
  const entry = store.get(key)
  if (entry) mergeWith(entry.contact, patch, replaceArrays)
}

// After a reset the queued messages would run against a state that no longer exists.
function clearPending(contactId: string) {
  const key = idToKey.get(contactId)
  if (!key) return
  const d = store.get(key)?.runtime.debounce
  if (!d) return
  if (d.timer) clearTimeout(d.timer)
  d.timer = undefined
  d.items = []
}

export async function loadApiKeys(team: string): Promise<APIKeys | null> {
  const ak = await supabase.from("api_keys").select("*").eq("team_id", team)
  if (!ak.data || ak.error) return null
  return ak.data.reduce<Record<string, string>>((acc, key) => {
    if (key.type && key.key) acc[key.type] = key.key
    return acc
  }, {}) as APIKeys
}

export const cache = { getContact, init, updateContact, clearPending }
