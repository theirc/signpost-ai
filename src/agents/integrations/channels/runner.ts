import { agents } from "../../agent"
import { splitBreaks } from "./breaks"
import { cache, loadApiKeys } from "./cache"
import { coordinate } from "./debounce"
import { saveAndEvaluate } from "./conversation"

declare global {

  interface ChannelOutput {
    response: string
    files: string[]
    quickReplies: string[]
    audio?: { audio: string, ext: string }
  }

  interface ChannelParsed {
    input: ChannelInput
    integration: IntegrationPayload
  }

  interface ChannelAdapter<TPayload = any> {
    type: IntegrationsTypes
    // null: the event is ignored (echoes, delivery/read receipts). string: error. object: process it.
    parse(channel: Channel, payload: TPayload): Promise<ChannelParsed | string | null>
    typing?(channel: Channel, input: ChannelInput): Promise<void>
    send(channel: Channel, input: ChannelInput, out: ChannelOutput): Promise<void>
    notify?(channel: Channel, payload: TPayload, error: string): Promise<void>
  }

}

// Wraps an adapter into the (channel, payload) processor the registry dispatches to.
export function buildChannel<TPayload>(adapter: ChannelAdapter<TPayload>) {

  return async function process(channel: Channel, payload: TPayload) {

    let error: string

    try {
      error = await handle(adapter, channel, payload)
    } catch (err) {
      error = `${adapter.type} Hook Error: ${err || "Unknown error"}`
    }

    if (error) console.error(`${adapter.type}: ${error}`)

    if (channel.debug && error && adapter.notify) {
      try {
        await adapter.notify(channel, payload, error)
      } catch (err) {
        console.error(`Error sending ${adapter.type} Notification error ${err}`)
      }
    }

  }

}

async function handle<TPayload>(adapter: ChannelAdapter<TPayload>, channel: Channel, payload: TPayload): Promise<string> {

  if (!channel.agent) return "No agent in channel."
  if (!channel.team) return "No team in channel."

  const apiKeys = await loadApiKeys(channel.team)
  if (!apiKeys) return "No api keys found."

  const parsed = await adapter.parse(channel, payload)
  if (!parsed) return ""
  if (typeof parsed === "string") return parsed

  const { input, integration } = parsed

  if (adapter.typing) {
    try {
      await adapter.typing(channel, input)
    } catch (err) {
      console.error(`[channels] ${adapter.type} typing indicator error`, err)
    }
  }

  const cached = await cache.getContact(integration, channel.team, apiKeys.codec)
  if (!cached) return "Could not resolve contact."

  const run = (i: ChannelInput) => runAgent(adapter, channel, cached, i, apiKeys, integration)
  await coordinate(cached, channel.debounce_type, channel.debounce_time, input, run)

  return ""

}

async function runAgent<TPayload>(adapter: ChannelAdapter<TPayload>, channel: Channel, cached: CachedContact, input: ChannelInput, apiKeys: APIKeys, integration: IntegrationPayload) {

  const a = await agents.loadAgent(channel.agent, channel.team)
  if (!a) return

  const p: AgentParameters = {
    input: { message: input.content, files: input.files },
    uid: cached.contact.id,
    apiKeys,
  }
  if (input.audio) p.input.audio = input.audio

  await a.execute(p)
  if (p.error) { console.error(`${adapter.type} Agent Error: ${p.error}`); return }

  const out: ChannelOutput = {
    response: p.output?.response,
    files: p.output?.files || [],
    quickReplies: p.output?.quickreplies || [],
    audio: p.output?.audio,
  }

  for (const chunk of splitBreaks(out)) await adapter.send(channel, input, chunk)

  // Persist + evaluate AFTER answering, fire-and-forget so the agent is free to keep going (single-instance lock already released).
  saveAndEvaluate({
    agent: a,
    contact: cached.contact,
    message: input.content,
    response: out.response,
    apiKeys,
    integration: { ...integration, message_id: input.message_id },
    type: adapter.type,
    team: channel.team,
  }).catch(err => console.error("[channels] saveAndEvaluate error", err))

}
