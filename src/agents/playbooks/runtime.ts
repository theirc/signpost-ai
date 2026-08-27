const ROUTING_BUDGET = 10
const DEFAULT_MAX_ATTEMPTS = 2

type Ctx = {
  playbook: Playbook
  state: PlaybookState
  texts: string[]
  trace: PlaybookTrace[]
  recoveries: number
}

/**
 * Runs one deterministic turn of the playbook. Pure: clones the incoming state and returns the new one.
 * With a null state (or a null cursor) it boots the session: enters the first item of main and ignores the input.
 */
export function step(playbook: Playbook, state: PlaybookState | null, input: PlaybookInput): PlaybookTurn {

  const fresh: PlaybookState = {
    playbook_version: playbook.version,
    rev: 0,
    cursor: null,
    stack: [],
    vars: {},
    attempts: 0
  }

  const ctx: Ctx = {
    playbook,
    state: state ? JSON.parse(JSON.stringify(state)) : fresh,
    texts: [],
    trace: [],
    recoveries: 0
  }

  const message = input?.message || ""

  if (input?.id && input.id === ctx.state.last_inbound_id) {
    trace(ctx, { layer: "duplicate", note: `inbound already processed: ${input.id}` })
    return finish(ctx, false)
  }

  if (input?.id) ctx.state.last_inbound_id = input.id

  // Session boot. A null cursor is both a session that never started and one closed by "end"
  if (!ctx.state.cursor) {
    const items = flowItems(playbook, "main")
    if (!items.length) {
      trace(ctx, { layer: "boot", note: "the main flow is empty" })
      return finish(ctx, false)
    }
    trace(ctx, { layer: "boot", flow: "main", item: items[0].id })
    runChain(ctx, moveAndEnter(ctx, { flow: "main", item: items[0].id }))
    return finish(ctx)
  }

  // The playbook was edited while this conversation was live and the cursor no longer resolves.
  // Restart instead of going mute. The message of this turn is dropped, same as on a boot
  const item = currentItem(ctx)
  if (!item) {
    const target = recover(ctx, ctx.state.cursor)
    if (target) runChain(ctx, moveAndEnter(ctx, target))
    return finish(ctx)
  }

  // Level 1: global guards. The first one that claims the message wins and the other levels do not run
  for (const guard of ctx.playbook.globals || []) {
    if (!matches(guard.match, message)) continue
    if (guard.set) Object.assign(ctx.state.vars, guard.set)
    trace(ctx, { layer: "global", outcome: guard.then || "next" })
    runChain(ctx, guard.then || "next")
    return finish(ctx)
  }

  // Level 3: item interpretation (level 2, local escapes, does not exist yet).
  // The label is the primary alias; the id is what the channel sends back when a button is tapped
  const value = normalize(message)
  const option = (item.options || []).find(o => matches(o.match, message) || (o.label && normalize(o.label) === value) || normalize(o.id) === value)

  if (option) {
    if (option.set) Object.assign(ctx.state.vars, option.set)
    emit(ctx, option.say)
    trace(ctx, { layer: "item", option: option.id, outcome: option.then || "next" })
    runChain(ctx, option.then || "next")
    return finish(ctx)
  }

  // A slot cannot fail, so it also absorbs whatever the options did not claim
  if (item.slot) {
    ctx.state.vars[item.slot] = message.trim()
    trace(ctx, { layer: "item", outcome: item.then || "next", note: `slot ${item.slot}` })
    runChain(ctx, item.then || "next")
    return finish(ctx)
  }

  // Level 4: no-match policy. Only reachable on items with options
  if (item.options?.length) {
    const policy = item.on_no_match || ctx.playbook.defaults?.on_no_match || { policy: "reask" as const }
    const max = policy.max ?? DEFAULT_MAX_ATTEMPTS
    ctx.state.attempts++

    if (ctx.state.attempts > max && policy.then) {
      trace(ctx, { layer: "no_match", outcome: policy.then, note: `attempts ${ctx.state.attempts} > max ${max}` })
      ctx.state.attempts = 0
      runChain(ctx, policy.then)
      return finish(ctx)
    }

    trace(ctx, { layer: "no_match", outcome: "stay:reask", note: `attempt ${ctx.state.attempts}/${max}` })
    emit(ctx, item.say)
    return finish(ctx)
  }

  // Absorbing item: it says something and offers nothing to match against. Only a global moves it
  trace(ctx, { layer: "item", outcome: "stay:silent", note: "absorbing item" })
  return finish(ctx)
}

// ── Control ─────────────────────────────────────────────────────────────────

// Applies the outcome and walks the chain of routing items until one of them says something
function runChain(ctx: Ctx, outcome: PlaybookOutcome | null) {
  let pending = outcome
  let budget = ROUTING_BUDGET

  while (pending) {
    if (budget-- <= 0) {
      trace(ctx, { layer: "enter", note: `routing budget exhausted (${ROUTING_BUDGET})` })
      return
    }

    if (pending === "stay:silent") return
    if (pending === "stay:reask") {
      emit(ctx, currentItem(ctx)?.say)
      return
    }
    // Closing the session, not freezing it: the next message boots a fresh one from main
    if (pending === "end") {
      ctx.state.cursor = null
      ctx.state.stack = []
      return
    }

    if (pending === "next") {
      // Array order defines what "next" means, and nothing else
      const items = flowItems(ctx.playbook, ctx.state.cursor?.flow)
      const next = items[items.findIndex(i => i.id === ctx.state.cursor?.item) + 1]
      if (!next) {
        trace(ctx, { layer: "enter", note: "no next item: the item is absorbing" })
        return
      }
      pending = moveAndEnter(ctx, { flow: ctx.state.cursor.flow, item: next.id })
      continue
    }

    if (pending === "return") {
      const frame = ctx.state.stack.pop()
      if (!frame) {
        trace(ctx, { layer: "enter", note: "return with an empty stack" })
        return
      }
      pending = moveAndEnter(ctx, frame)
      continue
    }

    if (pending.startsWith("goto:")) {
      const [flow, item] = pending.slice(5).split(".")
      if (!flow || !item) {
        trace(ctx, { layer: "enter", note: `malformed goto, expected goto:flow.item: ${pending}` })
        return
      }
      pending = moveAndEnter(ctx, { flow, item })
      continue
    }

    if (pending.startsWith("call:")) {
      const flow = pending.slice(5)
      const items = flowItems(ctx.playbook, flow)
      if (!items.length) {
        trace(ctx, { layer: "enter", note: `call to a missing or empty flow: ${flow}` })
        return
      }
      ctx.state.stack.push({ ...ctx.state.cursor })
      pending = moveAndEnter(ctx, { flow, item: items[0].id })
      continue
    }

    trace(ctx, { layer: "enter", note: `unknown outcome: ${pending}` })
    return
  }
}

// Moves the cursor and enters the item. Returns the pending outcome, or null if the cursor rests here
function moveAndEnter(ctx: Ctx, cursor: PlaybookCursor): PlaybookOutcome | null {
  const item = getItem(ctx.playbook, cursor)

  // Recurses at most once: recover only ever returns a cursor that resolves
  if (!item) {
    const target = recover(ctx, cursor)
    if (!target) return null
    return moveAndEnter(ctx, target)
  }

  ctx.state.cursor = { ...cursor }
  ctx.state.attempts = 0

  if (item.condition && !meets(item.condition, ctx.state.vars)) {
    const outcome = item.else || "next"
    trace(ctx, { layer: "enter", outcome, note: `condition not met: ${item.condition.join(" ")}` })
    return outcome
  }

  // Saying something is what makes an item wait: the cursor rests here until the next message
  if (item.say) {
    emit(ctx, item.say)
    trace(ctx, { layer: "enter", note: "waiting for a message" })
    return null
  }

  const outcome = item.then || "next"
  trace(ctx, { layer: "enter", outcome, note: "routing item" })
  return outcome
}

// ── Recovery ────────────────────────────────────────────────────────────────

/**
 * Resolves a cursor that no longer points anywhere, which happens when the playbook is edited
 * while conversations are live. Degrades one level at a time: the item is gone but the flow is still
 * there, so the flow restarts; the whole flow is gone, so the conversation restarts. vars survive
 * either way, so the conditions of the items walked on the way back land the contact where it was.
 * Returns null only when there is nowhere left to go, and then the session closes
 */
function recover(ctx: Ctx, cursor: PlaybookCursor): PlaybookCursor | null {
  ctx.recoveries++

  // The item is gone but the flow is still there, so the flow restarts.
  // The stack is left alone: the frames below still describe a valid return point
  const items = flowItems(ctx.playbook, cursor.flow)
  if (ctx.recoveries === 1 && items.length) {
    trace(ctx, { layer: "recover", note: `missing item ${cursor.flow}.${cursor.item}, restarting the flow` })
    return { flow: cursor.flow, item: items[0].id }
  }

  // Either the whole flow is gone, or restarting it landed on the same hole: the routing of a flow can
  // point straight back at the deleted item. The frames point into a layout that no longer holds
  const main = flowItems(ctx.playbook, "main")
  if (ctx.recoveries <= 2 && main.length) {
    ctx.state.stack = []
    trace(ctx, { layer: "recover", note: `cannot resolve ${cursor.flow}.${cursor.item}, restarting the conversation` })
    return { flow: "main", item: main[0].id }
  }

  // main routes into the hole as well. Close the session: the next message boots a fresh one
  ctx.state.cursor = null
  ctx.state.stack = []
  trace(ctx, { layer: "recover", note: `unrecoverable from ${cursor.flow}.${cursor.item}, closing the session` })
  return null
}

// ── Playbook reads ──────────────────────────────────────────────────────────

// "main" is a reserved cursor key that addresses playbook.main; anything else is a satellite flow
function flowItems(playbook: Playbook, flow: string): PlaybookItem[] {
  return (flow === "main" ? playbook.main : playbook.flows?.[flow]) || []
}

function getItem(playbook: Playbook, cursor: PlaybookCursor): PlaybookItem | null {
  return flowItems(playbook, cursor?.flow).find(i => i.id === cursor?.item) || null
}

function currentItem(ctx: Ctx): PlaybookItem | null {
  return ctx.state.cursor ? getItem(ctx.playbook, ctx.state.cursor) : null
}

// ── Pure helpers ────────────────────────────────────────────────────────────

// Trim, lowercase, no diacritics and no emojis, so a label like "🏥 Medical care" matches "medical care"
export function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

function matches(list: string[] | undefined, text: string): boolean {
  const value = normalize(text)
  return (list || []).some(m => m === "*" || normalize(m) === value)
}

// Closed vocabulary, stored already split: ["var"] is a truth test,
// ["var", test] asks about presence, ["var", op, value] compares
function meets(condition: PlaybookCondition, vars: { [key: string]: any }): boolean {
  const left = vars?.[condition[0]]
  if (condition.length === 1) return !!left

  // Presence, not truth: 0 and false are set. Writing null or "" with set is how an item invalidates a var
  if (condition.length === 2) {
    const set = left !== undefined && left !== null && left !== ""
    return condition[1] === "isSet" ? set : !set
  }

  const right = condition[2]
  const same = typeof left === "string" && typeof right === "string" ? normalize(left) === normalize(right) : left === right

  switch (condition[1]) {
    case "==": return same
    case "!=": return !same
    case ">": return Number(left) > Number(right)
    case ">=": return Number(left) >= Number(right)
    case "<": return Number(left) < Number(right)
    case "<=": return Number(left) <= Number(right)
  }
}

// ── Turn accumulators ───────────────────────────────────────────────────────

function emit(ctx: Ctx, text: string | undefined) {
  if (!text) return
  ctx.texts.push(text.replace(/\{(\w+)\}/g, (_, key) => (ctx.state.vars?.[key] !== undefined ? String(ctx.state.vars[key]) : `{${key}}`)))
}

function trace(ctx: Ctx, entry: Omit<PlaybookTrace, "seq">) {
  ctx.trace.push({ seq: ctx.trace.length, flow: ctx.state.cursor?.flow, item: ctx.state.cursor?.item, ...entry })
}

// Assembles the envelope: every text of the turn joined, plus the options of the item the cursor came to rest on
function finish(ctx: Ctx, bump = true): PlaybookTurn {
  if (bump) ctx.state.rev++

  const output: PlaybookOutput = {}
  if (!ctx.texts.length) return { output, state: ctx.state, trace: ctx.trace }

  output.response = ctx.texts.join("\n\n")

  // The buttons ride on the message, so a turn that says nothing carries none
  const replies: PlaybookQuickReply[] = []

  for (const option of currentItem(ctx)?.options || []) {
    if (option.label) replies.push({ id: option.id, label: option.label })
  }

  if (replies.length) output.quick_replies = replies

  return { output, state: ctx.state, trace: ctx.trace }
}
