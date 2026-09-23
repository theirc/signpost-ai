import Handlebars from "handlebars"

const NEXT: PlaybookOutcome = { type: "next" }
const RESET: PlaybookOutcome = { type: "reset" }

// The whole escape of an ai item, which declares no options. A stand-in until the model can leave
// through a tool, and the reason it is a literal and not authorable: nobody should be able to get it wrong
const EXIT = "exit"

type Ctx = PlaybookRequest & {
  texts: string[]
  trace: PlaybookTrace[]
  reset: boolean
}

export async function play(request: PlaybookRequest): Promise<PlaybookTurn> {

  request.playbook.main ||= []
  request.input ||= {}
  const { playbook, state, input } = request

  const fresh: PlaybookState = { playbook_version: playbook.version, cursor: null, vars: {} }

  const ctx: Ctx = {
    ...request,
    state: state ? JSON.parse(JSON.stringify(state)) : fresh,
    texts: [],
    trace: [],
    reset: false
  }

  if (!playbook.main.length) {
    trace(ctx, { layer: "boot", note: "the main flow is empty" })
    return finish(ctx)
  }

  const message = input.message || ""

  if (input.id && input.id === ctx.state.last_inbound_id) {
    trace(ctx, { layer: "duplicate", note: `inbound already processed: ${input.id}` })
    return finish(ctx)
  }

  if (input.id) ctx.state.last_inbound_id = input.id

  if (!ctx.state.cursor) {
    trace(ctx, { layer: "boot", flow: "main", item: playbook.main[0].id })
    runChain(ctx, { type: "goto", flow: "main", item: playbook.main[0].id }, null)
    return finish(ctx)
  }

  const item = currentItem(ctx)

  if (!item) {
    runChain(ctx, lost(ctx, ctx.state.cursor), null)
    return finish(ctx)
  }
  runChain(ctx, item.type === "ai" ? await answerAI(ctx, item, message) : answerItem(ctx, item, message), ctx.state.cursor)
  return finish(ctx)
}

function answerItem(ctx: Ctx, item: PlaybookItem, message: string): PlaybookOutcome | null {

  const option = pick(ctx, item, message)
  if (option) return take(ctx, option)

  if (item.set) {
    ctx.state.vars[item.set] = message.trim()
    trace(ctx, { layer: "item", outcome: "next", note: `set ${item.set}` })
    return NEXT
  }

  if (available(ctx, item).length) {
    trace(ctx, { layer: "no_match", note: "nothing matched, asking again" })
    emit(ctx, (item.on_no_match || ctx.playbook.defaults?.on_no_match)?.say)
    emit(ctx, item.say)
    return null
  }

  trace(ctx, { layer: "item", outcome: "next", note: "the item declares no way to consume a message" })
  return NEXT
}

async function answerAI(ctx: Ctx, item: PlaybookItem, message: string): Promise<PlaybookOutcome | null> {

  if (normalize(message) === EXIT) {
    trace(ctx, { layer: "ai", outcome: "next", note: "the contact typed exit" })
    return NEXT
  }

  if (!ctx.ai) {
    trace(ctx, { layer: "ai", note: "no ai adapter was passed" })
    return null
  }

  try {
    const result = await ctx.ai({
      model: ctx.playbook.config?.model,
      prompt: interpolate(ctx, item.prompt || ""),
      message,
      vars: ctx.state.vars,
      tools: ctx.tools
    })

    if (result?.text) ctx.texts.push(result.text)
    trace(ctx, { layer: "ai", note: result?.text ? undefined : "the adapter returned no text" })
  }
  catch (e: any) {
    trace(ctx, { layer: "ai", note: `the ai adapter failed: ${e?.message || e}` })
  }

  return null
}

function pick(ctx: Ctx, item: PlaybookItem, message: string): PlaybookOption | undefined {
  const value = normalize(message)
  if (!value) return undefined
  return available(ctx, item).find(o => normalize(o.label) === value || optionId(o) === value || matches(o.match, message))
}

function take(ctx: Ctx, option: PlaybookOption): PlaybookOutcome {
  if (option.set) Object.assign(ctx.state.vars, option.set)
  emit(ctx, option.say)
  trace(ctx, { layer: "item", option: optionId(option), outcome: label(option.action || NEXT) })
  return option.action || NEXT
}

// ── Control ─────────────────────────────────────────────────────────────────

function runChain(ctx: Ctx, outcome: PlaybookOutcome | null, from: PlaybookCursor | null) {

  let pending = outcome
  let at = from

  while (pending) {

    if (pending.type === "goto") {
      at = { flow: pending.flow, item: pending.item }
      pending = enter(ctx, at)
      continue
    }

    if (pending.type === "reset") {
      if (ctx.reset) {
        trace(ctx, { layer: "enter", flow: at?.flow, item: at?.item, note: "a second reset in one turn: every item of main is filtered out" })
        return
      }
      ctx.reset = true
      at = { flow: "main", item: ctx.playbook.main[0].id }
      pending = enter(ctx, at)
      continue
    }

    if (pending.type === "next") {
      // Array order defines what "next" means, and nothing else
      const items = at ? flowItems(ctx.playbook, at.flow) : []
      const next = items[items.findIndex(i => i.id === at?.item) + 1]

      if (!at || !next) {
        trace(ctx, { layer: "enter", flow: at?.flow, item: at?.item, outcome: "reset", note: "ran past the last item of the flow" })
        pending = RESET
        continue
      }

      at = { flow: at.flow, item: next.id }
      pending = enter(ctx, at)
      continue
    }

    trace(ctx, { layer: "enter", flow: at?.flow, item: at?.item, note: `unknown action: ${(pending as any)?.type}` })
    return
  }
}

function enter(ctx: Ctx, cursor: PlaybookCursor): PlaybookOutcome | null {

  const item = getItem(ctx.playbook, cursor)
  if (!item) return lost(ctx, cursor)

  if (item.condition && !meets(item.condition, ctx.state.vars)) {
    trace(ctx, { ...cursor, layer: "enter", outcome: "next", note: `condition not met: ${item.condition.join(" ")}` })
    return NEXT
  }

  if (!item.say && item.type !== "ai") {
    trace(ctx, { ...cursor, layer: "enter", outcome: "next", note: "the item has nothing to say" })
    return NEXT
  }

  ctx.state.cursor = { ...cursor }
  emit(ctx, item.say)
  trace(ctx, { layer: "enter", note: "waiting for a message" })
  return null
}

function lost(ctx: Ctx, cursor: PlaybookCursor): PlaybookOutcome | null {
  const target = ctx.playbook.config?.on_lost || { flow: "main", item: ctx.playbook.main[0].id }

  if (!getItem(ctx.playbook, target)) {
    ctx.state.cursor = null
    trace(ctx, { layer: "lost", note: `${cursor.flow}.${cursor.item} is gone and so is on_lost, closing the session` })
    return null
  }

  trace(ctx, { layer: "lost", note: `${cursor.flow}.${cursor.item} is gone, going to ${target.flow}.${target.item}` })
  return { type: "goto", flow: target.flow, item: target.item }
}

// ── Playbook reads ──────────────────────────────────────────────────────────

function available(ctx: Ctx, item: PlaybookItem | null): PlaybookOption[] {
  return (item?.options || []).filter(o => !o.condition || meets(o.condition, ctx.state.vars))
}

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

export function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

function optionId(option: PlaybookOption): string {
  return option.id || normalize(option.label)
}

function matches(list: string[] | undefined, text: string): boolean {
  const value = normalize(text)
  return !!value && (list || []).some(m => normalize(m) === value)
}

function meets(condition: PlaybookCondition, vars: { [key: string]: any }): boolean {
  const left = vars?.[condition[0]]
  if (condition.length === 1) return !!left

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

const templates = new Map<string, ReturnType<typeof Handlebars.compile>>()

function compile(text: string, strict: boolean) {
  const key = (strict ? "!" : "") + text
  let template = templates.get(key)

  if (!template) {
    template = Handlebars.compile(text, { noEscape: true, strict })
    templates.set(key, template)
  }
  return template
}

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

function label(outcome: PlaybookOutcome): string {
  return outcome.type === "goto" ? `goto:${outcome.flow}.${outcome.item}` : outcome.type
}

function trace(ctx: Ctx, entry: Omit<PlaybookTrace, "seq">) {
  const full: PlaybookTrace = { seq: ctx.trace.length, flow: ctx.state.cursor?.flow, item: ctx.state.cursor?.item, ...entry }
  ctx.trace.push(full)

  if (!ctx.hooks?.onTrace) return
  try { Promise.resolve(ctx.hooks.onTrace(full)).catch(() => { }) } catch { }
}

function finish(ctx: Ctx): PlaybookTurn {

  const output: PlaybookOutput = {}
  if (!ctx.texts.length) return { output, state: ctx.state, trace: ctx.trace }

  output.response = ctx.texts.join("\n\n")

  const replies: PlaybookQuickReply[] = []

  for (const option of available(ctx, currentItem(ctx))) {
    if (option.label) replies.push({ id: optionId(option), label: option.label })
  }

  if (replies.length) output.quick_replies = replies

  return { output, state: ctx.state, trace: ctx.trace }
}
