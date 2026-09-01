import Handlebars from "handlebars"

const ROUTING_BUDGET = 10
const DEFAULT_MAX_ATTEMPTS = 2

// The request plus the scratch of the turn. Spread rather than mutated so the object the caller built stays untouched
type Ctx = PlaybookRequest & {
  state: PlaybookState
  texts: string[]
  trace: PlaybookTrace[]
  recoveries: number
}

/**
 * Runs one turn of the playbook. Pure over its request: clones the incoming state and returns the new one.
 * With a null state (or a null cursor) it boots the session: enters the first item of main and ignores the input.
 * Async because an ai item awaits the adapter, and because the interception hooks will await too.
 */
export async function step(request: PlaybookRequest): Promise<PlaybookTurn> {

  const { playbook, state, input } = request

  const fresh: PlaybookState = {
    playbook_version: playbook.version,
    rev: 0,
    cursor: null,
    stack: [],
    vars: {},
    attempts: 0
  }

  const ctx: Ctx = {
    ...request,
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

  // A cursor we have not entered yet. Boot and recovery are the same shape, and in both the message of
  // the turn is dropped: there is no item that asked for it. Held instead of entered right away so an
  // interrupt gets to push it first and the return lands on it
  let entering: PlaybookCursor | null = null

  // Session boot. A null cursor is both a session that never started and one closed by "end"
  if (!ctx.state.cursor) {
    const items = flowItems(playbook, "main")
    if (!items.length) {
      trace(ctx, { layer: "boot", note: "the main flow is empty" })
      return finish(ctx, false)
    }
    entering = { flow: "main", item: items[0].id }
    ctx.state.cursor = entering
    trace(ctx, { layer: "boot", flow: "main", item: items[0].id })
  }

  // The playbook was edited while this conversation was live and the cursor no longer resolves.
  // Restart instead of going mute
  else if (!currentItem(ctx)) {
    entering = recover(ctx, ctx.state.cursor)
    if (!entering) return finish(ctx)
    ctx.state.cursor = entering
  }

  /**
   * Level 0: interrupts, triggered by state where the globals are triggered by text. Nothing is stored:
   * an interrupt is pending until the flow it calls writes the var that falsifies its condition, and
   * being pending is the whole mechanism.
   *
   * A contact already inside that flow is answering it, so it does not take the turn again. It does seal
   * it, because the point of a terms of service is that no global and no no-match escalation walks past
   * it. And routing out with the condition still pending takes the conversation right back: a pending
   * interrupt is a magnet, not a one shot
   */
  const pending = (ctx.playbook.interrupts || []).filter(i => meets(i.condition, ctx.state.vars))
  const sealed = pending.some(i => ctx.state.cursor?.flow === flowOf(i.then))

  if (pending.length && !sealed) {
    trace(ctx, { layer: "interrupt", outcome: pending[0].then, note: `pending: ${pending[0].condition.join(" ")}` })
    runChain(ctx, pending[0].then)
    return finish(ctx)
  }

  if (entering) {
    runChain(ctx, moveAndEnter(ctx, entering))
    return finish(ctx)
  }

  const item = currentItem(ctx)!

  // Level 1: global guards. The first one that claims the message wins and the other levels do not run.
  // Silent while an interrupt seals the turn: "menu" cannot be a way around a terms of service
  if (!sealed) for (const guard of ctx.playbook.globals || []) {
    if (!matches(guard.match, message)) continue
    if (guard.set) Object.assign(ctx.state.vars, guard.set)
    trace(ctx, { layer: "global", outcome: guard.then || "next" })
    runChain(ctx, guard.then || "next")
    return finish(ctx)
  }

  // Level 3: item interpretation (level 2, local escapes, does not exist yet).
  // The label is the primary alias; the id is what the channel sends back when a button is tapped.
  // Nothing but a catch-all can claim an empty message, which is what an image with no caption looks like
  const value = normalize(message)
  const option = (item.options || []).find(o => matches(o.match, message) || (!!value && (normalize(o.label) === value || optionId(o) === value)))

  if (option) {
    if (option.set) Object.assign(ctx.state.vars, option.set)
    emit(ctx, option.say)
    trace(ctx, { layer: "item", option: optionId(option), outcome: option.then || "next" })
    runChain(ctx, option.then || "next")
    return finish(ctx)
  }

  // An ai item answers whatever its options did not claim, and never falls into no-match: not matching
  // an escape is the normal case here. It always keeps the cursor, so the conversation only leaves
  // through an escape the contact picked or a global guard
  if (item.type === "ai") {
    await answer(ctx, item, message)
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

    // The escalation is one more way out, so it is off while an interrupt seals the turn. What is left is
    // reasking, and the way out is whatever option the author declared on the interrupt itself
    if (ctx.state.attempts > max && policy.then && !sealed) {
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
    // Closing the session, not freezing it: the next message boots a fresh one from main. vars go with it,
    // because what "end" means is that this run is over — a contact who refused consent should not leave
    // anything behind, and nothing else depends on them surviving. last_inbound_id stays: it is
    // idempotency, not conversation data
    if (pending === "end") {
      ctx.state.cursor = null
      ctx.state.stack = []
      ctx.state.vars = {}
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

  // Saying something is what makes an item wait: the cursor rests here until the next message.
  // An ai item waits with or without a preamble, because answering the next message is the whole point of it
  if (item.say || item.type === "ai") {
    emit(ctx, item.say)
    trace(ctx, { layer: "enter", note: "waiting for a message" })
    return null
  }

  const outcome = item.then || "next"
  trace(ctx, { layer: "enter", outcome, note: "routing item" })
  return outcome
}

// ── Model ───────────────────────────────────────────────────────────────────

/**
 * Hands the turn to the injected adapter and emits whatever prose comes back. The cursor never moves:
 * an ai item is absorbing by construction and only its options or a global guard get the contact out.
 * A missing adapter or a failing one costs the turn and nothing else — the item stays, so the next
 * message tries again. Preventing the call when the pieces are missing is the job of the outer layer
 */
async function answer(ctx: Ctx, item: PlaybookItem, message: string) {

  // Same rule the deterministic levels follow: an empty message, which is what an image with no caption
  // looks like, claims nothing. Here it would also be a paid call to answer nothing
  if (!message.trim()) {
    trace(ctx, { layer: "ai", outcome: "stay:silent", note: "empty message, not calling the model" })
    return
  }

  if (!ctx.ai) {
    trace(ctx, { layer: "ai", outcome: "stay:silent", note: "no ai adapter was passed" })
    return
  }

  try {
    const result = await ctx.ai({
      model: ctx.playbook.config?.model,
      prompt: interpolate(ctx, item.prompt || ""),
      message,
      vars: ctx.state.vars,
      tools: ctx.tools
    })

    // Pushed raw: what the model wrote is prose, not a template to interpolate a second time
    if (result?.text) ctx.texts.push(result.text)
    trace(ctx, { layer: "ai", outcome: "stay:silent", note: result?.text ? undefined : "the adapter returned no text" })
  }
  catch (e: any) {
    trace(ctx, { layer: "ai", outcome: "stay:silent", note: `the ai adapter failed: ${e?.message || e}` })
  }
}

// ── Recovery ────────────────────────────────────────────────────────────────

/**
 * Resolves a cursor that no longer points anywhere, which happens when the playbook is edited while
 * conversations are live. This is the last resort, not the plan: where a live conversation should
 * continue when its item is deleted is a question for whoever is saving the edit, and the answer
 * belongs to the playbook. Until the validator asks it, this is what keeps the contact from going mute.
 *
 * Degrades one level at a time: the item is gone but the flow is still there, so the flow restarts and
 * its data gates re-derive the position; the whole flow is gone, so the conversation restarts and a
 * couple of questions get asked again. Returns null only when there is nowhere left to go
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

// The flow an outcome lands in, for "call:<flow>" and "goto:<flow>.<item>". Null for everything else
function flowOf(outcome: PlaybookOutcome): string | null {
  if (outcome?.startsWith("call:")) return outcome.slice(5)
  if (outcome?.startsWith("goto:")) return outcome.slice(5).split(".")[0]
  return null
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

/**
 * The wire identity of an option: what the channel puts in the button and hands back when it is tapped.
 * Derived from the label so the author declares it only when it has to survive a rewording — a button
 * already sitting in someone's chat comes back with the id it was sent with, whatever the label says now
 */
function optionId(option: PlaybookOption): string {
  return option.id || normalize(option.label)
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

// Compiled once per distinct text, so a long conversation on one item does not recompile it every turn.
// The set is bounded by the texts of the playbooks in memory
const templates = new Map<string, ReturnType<typeof Handlebars.compile>>()

function compile(text: string, strict: boolean) {
  const key = (strict ? "!" : "") + text
  let template = templates.get(key)

  // noEscape because this goes to a chat, not to HTML: with the default, "R&D" viaja como "R&amp;D"
  if (!template) {
    template = Handlebars.compile(text, { noEscape: true, strict })
    templates.set(key, template)
  }
  return template
}

/**
 * Renders authored text: say, the say of an option and the prompt of an ai item. Never the answer of a
 * model, which is prose and not a template.
 *
 * Strict first, so a var that is not there throws and the trace names it; then loose, so the contact reads
 * a clean message instead of a visible placeholder. Strict only complains about a bare {{var}}: a missing
 * var inside {{#if}} is just absent, which is what that if is for — guarding an optional value, not routing
 */
function interpolate(ctx: Ctx, text: string): string {
  if (!text.includes("{{")) return text

  try { return compile(text, true)(ctx.state.vars) }
  catch (e: any) {
    trace(ctx, { layer: "template", note: `${e?.message || e}` })
    try { return compile(text, false)(ctx.state.vars) } catch { return text }
  }
}

function emit(ctx: Ctx, text: string | undefined) {
  if (!text) return
  ctx.texts.push(interpolate(ctx, text))
}

function trace(ctx: Ctx, entry: Omit<PlaybookTrace, "seq">) {
  const full: PlaybookTrace = { seq: ctx.trace.length, flow: ctx.state.cursor?.flow, item: ctx.state.cursor?.item, ...entry }
  ctx.trace.push(full)

  // Nothing is awaited and nothing propagates: an observer must not be able to alter or break the turn
  if (!ctx.hooks?.onTrace) return
  try { Promise.resolve(ctx.hooks.onTrace(full)).catch(() => { }) } catch { }
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
    if (option.label) replies.push({ id: optionId(option), label: option.label })
  }

  if (replies.length) output.quick_replies = replies

  return { output, state: ctx.state, trace: ctx.trace }
}
