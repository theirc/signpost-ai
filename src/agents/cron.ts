import { supabase } from "./db"
import { Database } from "./supabase"
import { whatsapp } from "./integrations/whatsapp"
import { codec } from "./integrations/encoder"

type Job = Database["public"]["Tables"]["jobs"]["Row"]

export async function executeCronJobs() {

  const { data, error } = await supabase.from("jobs").select("*")
  if (error || !data) {
    console.error("Error fetching cron jobs:", error)
    throw error
  }

  if (data.length === 0) {
    console.log("No cron jobs to execute")
    return
  }

  const now = new Date()

  for (const job of data) {

    const params = typeof job.parameters === "string" ? JSON.parse(job.parameters) : job.parameters
    const timeZone = params && typeof params === "object" ? (params as any).timezone : undefined

    // Evaluate the schedule in the campaign's own timezone, falling back to the server's.
    const { hour, weekday, dayOfMonth } = getZonedParts(now, timeZone)

    const range = job.range || 0
    if (hour != range) continue

    if (job.type === 0) {

      //Hourly
      await executeJob(job)

    } else if (job.type === 1) {

      //Daily
      const weekdayFlags = [job.sun, job.mon, job.tue, job.wed, job.thu, job.fri, job.sat]
      if (weekdayFlags[weekday]) await executeJob(job)

    } else if (job.type === 2) {

      //Monthly
      if (dayOfMonth === job.day) await executeJob(job)

    }

  }

}

// Returns hour (0-23), weekday (0=Sun..6=Sat) and day-of-month for `date` in the given IANA timezone.
function getZonedParts(date: Date, timeZone?: string): { hour: number; weekday: number; dayOfMonth: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      weekday: "short",
      hour: "2-digit",
      day: "2-digit",
    }).formatToParts(date)
    const get = (t: string) => parts.find(p => p.type === t)?.value || ""
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    return {
      hour: parseInt(get("hour"), 10) % 24,
      weekday: weekdayMap[get("weekday")] ?? date.getDay(),
      dayOfMonth: parseInt(get("day"), 10),
    }
  } catch {
    return { hour: date.getHours(), weekday: date.getDay(), dayOfMonth: date.getDate() }
  }
}

async function executeJob(job: Job) {

  let apiKeys: Record<string, string> = {}
  if (job.team) {
    const { data, error } = await supabase.from("api_keys").select("*").eq("team_id", job.team)
    if (error) {
      console.error('Error fetching api keys:', error)
    } else {
      apiKeys = data?.reduce<Record<string, string>>((acc, key) => {
        if (key.type && key.key) {
          acc[key.type] = key.key
        }
        return acc
      }, {}) || {}
    }
  }

  const params = typeof job.parameters === "string" ? JSON.parse(job.parameters) : job.parameters

  if (params && typeof params === "object" && (params as any).kind === "whatsapp_template") {
    await sendCampaign(job, params as any, apiKeys)
  }

}

type CampaignParameters = {
  kind: "whatsapp_template"
  channel?: string
  template: string
  language?: string
  timezone?: string
  components?: { name: string; value: string }[]
  all_team?: boolean
  contact_ids?: string[]
  area_code?: string
  last_heard_days?: number
}

// Maps the campaign's simple name/value list to the WhatsApp Graph API `components` shape (named body parameters).
function buildComponents(items?: { name: string; value: string }[]): any {
  if (!Array.isArray(items) || items.length === 0) return undefined
  return [{
    type: "body",
    parameters: items.map(i => ({ type: "text", parameter_name: i.name, text: i.value })),
  }]
}

async function sendCampaign(job: Job, params: CampaignParameters, apiKeys: Record<string, string>) {

  const password = apiKeys.codec

  if (!params.channel || !password) {
    console.error(`Campaign ${job.id}: missing channel or codec credentials for team ${job.team}`)
    return
  }

  const { data: channel, error: channelError } = await supabase.from("channels").select("whatsapp_token,whatsapp_phoneid").eq("id", params.channel).single()
  if (channelError || !channel) {
    console.error(`Campaign ${job.id}: error fetching channel ${params.channel}:`, channelError)
    return
  }

  const token = channel.whatsapp_token
  const phoneid = channel.whatsapp_phoneid

  if (!token || !phoneid) {
    console.error(`Campaign ${job.id}: channel ${params.channel} missing whatsapp credentials`)
    return
  }

  let query = supabase.from("contacts").select("id,data")
  if (params.all_team) {
    query = query.eq("team", job.team).eq("type", "user")
  } else {
    query = query.in("id", params.contact_ids || [])
  }

  // Skip contacts we haven't heard from lately. A contact that never wrote has no timestamp and never matches, which is intended.
  const lastHeardDays = Number(params.last_heard_days) || 0
  if (lastHeardDays > 0) query = query.gte("last_inbound_at", new Date(Date.now() - lastHeardDays * 86400000).toISOString())

  const { data: contacts, error } = await query
  if (error || !contacts) {
    console.error(`Campaign ${job.id}: error fetching contacts:`, error)
    return
  }

  // Optional area-code prefix filter (all-team only). Compared on digits-only, so it tolerates "+", spaces, dashes.
  const areaCode = params.all_team ? String(params.area_code || "").replace(/\D/g, "") : ""

  for (const contact of contacts) {
    try {
      if (!contact.data) continue
      const phone = JSON.parse(await codec.decrypt(contact.data as string, password)).phone
      if (!phone) continue
      if (areaCode && !String(phone).replace(/\D/g, "").startsWith(areaCode)) continue
      const result = await whatsapp.sendTemplate({
        phone: phoneid,
        token,
        to: phone,
        template: params.template,
        language: params.language,
        components: buildComponents(params.components),
      })
      if (result) console.error(`Campaign ${job.id} -> contact ${contact.id}:`, result)
    } catch (err) {
      console.error(`Campaign ${job.id} -> contact ${contact.id}: send failed`, err)
    }
  }

}

