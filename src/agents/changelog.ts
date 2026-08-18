import { workerRegistry } from "./registry"
import { inputOutputTypes } from "./worker"

// Deterministic Markdown report of how an agent's structure changed between two
// getAgentToSave() snapshots (baseline vs current).

interface SavedWorker {
  id?: string
  type: WorkerTypes
  handles?: WorkerHandles
  parameters?: Record<string, any>
}

export interface SavedAgentConfig {
  title?: string
  description?: string
  type?: string
  edges?: EdgeConnections
  workers?: SavedWorker[]
  config?: {
    evalItems?: (number | string)[]
    [key: string]: any
  }
}

interface ChangeDocOptions {
  author?: string
  date?: Date
  evalItemTitles?: Record<string, string>
}

interface ConnectionChange {
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
}

interface ParamChange {
  label: string
  before: any
  after: any
  isText: boolean
}

interface WorkerParamChanges {
  workerLabel: string
  changes: ParamChange[]
}

interface WorkerConditionChanges {
  workerLabel: string
  changes: string[]
}

export interface ChangeSet {
  workersAdded: string[]
  workersRemoved: string[]
  connectionsAdded: ConnectionChange[]
  connectionsRemoved: ConnectionChange[]
  parametersChanged: WorkerParamChanges[]
  conditionsChanged: WorkerConditionChanges[]
  settingsChanged: string[]
}

export interface ChangeDocResult {
  title: string
  document: string
  changes: ChangeSet
  hasChanges: boolean
}

// ───── Helpers ───────────────────────────────────────────────────────────────

function typeLabel(type: string): string {
  return (workerRegistry as any)[type]?.title || type
}

function isExcluded(w: SavedWorker): boolean {
  return (workerRegistry as any)[w.type]?.category === "debug"
}

function workerLabel(w: SavedWorker): string {
  return typeLabel(w.type)
}

function prettifyKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
}

function handleTypeLabel(type?: string): string {
  return (inputOutputTypes as any)[type] || type || "Unknown"
}

function workersById(config: SavedAgentConfig | null): Record<string, SavedWorker> {
  const map: Record<string, SavedWorker> = {}
  for (const w of config?.workers || []) {
    if (w.id && !isExcluded(w)) map[w.id] = w
  }
  return map
}

function handleIndex(config: SavedAgentConfig | null) {
  const idx: Record<string, { worker: SavedWorker; handle: NodeIO }> = {}
  for (const w of config?.workers || []) {
    for (const hid in w.handles || {}) {
      idx[hid] = { worker: w, handle: w.handles[hid] }
    }
  }
  return idx
}

function connectedHandleIds(config: SavedAgentConfig | null): Set<string> {
  const set = new Set<string>()
  for (const e of Object.values(config?.edges || {})) {
    if (e.sourceHandle) set.add(e.sourceHandle)
    if (e.targetHandle) set.add(e.targetHandle)
  }
  return set
}

function isEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function lineDiff(oldStr: string, newStr: string): string {
  const a = oldStr.split("\n")
  const b = newStr.split("\n")
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: string[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push("  " + a[i]); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push("- " + a[i]); i++ }
    else { out.push("+ " + b[j]); j++ }
  }
  while (i < m) { out.push("- " + a[i]); i++ }
  while (j < n) { out.push("+ " + b[j]); j++ }
  return out.join("\n")
}

function toText(v: any): string {
  if (v === null || v === undefined) return ""
  return typeof v === "string" ? v : JSON.stringify(v, null, 2)
}

/** Render a single before/after change: inline for short scalars, git-style diff block otherwise. */
function renderChange(c: ParamChange): string {
  const before = toText(c.before)
  const after = toText(c.after)
  const isLong = before.includes("\n") || after.includes("\n") || before.length > 80 || after.length > 80

  if (!isLong) {
    const b = c.before === undefined || c.before === "" ? "(empty)" : `"${before}"`
    const a = c.after === undefined || c.after === "" ? "(empty)" : `"${after}"`
    return `  - ${c.label}: ${b} → ${a}`
  }

  return `  - ${c.label}:\n\n\`\`\`diff\n${lineDiff(before, after)}\n\`\`\``
}

function summarize(changes: ChangeSet): string {
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`
  const params = changes.parametersChanged.reduce((n, w) => n + w.changes.length, 0)
  const conditions = changes.conditionsChanged.reduce((n, w) => n + w.changes.length, 0)
  const parts: string[] = []
  if (changes.workersAdded.length) parts.push(`${plural(changes.workersAdded.length, "worker")} added`)
  if (changes.workersRemoved.length) parts.push(`${plural(changes.workersRemoved.length, "worker")} removed`)
  if (changes.connectionsAdded.length) parts.push(`${plural(changes.connectionsAdded.length, "connection")} added`)
  if (changes.connectionsRemoved.length) parts.push(`${plural(changes.connectionsRemoved.length, "connection")} removed`)
  if (params) parts.push(`${plural(params, "parameter")} changed`)
  if (conditions) parts.push(`${plural(conditions, "condition")} changed`)
  if (changes.settingsChanged.length) parts.push(`${plural(changes.settingsChanged.length, "setting")} changed`)
  return parts.join(", ")
}

function formatDate(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const pad = (n: number) => `${n}`.padStart(2, "0")
  return `${pad(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}

// ───── Diff builders ─────────────────────────────────────────────────────────

function describeConnection(idx: ReturnType<typeof handleIndex>, e: EdgeConnections[string], showType = true): ConnectionChange | null {
  const src = idx[e.sourceHandle]
  const tgt = idx[e.targetHandle]
  if (!src || !tgt) return null
  if (isExcluded(src.worker) || isExcluded(tgt.worker)) return null

  const srcHandleName = src.handle.title || prettifyKey(src.handle.name || "")
  const tgtHandleName = tgt.handle.title || prettifyKey(tgt.handle.name || "")
  const typeSuffix = (t?: string) => (showType ? ` (${handleTypeLabel(t)})` : "")

  return {
    source: workerLabel(src.worker),
    target: workerLabel(tgt.worker),
    sourceHandle: `"${srcHandleName}"${typeSuffix(src.handle.type)}`,
    targetHandle: `"${tgtHandleName}"${typeSuffix(tgt.handle.type)}`,
  }
}

function diffParameters(base: SavedWorker, cur: SavedWorker, baseConnected: Set<string>, curConnected: Set<string>): ParamChange[] {
  const changes: ParamChange[] = []

  const baseParams = base.parameters || {}
  const curParams = cur.parameters || {}
  const paramKeys = new Set([...Object.keys(baseParams), ...Object.keys(curParams)])
  for (const key of Array.from(paramKeys).sort()) {
    if (isEqual(baseParams[key], curParams[key])) continue
    const isText = typeof baseParams[key] === "string" || typeof curParams[key] === "string"
    changes.push({ label: prettifyKey(key), before: baseParams[key], after: curParams[key], isText })
  }

  // Only connected handles — unconnected system defaults are noise.
  const curHandles = cur.handles || {}
  const baseHandles = base.handles || {}
  const handleIds = new Set([...Object.keys(baseHandles), ...Object.keys(curHandles)])
  for (const hid of handleIds) {
    if (!baseConnected.has(hid) && !curConnected.has(hid)) continue
    const bh = baseHandles[hid]
    const ch = curHandles[hid]
    const bd = bh?.default
    const cd = ch?.default
    if (isEqual(bd, cd)) continue
    const label = ch?.title || bh?.title || prettifyKey(ch?.name || bh?.name || "")
    const isText = typeof bd === "string" || typeof cd === "string"
    changes.push({ label, before: bd, after: cd, isText })
  }

  return changes
}

const OPERATOR_LABELS: Record<string, string> = {
  equals: "equals",
  notEquals: "does not equal",
  gt: "is greater than",
  lt: "is less than",
  gte: "is at least",
  lte: "is at most",
  between: "is between",
  contains: "contains",
  notContains: "does not contain",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
}

function describeCondition(h: NodeIO): string {
  const label = h.title || prettifyKey(h.name || "")
  const op = OPERATOR_LABELS[h.operator] || h.operator || "?"
  if (h.operator === "isEmpty" || h.operator === "isNotEmpty") return `"${label}" ${op}`
  if (h.operator === "between") return `"${label}" ${op} "${h.conditionValue1}" and "${h.conditionValue2}"`
  return `"${label}" ${op} "${h.conditionValue1}"`
}

function diffConditions(base: SavedWorker, cur: SavedWorker): string[] {
  const changes: string[] = []
  const baseHandles = base.handles || {}
  const curHandles = cur.handles || {}
  const handleIds = new Set([...Object.keys(baseHandles), ...Object.keys(curHandles)])

  for (const hid of handleIds) {
    const bh = baseHandles[hid]
    const ch = curHandles[hid]
    const wasCond = !!bh?.condition
    const isCond = !!ch?.condition
    if (!wasCond && !isCond) continue

    if (!wasCond && isCond) changes.push(`runs only when ${describeCondition(ch)}`)
    else if (wasCond && !isCond) changes.push(`condition removed (${describeCondition(bh)})`)
    else if (bh.operator !== ch.operator || !isEqual(bh.conditionValue1, ch.conditionValue1) || !isEqual(bh.conditionValue2, ch.conditionValue2)) {
      changes.push(`${describeCondition(bh)} → ${describeCondition(ch)}`)
    }
  }

  return changes
}

function diffSettings(base: SavedAgentConfig, cur: SavedAgentConfig, evalItemTitles: Record<string, string>): string[] {
  const lines: string[] = []

  if ((base.title || "") !== (cur.title || "")) lines.push(`- Name: "${base.title || ""}" → "${cur.title || ""}"`)

  if ((base.description || "") !== (cur.description || "")) {
    const before = base.description || ""
    const after = cur.description || ""
    if (before.includes("\n") || after.includes("\n") || before.length > 80 || after.length > 80) {
      lines.push(`- Description:\n\n\`\`\`diff\n${lineDiff(before, after)}\n\`\`\``)
    } else {
      lines.push(`- Description: "${before}" → "${after}"`)
    }
  }

  const baseItems = (base.config?.evalItems || []).map(String)
  const curItems = (cur.config?.evalItems || []).map(String)
  const added = curItems.filter((id) => !baseItems.includes(id))
  const removed = baseItems.filter((id) => !curItems.includes(id))
  const titleOf = (id: string) => `"${evalItemTitles[id] || `#${id}`}"`
  if (added.length || removed.length) {
    const parts: string[] = []
    if (added.length) parts.push(`added ${added.map(titleOf).join(", ")}`)
    if (removed.length) parts.push(`removed ${removed.map(titleOf).join(", ")}`)
    lines.push(`- Evaluation items: ${parts.join("; ")}`)
  }

  return lines
}

// ───── Public API ──────────────────────────────────────────────────────────

export function generateChangeDocument(
  baseline: SavedAgentConfig | null,
  current: SavedAgentConfig,
  options: ChangeDocOptions = {}
): ChangeDocResult {

  const isNew = !baseline || !(baseline.workers && baseline.workers.length)
  const base: SavedAgentConfig = baseline || {}

  const baseWorkers = workersById(base)
  const curWorkers = workersById(current)

  const changes: ChangeSet = {
    workersAdded: [],
    workersRemoved: [],
    connectionsAdded: [],
    connectionsRemoved: [],
    parametersChanged: [],
    conditionsChanged: [],
    settingsChanged: [],
  }

  // Workers
  for (const id of Object.keys(curWorkers).sort()) {
    if (!baseWorkers[id]) changes.workersAdded.push(workerLabel(curWorkers[id]))
  }
  for (const id of Object.keys(baseWorkers).sort()) {
    if (!curWorkers[id]) changes.workersRemoved.push(workerLabel(baseWorkers[id]))
  }

  // Connections
  const baseIdx = handleIndex(base)
  const curIdx = handleIndex(current)
  const baseEdges = base.edges || {}
  const curEdges = current.edges || {}
  for (const eid of Object.keys(curEdges).sort()) {
    if (!baseEdges[eid]) {
      const c = describeConnection(curIdx, curEdges[eid])
      if (c) changes.connectionsAdded.push(c)
    }
  }
  for (const eid of Object.keys(baseEdges).sort()) {
    if (!curEdges[eid]) {
      const c = describeConnection(baseIdx, baseEdges[eid], false)
      if (c) changes.connectionsRemoved.push(c)
    }
  }

  // Parameters (workers present in both)
  const baseConnected = connectedHandleIds(base)
  const curConnected = connectedHandleIds(current)
  for (const id of Object.keys(curWorkers).sort()) {
    if (!baseWorkers[id]) continue
    const paramChanges = diffParameters(baseWorkers[id], curWorkers[id], baseConnected, curConnected)
    if (paramChanges.length) {
      changes.parametersChanged.push({ workerLabel: workerLabel(curWorkers[id]), changes: paramChanges })
    }
    const conditionChanges = diffConditions(baseWorkers[id], curWorkers[id])
    if (conditionChanges.length) {
      changes.conditionsChanged.push({ workerLabel: workerLabel(curWorkers[id]), changes: conditionChanges })
    }
  }

  // Settings
  changes.settingsChanged = diffSettings(base, current, options.evalItemTitles || {})

  const hasChanges =
    changes.workersAdded.length > 0 ||
    changes.workersRemoved.length > 0 ||
    changes.connectionsAdded.length > 0 ||
    changes.connectionsRemoved.length > 0 ||
    changes.parametersChanged.length > 0 ||
    changes.conditionsChanged.length > 0 ||
    changes.settingsChanged.length > 0

  // ───── Render Markdown ─────
  const date = options.date || new Date()
  const author = options.author || "unknown user"
  const name = current.title || "Untitled"
  const action = isNew ? "Created" : "Updated"
  const summary = summarize(changes)
  const title = `Agent "${name}" ${isNew ? "created" : "updated"}${summary ? ` · ${summary}` : ""}`

  const connLine = (c: ConnectionChange) => `- ${c.source} → ${c.target}   ·   ${c.sourceHandle} → ${c.targetHandle}`
  const groupBlock = (label: string, subItems: string[]) => [`- ${label}`, ...subItems].join("\n")

  const out: string[] = []
  out.push(`# Agent "${name}" — ${action} · ${formatDate(date)} · by ${author}`)

  const section = (heading: string, blocks: string[]) => {
    if (!blocks.length) return
    out.push("", `## ${heading}`, "", blocks.join("\n\n"))
  }

  section("Workers added", changes.workersAdded.map((w) => `- ${w}`))
  section("Workers removed", changes.workersRemoved.map((w) => `- ${w}`))
  section("Connections added", changes.connectionsAdded.map(connLine))
  section("Connections removed", changes.connectionsRemoved.map(connLine))
  section("Parameters changed", changes.parametersChanged.map((wp) => groupBlock(wp.workerLabel, wp.changes.map(renderChange))))
  section("Conditions changed", changes.conditionsChanged.map((wc) => groupBlock(wc.workerLabel, wc.changes.map((c) => `  - ${c}`))))
  section("Settings changed", changes.settingsChanged)

  if (!hasChanges) out.push("", "_No relevant changes._")

  return { title, document: out.join("\n"), changes, hasChanges }
}
