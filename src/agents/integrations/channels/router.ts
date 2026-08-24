import { supabase } from "../../db"
import { channelRegistry } from "./registry"
import { firstMessage } from "./meta"
import type { MessengerEntry } from "../messenger/types"

// Meta delivers Messenger, Instagram and Whatsapp webhooks for every tenant to one shared callback url,
// so the channel can no longer be identified by the url itself (the per channel route in hook.ts keeps
// working untouched). Routing happens by business asset id instead: the facebook page, instagram account
// or whatsapp phone number that received the message.
//
// payload.object only says WHERE the asset id lives, never which channel type to run: instagram dms
// arrive as object "page" when the account is linked through the Messenger Platform. The routers row is
// the authority on the type.

type MetaObject = "page" | "instagram" | "whatsapp_business_account"

// A single endpoint receives both shapes mixed, so the entry is the Messenger one plus the whatsapp
// changes[] branch. The full whatsapp payload is WhatsAppWebhookPayload in ../whatsapp/hook.
interface RoutedEntry extends MessengerEntry {
  changes?: { value?: { metadata?: { phone_number_id?: string }, messages?: unknown[] } }[]
}

interface RoutedPayload {
  object?: string
  entry?: RoutedEntry[]
}

export async function processRouter(payload: RoutedPayload) {

  const object = payload?.object as MetaObject
  if (object !== "page" && object !== "instagram" && object !== "whatsapp_business_account") return

  // Meta batches events and a single post can carry entries for different assets, so each entry is
  // resolved on its own instead of only entry[0]. One failing entry must not drop the rest.
  for (const entry of payload.entry || []) {
    try {
      await routeEntry(object, entry)
    } catch (err) {
      console.error("[router] Entry error", err)
    }
  }

}

// Candidates, first match wins: entry.id is the asset for both meta shapes, but instagram setups also
// repeat it as recipient.id, and whatsapp keeps it inside changes[].value.metadata.
function assetIdsOf(object: MetaObject, entry: RoutedEntry): string[] {

  const ids: string[] = []
  const add = (id: string) => { if (id && !ids.includes(id)) ids.push(id) }

  if (object === "whatsapp_business_account") {
    for (const change of entry.changes || []) add(change.value?.metadata?.phone_number_id)
  } else {
    add(entry.id)
    for (const event of entry.messaging || []) add(event.recipient?.id)
  }

  return ids

}

// Delivery and read receipts, reactions, echoes of our own replies and whatsapp status updates all share
// the subscription and vastly outnumber real messages. They are dropped here, silently and before any
// query runs: at shared endpoint volume logging them would bury every real error.
function hasInboundMessage(object: MetaObject, entry: RoutedEntry): boolean {

  if (object === "whatsapp_business_account") return (entry.changes || []).some(change => !!change.value?.messages?.length)

  // Reuses the adapter's own filter so the echo and receipt rules stay defined in one place.
  return !!firstMessage({ entry: [entry] })

}

async function routeEntry(object: MetaObject, entry: RoutedEntry) {

  if (!hasInboundMessage(object, entry)) return

  const assetIds = assetIdsOf(object, entry)
  if (assetIds.length === 0) return

  const { data } = await supabase.from("routers").select("*").in("asset_id", assetIds)

  // Resolved in candidate order rather than by letting postgres pick, so a payload that happens to carry
  // two registered ids always lands on the same channel.
  const rows = (data || []) as Router[]
  const router = assetIds.map(id => rows.find(r => r.asset_id === id)).find(Boolean)

  // Unknown asset: nothing is written and no agent runs. Kept as a log because it only fires on real
  // inbound messages and it is the only trace of "this page is connected in Meta but has no router row".
  // The endpoint still answers 200: a non 2xx would make Meta retry and eventually disable the
  // subscription for every tenant at once.
  if (!router) {
    console.log(`[router] Unregistered asset: ${assetIds.join(", ")}`)
    return
  }

  const found = await supabase.from("channels").select("*").eq("id", router.channel).single()
  if (!found.data) {
    console.error(`[router] Channel not found: ${router.channel}`)
    return
  }

  // The row points at one specific channel, so the platform is whatever that channel declares. Storing it
  // on the router row too would only let the two contradict each other.
  const channel = found.data as Channel

  const process = channelRegistry[channel.type]
  if (!process) {
    console.error(`[router] Unsupported channel type: ${channel.type}`)
    return
  }

  // The adapters read payload.entry[...] directly, so the entry travels back inside its own envelope and
  // none of them need to know the router exists.
  await process(hydrate(channel, router, object), { object, entry: [entry] })

}

// The channel keeps the credentials; the router only fills in ids it already knows, so a channel row does
// not have to repeat what the webhook already carries.
function hydrate(channel: Channel, router: Router, object: MetaObject): Channel {

  const hydrated: Channel = { ...channel }

  if (channel.type === "whatsapp") {
    // The asset id IS the phone_number_id the send api expects.
    if (!hydrated.whatsapp_phoneid) hydrated.whatsapp_phoneid = router.asset_id
  } else if (object === "page" && !hydrated.settings?.page_id) {
    // Only object "page" carries a facebook page id. Under object "instagram" the asset is the instagram
    // account id while the send api still addresses the linked page, so it cannot be reused here and the
    // channel has to provide page_id itself.
    hydrated.settings = { ...hydrated.settings, page_id: router.asset_id }
  }

  return hydrated

}

/*
Transport lives in src/index.ts, on GET and POST /router: it verifies the handshake and the signature with
meta-verify.ts, answers immediately and hands the payload here.

- One shared Meta App means one META_APP_SECRET and one META_VERIFY_TOKEN, both from env. If a per tenant
  secret ever appears, only meta-verify.ts and that handler change.
- Meta preserves the query string of the configured callback url, so ".../router?app=xyz" is available if
  a second app ever needs its own verify token.
*/
