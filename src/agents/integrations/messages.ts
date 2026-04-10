import { supabase } from "../db"
import { codec } from "./encoder"
import { faker } from '@faker-js/faker'



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
    const contactKey = integration.contact || integration.phone || integration.contact_id
    if (!contactKey) return null

    const { digits, countryCode } = parsePhone(integration.phone)
    const id = integration.contact ? integration.contact : await codec.encrypt(digits || integration.phone || integration.contact_id, password)

    const data = await codec.encrypt(JSON.stringify({
      name: integration.name,
      phone: integration.phone,
      route_id: integration.route_id,
      contact_id: integration.contact_id,
    } satisfies IntegrationPayload), password)

    const { data: existingContact } = await supabase.from("contacts").select().eq("id", id).single()
    if (existingContact) {
      await supabase.from("contacts").update({ team, data }).eq("id", id)
      return existingContact as any
    }

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

export async function saveMessage(message: Message): Promise<Message> {
  if (message.integration) {
    const { phone, name, apiKey, ...rest } = message.integration
    message.integration = rest
  }
  const { data, error } = await supabase.from("messages").insert(message as any).select().single()
  if (error) throw error
  return data as any
}
