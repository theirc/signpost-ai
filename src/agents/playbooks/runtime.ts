const ROUTING_BUDGET = 10
const DEFAULT_MAX_ATTEMPTS = 2

type Ctx = {
  playbook: Playbook
  state: PlaybookState
  emissions: PlaybookElement[]
  trace: PlaybookTrace[]
}

/**
 * Runs one deterministic turn of the playbook. Pure: clones the incoming state and returns the new one.
 * With a null state (or a null cursor) it boots the session: enters the first item of the entry flow and ignores the input.
 */
export function step(playbook: Playbook, state: PlaybookState | null, input: PlaybookInput): PlaybookTurn {
  const ctx: Ctx = { playbook, state: state ? JSON.parse(JSON.stringify(state)) : initState(playbook), emissions: [], trace: [] }
  const text = input?.text || ""

  // Session boot
  if (!ctx.state.cursor) {
    const flow = playbook.flows?.[playbook.entry]
    if (!flow?.length) {
      trace(ctx, { layer: "boot", note: `entry flow missing or empty: ${playbook.entry}` })
      return result(ctx)
    }
    trace(ctx, { layer: "boot", flow: playbook.entry, item: flow[0].id })
    runChain(ctx, moveAndEnter(ctx, { flow: playbook.entry, item: flow[0].id }))
    return finish(ctx)
  }

  if (input?.id && input.id === ctx.state.last_inbound_id) {
    trace(ctx, { layer: "duplicate", note: `inbound already processed: ${input.id}` })
    return result(ctx)
  }

  if (ctx.state.status === "ended") {
    trace(ctx, { layer: "ended" })
    return result(ctx)
  }

  if (input?.id) ctx.state.last_inbound_id = input.id

  const item = currentItem(ctx)
  if (!item) {
    trace(ctx, { layer: "item", note: "the cursor points to a missing item" })
    return finish(ctx)
  }

  // Level 1: global guards. The first one that claims the message wins and the other levels do not run
  for (const guard of ctx.playbook.globals || []) {
    if (!matches(guard.match, text)) continue
    if (guard.set) Object.assign(ctx.state.vars, guard.set)
    trace(ctx, { layer: "global", outcome: guard.then })
    runChain(ctx, guard.then)
    return finish(ctx)
  }

  // Level 3: item interpretation (level 2, local escapes, does not exist in v1)
  if (item.interpret === "exact") {
    const option = (item.options || []).find(o => matchesOption(o, text))
    if (!option) return noMatch(ctx, item)
    if (option.set) Object.assign(ctx.state.vars, option.set)
    emit(ctx, expand(ctx, item, option.say))
    trace(ctx, { layer: "item", option: option.id, outcome: option.then })
    runChain(ctx, option.then)
    return finish(ctx)
  }

  if (item.slot) {
    if (!validate(item.slot.validate, text)) return noMatch(ctx, item)
    ctx.state.vars[item.slot.name] = text.trim()
    trace(ctx, { layer: "item", outcome: item.then || "next", note: `slot ${item.slot.name}` })
    runChain(ctx, item.then || "next")
    return finish(ctx)
  }

  // The cursor should never rest on a routing item: the entry chain does not stop on them
  trace(ctx, { layer: "item", note: "the cursor is resting on a routing item" })
  return finish(ctx)
}

// ── Resolution levels ───────────────────────────────────────────────────────

// Level 4: no-match policy
function noMatch(ctx: Ctx, item: PlaybookItem): PlaybookTurn {
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
  emit(ctx, expand(ctx, item, item.say))
  return finish(ctx)
}

// Applies the outcome and walks the chain of routing items until one of them consumes the message
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
      const item = currentItem(ctx)
      if (item) emit(ctx, expand(ctx, item, item.say))
      return
    }
    if (pending === "end") {
      ctx.state.status = "ended"
      return
    }

    if (pending === "next") {
      const next = nextCursor(ctx)
      if (!next) {
        trace(ctx, { layer: "enter", note: "no next item: the item is absorbing" })
        return
      }
      pending = moveAndEnter(ctx, next)
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
      const items = ctx.playbook.flows?.[flow]
      if (!items?.length) {
        trace(ctx, { layer: "enter", note: `call to a missing or empty flow: ${flow}` })
        return
      }
      if (ctx.state.cursor) ctx.state.stack.push({ ...ctx.state.cursor })
      pending = moveAndEnter(ctx, { flow, item: items[0].id })
      continue
    }

    trace(ctx, { layer: "enter", note: `unknown outcome: ${pending}` })
    return
  }
}

// Moves the cursor and enters the item. Returns the pending outcome, or null if the cursor rests here
function moveAndEnter(ctx: Ctx, cursor: PlaybookCursor): PlaybookOutcome | null {
  const item = getItem(ctx, cursor)
  if (!item) {
    trace(ctx, { layer: "enter", note: `missing item: ${cursor.flow}.${cursor.item}` })
    return null
  }

  ctx.state.cursor = { ...cursor }
  ctx.state.attempts = 0

  if (item.requires && !requires(item.requires, ctx.state.vars)) {
    const outcome = item.else || "next"
    trace(ctx, { layer: "enter", outcome, note: `requires not met: ${item.requires}` })
    return outcome
  }

  emit(ctx, expand(ctx, item, item.say))

  if (consumes(item)) {
    trace(ctx, { layer: "enter", note: "waiting for a message" })
    return null
  }

  const outcome = item.then || "next"
  trace(ctx, { layer: "enter", outcome, note: "routing item" })
  return outcome
}

// ── Playbook reads ──────────────────────────────────────────────────────────

function getItem(ctx: Ctx, cursor: PlaybookCursor): PlaybookItem | null {
  return (ctx.playbook.flows?.[cursor?.flow] || []).find(i => i.id === cursor?.item) || null
}

function currentItem(ctx: Ctx): PlaybookItem | null {
  return ctx.state.cursor ? getItem(ctx, ctx.state.cursor) : null
}

// Array order defines what "next" means, and nothing else
function nextCursor(ctx: Ctx): PlaybookCursor | null {
  const cursor = ctx.state.cursor
  const items = ctx.playbook.flows?.[cursor?.flow] || []
  const index = items.findIndex(i => i.id === cursor?.item)
  if (index < 0 || index + 1 >= items.length) return null
  return { flow: cursor.flow, item: items[index + 1].id }
}

// Having interpret or slot is what makes the item consume the message
function consumes(item: PlaybookItem): boolean {
  return !!item.interpret || !!item.slot
}

// ── Pure helpers ────────────────────────────────────────────────────────────

function initState(playbook: Playbook): PlaybookState {
  return { playbook_version: playbook.version, rev: 0, cursor: null, stack: [], vars: {}, attempts: 0, status: "active" }
}

export function normalize(text: string): string {
  return (text || "").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
}

function matches(list: string[], text: string): boolean {
  const value = normalize(text)
  return (list || []).some(m => m === "*" || normalize(m) === value)
}

// The id and the label work as implicit aliases: the id covers numeric aliases ("1", "2", "3"),
// and the label covers the user typing back the text of a quick reply instead of tapping it
function matchesOption(option: PlaybookOption, text: string): boolean {
  const value = normalize(text)
  return matches(option.match, text) || normalize(option.id) === value || (!!option.label && normalize(option.label) === value)
}

function interpolate(text: string, vars: { [key: string]: any }): string {
  return (text || "").replace(/\{(\w+)\}/g, (_, key) => (vars?.[key] !== undefined ? String(vars[key]) : `{${key}}`))
}

// Interpolates the texts and resolves the quick replies declared with from: "options"
function expand(ctx: Ctx, item: PlaybookItem, elements: PlaybookElement[]): PlaybookElement[] {
  const out: PlaybookElement[] = []

  for (const element of elements || []) {
    if (element.kind === "quick_replies") {
      const options = element.from === "options"
        ? (item.options || []).filter(o => o.label).map(o => ({ id: o.id, label: o.label }))
        : (element.options || [])
      if (options.length) out.push({ kind: "quick_replies", options })
      continue
    }
    out.push({ kind: "text", content: interpolate(element.content, ctx.state.vars) })
  }

  return out
}

// Closed vocabulary: "text" | "text:min..max" | "number" | "number:min..max"
function validate(rule: string, text: string): boolean {
  const value = (text || "").trim()
  if (!value) return false

  const [kind, range] = (rule || "").split(":")
  const [rawMin, rawMax] = (range || "").split("..")
  const min = rawMin ? Number(rawMin) : null
  const max = rawMax ? Number(rawMax) : null

  if (kind === "text") return (min === null || value.length >= min) && (max === null || value.length <= max)

  if (kind === "number") {
    const parsed = Number(value)
    if (Number.isNaN(parsed)) return false
    return (min === null || parsed >= min) && (max === null || parsed <= max)
  }

  return false
}

// Closed vocabulary: "var op literal" with == != >= <= > <, or a bare "var" meaning flag present
function requires(expression: string, vars: { [key: string]: any }): boolean {
  const comparison = (expression || "").trim().match(/^([A-Za-z_]\w*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/)

  if (!comparison) {
    const flag = (expression || "").trim()
    return /^[A-Za-z_]\w*$/.test(flag) ? !!vars?.[flag] : false
  }

  const left = vars?.[comparison[1]]
  const right = literal(comparison[3])

  switch (comparison[2]) {
    case "==": return equals(left, right)
    case "!=": return !equals(left, right)
    case ">": return Number(left) > Number(right)
    case ">=": return Number(left) >= Number(right)
    case "<": return Number(left) < Number(right)
    case "<=": return Number(left) <= Number(right)
  }

  return false
}

function literal(raw: string): any {
  const value = raw.trim().replace(/^["']|["']$/g, "")
  if (value === "true") return true
  if (value === "false") return false
  if (value !== "" && !Number.isNaN(Number(value))) return Number(value)
  return value
}

function equals(left: any, right: any): boolean {
  if (typeof left === "string" && typeof right === "string") return normalize(left) === normalize(right)
  return left === right
}

// ── Turn accumulators ───────────────────────────────────────────────────────

function emit(ctx: Ctx, elements: PlaybookElement[]) {
  for (const element of elements) ctx.emissions.push(element)
}

function trace(ctx: Ctx, entry: Omit<PlaybookTrace, "seq">) {
  ctx.trace.push({ seq: ctx.trace.length, flow: ctx.state.cursor?.flow, item: ctx.state.cursor?.item, ...entry })
}

function result(ctx: Ctx): PlaybookTurn {
  return { emissions: ctx.emissions, state: ctx.state, trace: ctx.trace }
}

function finish(ctx: Ctx): PlaybookTurn {
  ctx.state.rev++
  return result(ctx)
}
