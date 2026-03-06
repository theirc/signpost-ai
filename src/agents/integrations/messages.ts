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

export function parsePhone(input: string): { digits: string | null, countryCode: string | null } {
  if (!input) return { digits: null, countryCode: null }
  const digits = input.replace(/\D/g, '')
  if (!digits) return { digits: null, countryCode: null }
  const match = input.match(/^\+?(\d{1,3})/)
  const countryCode = match ? match[1].padStart(3, '0') : null
  return { digits, countryCode }
}

export async function saveMessage({ integration, password, contact, team, role, message, agent }: MessageParamters): Promise<string> {

  if (!message) return

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

      await supabase.from("contacts").insert({
        id: contact,
        type: "user",
        data,
        team,
        name: faker.person.fullName({ sex }),
        avatar: faker.image.personPortrait({ size: 128, sex }),
        code,
      })
    }
  }

  await supabase.from("messages").insert({
    contact,
    role,
    message,
    channel: integration.type,
    team,
    agent,
  } satisfies Message)

  return contact

}

