import { supabase } from "../db"
import { codec } from "./encoder"
import { faker } from '@faker-js/faker'

interface MessageParamters {
  contact?: string //Contact ID if exists.
  role?: MessageRoles
  message?: string
  agent?: number
  integration?: IntegrationPayload
  password?: string
  team?: string
}

function parsePhone(input: string): { digits: string | null, countryCode: string | null } {
  if (!input) return { digits: null, countryCode: null }
  const digits = input.replace(/\D/g, '')
  if (!digits) return { digits: null, countryCode: null }
  const match = input.match(/^\+?(\d{1,3})/)
  const countryCode = match ? match[1].padStart(3, '0') : null
  return { digits, countryCode }
}

export async function getOrCreateContact(integration: IntegrationPayload, password: string, team: string): Promise<Contact> {
  try {
    if (!integration) return null
    const contactKey = integration.contact || integration.phone
    if (!contactKey) return null

    const { digits, countryCode } = parsePhone(integration.phone)
    const id = await codec.encrypt(digits || integration.phone, password)

    const { data: existingContact } = await supabase.from("contacts").select().eq("id", id).single()
    if (existingContact) return existingContact as any

    const data = await codec.encrypt(JSON.stringify({
      name: integration.name,
      phone: integration.phone,
    }), password)

    const sex = faker.person.sexType()

    const { data: createdContact, error } = await supabase.from("contacts").insert({
      id,
      type: "user",
      data,
      team,
      name: faker.person.fullName({ sex }),
      avatar: faker.image.personPortrait({ size: 128, sex }),
      code: countryCode,
    }).select().single()

    if (error) throw error
    return createdContact as any
  } catch (err) {
    console.error("Error getting or creating contact", err)
    return null
  }
}

export async function saveMessage({ integration, password, contact, team, role, message, agent }: MessageParamters): Promise<{ contact: Contact, messageId: string }> {

  if (!message) return
  let selectedContact: Contact = null

  if (!contact && role === "user" && integration.type !== "app") {

    const { data: existingContact } = await supabase.from("contacts").select().eq("id", contact).single()

    if (!existingContact) {

      let code = null

      if (integration.type === "telerivet") {
        const { digits, countryCode } = parsePhone(integration.phone)
        contact = await codec.encrypt(digits || integration.phone, password)
        code = countryCode
      }

      const data = await codec.encrypt(JSON.stringify({
        name: integration.name,
        phone: integration.phone,
      }), password)

      const sex = faker.person.sexType()

      selectedContact = await supabase.from("contacts").insert({
        id: contact,
        type: "user",
        data,
        team,
        name: faker.person.fullName({ sex }),
        avatar: faker.image.personPortrait({ size: 128, sex }),
        code,
      }).select() as any

    } else {
      selectedContact = existingContact as any
    }
  }

  if (contact && !selectedContact) {
    const { data: existingContact } = await supabase.from("contacts").select().eq("id", contact).single()
    if (existingContact) {
      selectedContact = existingContact as any
    }
  }

  const { data } = await supabase.from("messages").insert({
    contact,
    role,
    message,
    channel: integration.type,
    team,
    agent,
  } satisfies Message).select()

  return {
    contact: selectedContact,
    messageId: data[0].id
  }

}
