
type RunFn = (input: ChannelInput) => Promise<void>

export async function coordinate(entry: CachedContact, mode: Channel["debounce_type"], waitSeconds: number, input: ChannelInput, run: RunFn) {

  // Audio never accumulates: it can't be merged (STT happens inside the agent), so it always runs standalone.
  if (input.audio) {
    await run(input)
    return
  }

  mode ||= "none"
  if (mode === "debounce" && !waitSeconds) mode = "none"

  if (mode === "none") {
    await run(input)
    return
  }

  const d = entry.runtime.debounce ||= { items: [] }
  d.run = run

  if (mode === "debounce") {

    d.items.push(input)

    if (d.timer) clearTimeout(d.timer)

    d.timer = setTimeout(() => {
      d.timer = undefined
      const items = d.items
      d.items = []

      if (d.run && items.length) d.run(merge(items)).catch(err => console.error("[debounce] run error", err))

    }, waitSeconds * 1000)
    return
  }

  // singleAgentInstance: fire the first message right away, accumulate the rest while running, then drain.
  if (d.running) {
    d.items.push(input)
    return
  }

  d.running = true

  let current = [input]

  try {
    while (current.length) {
      await d.run(merge(current))
      current = d.items
      d.items = []
    }
  } finally {
    d.running = false
  }

}

function merge(items: ChannelInput[]): ChannelInput {
  if (items.length === 1) return items[0]
  const last = items[items.length - 1]
  return {
    content: items.map(i => i.content).filter(Boolean).join("\n"),
    files: items.flatMap(i => i.files || []),
    from: last.from,
    contactName: last.contactName,
    message_id: last.message_id,
  }
}
