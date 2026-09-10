import { codec } from "./encoder"

declare global {

  // Everything that lives encrypted inside contacts.data. All optional: what gets stored depends on the
  // channel the contact came from, and legacy rows may carry only part of it.
  interface ContactPayload {
    name?: string
    phone?: string

    //Provider id for channels without a phone number, prefixed with the channel type (ie. "messenger:<psid>")
    external_id?: string

    //Telerivet
    route_id?: string
    contact_id?: string
  }

}

// The real identity of a contact lives encrypted in contacts.data. Everything else in the row (name,
// avatar) is faker data, so this pair is the only way in and out of that payload.
async function encrypt(payload: ContactPayload, password: string): Promise<string> {
  return await codec.encrypt(JSON.stringify(payload), password)
}

// contacts.data is not guaranteed to hold what we expect: decrypt throws on a bad key or corrupt input,
// legacy rows hold plain json, and someone may have written anything in there. Never throws, null on invalid.
async function decrypt(contact: Contact, password: string): Promise<ContactPayload | null> {

  const raw: any = contact?.data
  if (typeof raw !== "string" || !raw.trim()) return null

  let parsed: any = null

  try {
    parsed = JSON.parse(raw)
  } catch {
    if (!password) {
      console.error("[contacts] No codec key available to decrypt contact data")
      return null
    }
    try {
      parsed = JSON.parse(await codec.decrypt(raw, password))
    } catch (err) {
      console.error("[contacts] Could not decrypt contact data:", err)
      return null
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.error("[contacts] Contact data is not an object")
    return null
  }

  if (!parsed.name && !parsed.phone && !parsed.external_id && !parsed.contact_id) {
    console.error("[contacts] Contact data has no identity fields")
    return null
  }

  return parsed as ContactPayload
}

export const contacts = {
  encrypt,
  decrypt,
}
