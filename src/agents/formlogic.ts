// Magic Form field logic: conditional visibility and calculated formulas.

export const CONDITION_OPERATOR_LABELS: Record<FormCondingOperator, string> = {
  equals: "equals",
  notEquals: "does not equal",
  contains: "contains",
  notContains: "does not contain",
  gt: "greater than",
  lt: "less than",
  gte: "greater than or equal to",
  lte: "less than or equal to",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
}

export const CONDITION_OPERATORS = Object.keys(CONDITION_OPERATOR_LABELS) as FormCondingOperator[]

function isEmpty(v: any): boolean {
  if (v === null || v === undefined || v === "") return true
  if (Array.isArray(v)) return v.length === 0
  return false
}

function compare(actual: any, operator: FormCondingOperator, expected: any): boolean {
  switch (operator) {
    case "isEmpty": return isEmpty(actual)
    case "isNotEmpty": return !isEmpty(actual)
    case "equals": return String(actual) === String(expected)
    case "notEquals": return String(actual) !== String(expected)
    case "contains":
      if (Array.isArray(actual)) return actual.map(String).includes(String(expected))
      return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase())
    case "notContains":
      if (Array.isArray(actual)) return !actual.map(String).includes(String(expected))
      return !String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase())
    case "gt": return Number(actual) > Number(expected)
    case "lt": return Number(actual) < Number(expected)
    case "gte": return Number(actual) >= Number(expected)
    case "lte": return Number(actual) <= Number(expected)
    default: return false
  }
}

// Field is visible when all its conditions pass (AND).
export function isFieldVisible(field: FormFieldDef, values: Record<string, any>): boolean {
  const conds = field.visibleWhen
  if (!conds || conds.length === 0) return true
  return conds.every((c) => compare(values[c.field], c.operator, c.value))
}

// Safe expression language for calculated fields (no eval/Function).
export const FORMULA_FUNCTIONS = ["sum", "avg", "count", "min", "max"] as const
type FormulaFn = (typeof FORMULA_FUNCTIONS)[number]

type Token =
  | { t: "num" | "str" | "ref" | "ident" | "lp" | "rp" | "comma"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" }
  | { t: "cmp"; v: "==" | "!=" | ">" | "<" | ">=" | "<=" }
  | { t: "logic"; v: "&&" | "||" }
  | { t: "quest"; v: "?" }
  | { t: "colon"; v: ":" }

// Normalize Unicode math glyphs (× ÷ − ≥ ≤ ≠) to ASCII operators before tokenizing.
function normalizeOperators(src: string): string {
  return src
    .replace(/×/g, "*")
    .replace(/[÷∕]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/≠/g, "!=")
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  src = normalizeOperators(src)
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    const two = src.slice(i, i + 2)
    if (ch === " " || ch === "\t" || ch === "\n") { i++; continue }
    if (two === "&&" || two === "||") { tokens.push({ t: "logic", v: two }); i += 2; continue }
    if (two === "==" || two === "!=" || two === ">=" || two === "<=") { tokens.push({ t: "cmp", v: two }); i += 2; continue }
    if (ch === "(") { tokens.push({ t: "lp", v: ch }); i++; continue }
    if (ch === ")") { tokens.push({ t: "rp", v: ch }); i++; continue }
    if (ch === ",") { tokens.push({ t: "comma", v: ch }); i++; continue }
    if (ch === "?") { tokens.push({ t: "quest", v: ch }); i++; continue }
    if (ch === ":") { tokens.push({ t: "colon", v: ch }); i++; continue }
    if (ch === ">" || ch === "<") { tokens.push({ t: "cmp", v: ch as ">" | "<" }); i++; continue }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") { tokens.push({ t: "op", v: ch }); i++; continue }
    if (ch === "{") {
      const end = src.indexOf("}", i)
      if (end === -1) throw new Error("Unclosed { in formula")
      tokens.push({ t: "ref", v: src.slice(i + 1, end).trim() })
      i = end + 1
      continue
    }
    if (ch === '"' || ch === "'") {
      const end = src.indexOf(ch, i + 1)
      if (end === -1) throw new Error("Unclosed string in formula")
      tokens.push({ t: "str", v: src.slice(i + 1, end) })
      i = end + 1
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      tokens.push({ t: "num", v: src.slice(i, j) })
      i = j
      continue
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++
      tokens.push({ t: "ident", v: src.slice(i, j) })
      i = j
      continue
    }
    throw new Error(`Unexpected character "${ch}" in formula`)
  }
  return tokens
}

function toNum(raw: any): number | null {
  if (raw === null || raw === undefined || raw === "") return null
  const n = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(n) && String(raw).trim() !== "" ? n : null
}

function aggregate(fn: FormulaFn, group: any, subfield: string | null): number | null {
  const entries = Array.isArray(group) ? group : []
  if (fn === "count") return entries.length
  const nums = entries
    .map((e) => (subfield ? toNum(e?.[subfield]) : toNum(e)))
    .filter((n): n is number => n !== null)
  if (fn === "sum") return nums.reduce((a, b) => a + b, 0)
  if (!nums.length) return null
  if (fn === "avg") return nums.reduce((a, b) => a + b, 0) / nums.length
  if (fn === "min") return Math.min(...nums)
  if (fn === "max") return Math.max(...nums)
  return null
}

// Evaluate a calculated formula against record values; null when empty or malformed.
export function evalFormula(
  formula: string,
  values: Record<string, any>,
): number | string | boolean | null {
  if (!formula || !formula.trim()) return null
  let tokens: Token[]
  try {
    tokens = tokenize(formula)
  } catch {
    return null
  }
  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]

  type Val = { num: number | null; str: string; bool?: boolean }
  const asVal = (raw: any): Val => {
    if (raw === null || raw === undefined || raw === "") return { num: null, str: "" }
    const n = toNum(raw)
    return n !== null ? { num: n, str: String(raw) } : { num: null, str: String(raw) }
  }
  const numVal = (n: number | null): Val => ({ num: n, str: n === null ? "" : String(n) })
  const boolVal = (b: boolean): Val => ({ num: b ? 1 : 0, str: b ? "true" : "false", bool: b })
  const truthy = (v: Val): boolean => (v.bool !== undefined ? v.bool : v.num !== null ? v.num !== 0 : v.str !== "")

  function parseCall(name: string): Val {
    const fn = name as FormulaFn
    next()
    const args: string[] = []
    while (peek() && peek().t !== "rp") {
      const tk = next()
      if (tk.t === "ident" || tk.t === "ref") args.push(tk.v)
      else if (tk.t === "comma") continue
      else throw new Error(`Bad argument in ${name}()`)
    }
    const close = next()
    if (!close || close.t !== "rp") throw new Error(`Missing ) in ${name}()`)
    const group = values[args[0]]
    const subfield = args[1] ?? null
    return numVal(aggregate(fn, group, subfield))
  }

  function parseFactor(): Val {
    const tk = next()
    if (!tk) throw new Error("Unexpected end of formula")
    if (tk.t === "op" && tk.v === "-") {
      const v = parseFactor()
      return numVal(v.num !== null ? -v.num : null)
    }
    if (tk.t === "num") return { num: Number(tk.v), str: tk.v }
    if (tk.t === "str") return { num: null, str: tk.v }
    if (tk.t === "ref") return asVal(values[tk.v])
    if (tk.t === "ident") {
      if ((FORMULA_FUNCTIONS as readonly string[]).includes(tk.v) && peek()?.t === "lp") {
        return parseCall(tk.v)
      }
      return asVal(values[tk.v])
    }
    if (tk.t === "lp") {
      const v = parseTernary()
      const close = next()
      if (!close || close.t !== "rp") throw new Error("Missing )")
      return v
    }
    throw new Error(`Unexpected token ${tk.v}`)
  }

  function parseTerm(): Val {
    let left = parseFactor()
    while (peek() && peek().t === "op" && (peek().v === "*" || peek().v === "/")) {
      const op = next().v
      const right = parseFactor()
      const a = left.num ?? 0, b = right.num ?? 0
      const num = op === "*" ? a * b : b === 0 ? 0 : a / b
      left = numVal(num)
    }
    return left
  }

  function parseExpr(): Val {
    let left = parseTerm()
    while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) {
      const op = next().v
      const right = parseTerm()
      if (op === "-") {
        left = numVal((left.num ?? 0) - (right.num ?? 0))
      } else {
        if (left.num !== null && right.num !== null) left = numVal(left.num + right.num)
        else left = { num: null, str: left.str + right.str }
      }
    }
    return left
  }

  function parseCmp(): Val {
    const left = parseExpr()
    const p = peek()
    if (p && p.t === "cmp") {
      const op = next().v
      const right = parseExpr()
      if (left.num !== null && right.num !== null) {
        const a = left.num, b = right.num
        switch (op) {
          case "==": return boolVal(a === b)
          case "!=": return boolVal(a !== b)
          case ">": return boolVal(a > b)
          case "<": return boolVal(a < b)
          case ">=": return boolVal(a >= b)
          case "<=": return boolVal(a <= b)
        }
      }
      if (op === "==") return boolVal(left.str === right.str)
      if (op === "!=") return boolVal(left.str !== right.str)
      const a = left.str, b = right.str
      switch (op) {
        case ">": return boolVal(a > b)
        case "<": return boolVal(a < b)
        case ">=": return boolVal(a >= b)
        case "<=": return boolVal(a <= b)
      }
    }
    return left
  }

  function parseAnd(): Val {
    let left = parseCmp()
    while (peek() && peek().t === "logic" && (peek() as any).v === "&&") {
      next()
      const right = parseCmp()
      left = boolVal(truthy(left) && truthy(right))
    }
    return left
  }

  function parseOr(): Val {
    let left = parseAnd()
    while (peek() && peek().t === "logic" && (peek() as any).v === "||") {
      next()
      const right = parseAnd()
      left = boolVal(truthy(left) || truthy(right))
    }
    return left
  }

  function parseTernary(): Val {
    const cond = parseOr()
    if (peek() && peek().t === "quest") {
      next()
      const then = parseTernary()
      const colon = next()
      if (!colon || colon.t !== "colon") throw new Error("Missing : in ternary")
      const otherwise = parseTernary()
      return truthy(cond) ? then : otherwise
    }
    return cond
  }

  try {
    const result = parseTernary()
    if (peek()) return null
    if (result.bool !== undefined) return result.bool
    return result.num !== null ? result.num : result.str === "" ? null : result.str
  } catch {
    return null
  }
}

// Authoring-time validation for a calculated formula; null when valid, else an error message.
export function validateFormula(formula: string): string | null {
  if (!formula || !formula.trim()) return null

  if (/=>/.test(formula)) return "Formulas can't use arrow functions (=>). To total a repeating group use sum(group_name, subfield_name)."
  const jsMethod = formula.match(/\.\s*(map|reduce|filter|forEach|slice|includes|toLowerCase|toUpperCase|length)\b/)
  if (jsMethod) return `Formulas can't use JavaScript methods like ".${jsMethod[1]}". Use the aggregate functions instead: sum/avg/count/min/max(group_name, subfield_name).`
  if (/\[[^\]]*\]/.test(formula)) return "Formulas can't use array/index syntax []."

  const callRe = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g
  let m: RegExpExecArray | null
  while ((m = callRe.exec(formula))) {
    if (!(FORMULA_FUNCTIONS as readonly string[]).includes(m[1])) {
      return `Unknown function "${m[1]}(". Supported functions: ${FORMULA_FUNCTIONS.join(", ")}. Reference plain fields as {field_name}.`
    }
  }

  // Light structural check: balanced parens and braces.
  try {
    let depth = 0
    for (const ch of formula) {
      if (ch === "(") depth++
      else if (ch === ")") { depth--; if (depth < 0) return "Unbalanced parentheses in formula." }
    }
    if (depth !== 0) return "Unbalanced parentheses in formula."
    const opens = (formula.match(/\{/g) || []).length
    const closes = (formula.match(/\}/g) || []).length
    if (opens !== closes) return "Unbalanced { } around a field reference."
  } catch {
    return "Formula could not be parsed."
  }
  return null
}

// Keyword-detection fill: returns the value to store if the transcript matches, else null.
export function keywordMatch(field: FormFieldDef, text: string): any {
  const ex = field.extraction
  if (!ex || ex.method !== "keyword" || !ex.keywords?.length) return null
  const hay = text.toLowerCase()
  const kws = ex.keywords.map((k) => k.toLowerCase()).filter(Boolean)
  const mode = ex.keywordMatch || "any"

  let matched: string | null = null
  if (mode === "all") {
    matched = kws.every((k) => hay.includes(k)) ? kws.join(", ") : null
  } else {
    matched = kws.find((k) => hay.includes(k)) ?? null
  }
  if (matched === null) return null

  if (field.type === "boolean") return true
  const value = ex.keywordValue?.trim() || true
  if (field.type === "multiselect") return [value]
  return value
}
