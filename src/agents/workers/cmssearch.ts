import { z } from "zod"
import { supabase } from "../db"

/**
 * HOW SEARCH SCORES A MATCH
 *
 * A query like "housing deposit rules" is split into words (queryTerms),
 * dropping filler words that don't help match anything ("the", "with", "how"
 * — the STOPWORDS list) so what's left is "housing", "deposit", "rules".
 *
 * Each candidate record is flattened to plain searchable text (searchableText
 * pulls every string out of it, ignoring field names) and lowercased into one
 * blob called "hay" — as in haystack, the text a term gets searched for in.
 * scoreRecord then checks each query term against that hay: found in the
 * title is worth more than found in the body, and matching a whole word
 * ("aid" alone) beats matching inside another word ("aid" inside "said").
 * Terms found are summed and scaled by how many of the query's words showed
 * up at all, so a record matching every word ranks above one matching only
 * one word repeatedly.
 */

/**
 * THE TOOL SURFACE, IN / OUT
 *
 * One tool, one shape of call: { action, path, query, depth } in, a plain
 * text string out. Every action shares those same four fields; each just
 * ignores the ones it doesn't need.
 *
 *   list(path)            -> a directory listing. "" lists the 3 top areas
 *                            (articles/services/site); a path like
 *                            "articles/category:01H..." lists that node's
 *                            children. Each line is tagged [dir] (has
 *                            children, list it next) or [doc] (has content,
 *                            read it next), with a "path:" you copy for the
 *                            next call. query/depth are ignored.
 *
 *   tree(path, depth)     -> the same listing, expanded several levels deep
 *                            in one call instead of one list() per level.
 *                            depth (1-5, default 2) caps how far it goes.
 *                            query is ignored.
 *
 *   read(path)            -> the full content of one [doc] node — an
 *                            article's body, a service's details, a site
 *                            page block. query/depth are ignored.
 *
 *   search(query, path)   -> ranked keyword matches (see the scoring above).
 *                            path is optional here and narrows the search to
 *                            one subtree instead of the whole CMS; depth is
 *                            ignored.
 *
 * path is always a string built from earlier output, never composed by hand:
 * "" is the root, and each segment after that is "kind:id" (e.g.
 * "category:01HXYZ"), copied straight from a "path:" line in a prior result.
 */

/** The three content areas, each the root of its own tree. */
const AREAS = ["articles", "services", "site"] as const
type Area = (typeof AREAS)[number]

const AREA_LABEL: Record<Area, string> = {
  articles: "Articles",
  services: "Service Map",
  site: "Site Config",
}

const FETCH_CEILING = 500

/** Depth cap for `tree`, so a deep KB cannot return the entire corpus. */
const MAX_TREE_DEPTH = 5

declare global {
  interface CMSSearchWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
      textOutput: NodeIO
      references: NodeIO
      tool: NodeIO
      maxResults: NodeIO
      locale: NodeIO
      condition: NodeIO
    }
    parameters: {
      searchArticles?: boolean
      searchServices?: boolean
      searchSites?: boolean
      maxResults?: number
      /** Preferred locale for translated fields; falls back to any available. */
      locale?: string
      toolDescription?: string
      explainSteps?: boolean
    }
  }
}

// ── Paths ────────────────────────────────────────────────────────────────────

interface CmsPath {
  area?: Area
  segments: { kind: string; id: string }[]
}

function parsePath(raw: string | null | undefined): CmsPath | { error: string } {
  const clean = String(raw ?? "").trim().replace(/^\/+|\/+$/g, "")
  if (!clean) return { segments: [] }

  const parts = clean.split("/").filter(Boolean)
  const area = parts[0] as Area
  if (!AREAS.includes(area)) {
    return { error: `"${parts[0]}" is not a CMS area. Use one of: ${AREAS.join(", ")}.` }
  }

  const segments: { kind: string; id: string }[] = []
  for (const part of parts.slice(1)) {
    const idx = part.indexOf(":")
    if (idx < 1) {
      return {
        error: `Path segment "${part}" is malformed. Each segment after the area is `
          + `"kind:id", e.g. "category:01HXYZ" — copy the path from a list result rather `
          + `than composing one by hand.`,
      }
    }
    segments.push({ kind: part.slice(0, idx), id: part.slice(idx + 1) })
  }
  return { area, segments }
}

const pathOf = (area: Area, ...segments: { kind: string; id: string }[]) =>
  [area, ...segments.map(s => `${s.kind}:${s.id}`)].join("/")

// ── Entries ──────────────────────────────────────────────────────────────────

interface Entry {
  path: string
  kind: string
  title: string
  childCount?: number
  /** True when this holds readable body content. */
  readable?: boolean
  /** One-line context: status, locale coverage, address. */
  detail?: string
}

/** What one sub-query did, for the trace shown in the builder and to the model. */
export interface StepTrace {
  label: string
  table: string
  rows: number
  truncated?: boolean
  error?: string
}

const cms = {
  from(table: string) {
    return (supabase as any).from(table)
  },
}

// ── Translations ─────────────────────────────────────────────────────────────

function pickTranslation(
  translations: Record<string, any> | null | undefined,
  preferred?: string,
  sourceLocale?: string,
  defaultLocale?: string,
): { value: any; locale?: string } {
  if (!translations || typeof translations !== "object") return { value: null }
  if (preferred && translations[preferred]) {
    return { value: translations[preferred], locale: preferred }
  }
  if (sourceLocale && translations[sourceLocale]) {
    return { value: translations[sourceLocale], locale: sourceLocale }
  }
  if (defaultLocale && translations[defaultLocale]) {
    return { value: translations[defaultLocale], locale: defaultLocale }
  }
  const keys = Object.keys(translations)
  if (!keys.length) return { value: null }
  return { value: translations[keys[0]], locale: keys[0] }
}

function titleOf(ctx: Ctx, row: any, fallback?: string): string {
  const value = tr(ctx, row).value
  return value?.title || value?.name || fallback || "(untitled)"
}

function toPlainText(html: unknown): string {
  if (typeof html !== "string") return ""
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// ── Scoring ──────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "of", "at", "by", "for", "with",
  "about", "to", "from", "in", "on", "is", "are", "was", "were", "be", "been",
  "do", "does", "did", "can", "could", "would", "should", "will", "i", "you",
  "my", "me", "we", "us", "it", "its", "this", "that", "there", "where", "what",
  "when", "who", "how", "why", "any", "some", "get", "need", "want", "please",
])

function queryTerms(query: string): string[] {
  const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const meaningful = words.filter(w => w.length > 1 && !STOPWORDS.has(w))
  // A query of nothing but stopwords ("who are you") still has to search
  return meaningful.length ? meaningful : words
}

/** True when `term` appears in `hay` as a whole word. */
function wholeWordHit(hay: string, term: string): boolean {
  let from = 0
  for (;;) {
    const i = hay.indexOf(term, from)
    if (i < 0) return false
    const before = i === 0 ? "" : hay[i - 1]
    const after = hay[i + term.length] ?? ""
    const isWord = (c: string) => c !== "" && /[\p{L}\p{N}_]/u.test(c)
    if (!isWord(before) && !isWord(after)) return true
    from = i + 1
  }
}

function searchableText(value: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 6 || value == null) return out
  if (typeof value === "string") out.push(value)
  else if (typeof value === "number" || typeof value === "boolean") out.push(String(value))
  else if (Array.isArray(value)) for (const v of value) searchableText(v, out, depth + 1)
  else if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      searchableText(v, out, depth + 1)
    }
  }
  return out
}

function scoreRecord(record: unknown, terms: string[], title?: string): number {
  const hay = searchableText(record).join(" \n ").toLowerCase()
  if (!hay) return 0
  const titleHay = (title ?? "").toLowerCase()

  let score = 0
  let matched = 0
  for (const term of terms) {
    const inTitle = titleHay.includes(term)
    const inBody = hay.includes(term)
    if (!inTitle && !inBody) continue
    matched++
    if (inTitle) score += 10
    if (inBody) score += 1
    if (wholeWordHit(hay, term)) score += 2
  }
  if (!matched) return 0
  return score * (matched / terms.length)
}

// ── Area access ──────────────────────────────────────────────────────────────

function enabledAreas(params: CMSSearchWorker["parameters"]): Area[] {
  const on: Area[] = []
  if (params.searchArticles !== false) on.push("articles")
  if (params.searchServices !== false) on.push("services")
  if (params.searchSites !== false) on.push("site")
  return on
}

interface Ctx {
  team: string
  locale?: string
  defaultLocale?: string
  limit: number
  trace: StepTrace[]
}

const tr = (ctx: Ctx, row: any) =>
  pickTranslation(row?.translations, ctx.locale, row?.source_locale, ctx.defaultLocale)

async function loadDefaultLocale(ctx: Ctx): Promise<string | undefined> {
  const sites = await step<any>(ctx, "Default locale", "scms_site", () =>
    cms.from("scms_site").select("default_locale").eq("team_id", ctx.team).limit(1))
  if (sites[0]?.default_locale) return sites[0].default_locale
  const kbs = await step<any>(ctx, "KB default locale", "scms_kb", () =>
    cms.from("scms_kb").select("default_locale").eq("team_id", ctx.team).limit(1))
  return kbs[0]?.default_locale ?? undefined
}

/** Runs one query, recording it in the trace whether or not it succeeds. */
async function step<T>(
  ctx: Ctx, label: string, table: string, run: () => Promise<{ data: T[] | null; error: any }>,
  limit: number = FETCH_CEILING,
): Promise<T[]> {
  const entry: StepTrace = { label, table, rows: 0 }
  ctx.trace.push(entry)
  try {
    const { data, error } = await run()
    if (error) throw error
    entry.rows = data?.length ?? 0
    if (entry.rows >= limit) entry.truncated = true
    return data ?? []
  } catch (err) {
    entry.error = errText(err)
    return []
  }
}

function errText(err: unknown): string {
  if (!err) return "unknown error"
  if (err instanceof Error) return err.message
  if (typeof err === "object") {
    const e = err as Record<string, unknown>
    const parts = [e.message, e.details, e.hint].filter(Boolean).map(String)
    if (parts.length) return parts.join(" — ")
    const code = e.code ? `code ${e.code}` : ""
    return code || JSON.stringify(err)
  }
  return String(err)
}

// ── Listing: articles ────────────────────────────────────────────────────────

async function listArticleArea(ctx: Ctx, segments: CmsPath["segments"]): Promise<Entry[]> {
  const last = segments[segments.length - 1]

  // articles/ -> the categories
  if (!last) {
    const [cats, secs] = await Promise.all([
      step(ctx, "Article categories", "scms_kb_category", () =>
        cms.from("scms_kb_category").select("id, translations, position, source_locale").eq("team_id", ctx.team)),
      step<any>(ctx, "Article sections", "scms_kb_section", () =>
        cms.from("scms_kb_section").select("id, category_id").eq("team_id", ctx.team)),
    ])
    const perCategory = new Map<string, number>()
    for (const s of secs) {
      perCategory.set(s.category_id, (perCategory.get(s.category_id) ?? 0) + 1)
    }
    return sortByPosition(cats).map((c: any) => ({
      path: pathOf("articles", { kind: "category", id: c.id }),
      kind: "category",
      title: titleOf(ctx, c),
      childCount: perCategory.get(c.id) ?? 0,
    }))
  }

  // articles/category:X -> its top-level sections
  if (last.kind === "category") {
    const secs = await step<any>(ctx, "Sections in category", "scms_kb_section", () =>
      cms.from("scms_kb_section")
        .select("id, translations, position, parent_section_id, source_locale")
        .eq("team_id", ctx.team).eq("category_id", last.id))
    // parent_section_id null means "top level of the category".
    const top = secs.filter(s => !s.parent_section_id)
    return withSectionCounts(ctx, top)
  }

  // articles/.../section:X -> nested sections, then articles
  if (last.kind === "section") {
    const [subs, arts] = await Promise.all([
      step<any>(ctx, "Sub-sections", "scms_kb_section", () =>
        cms.from("scms_kb_section")
          .select("id, translations, position, parent_section_id, source_locale")
          .eq("team_id", ctx.team).eq("parent_section_id", last.id)),
      step<any>(ctx, "Articles in section", "scms_kb_article", () =>
        cms.from("scms_kb_article")
          .select("id, translations, position, state, source_locale")
          .eq("team_id", ctx.team).eq("section_id", last.id).limit(FETCH_CEILING)),
    ])
    const subEntries = await withSectionCounts(ctx, subs)
    const artEntries: Entry[] = sortByPosition(arts).map((a: any) => ({
      path: pathOf("articles", { kind: "article", id: a.id }),
      kind: "article",
      title: titleOf(ctx, a),
      readable: true,
      detail: articleDetail(a),
    }))
    return [...subEntries, ...artEntries]
  }

  if (last.kind === "article") {
    return [] // A leaf: use action "read".
  }
  return []
}

async function withSectionCounts(ctx: Ctx, sections: any[]): Promise<Entry[]> {
  if (!sections.length) return []
  const ids = sections.map(s => s.id)
  const [arts, subs] = await Promise.all([
    step<any>(ctx, "Article counts", "scms_kb_article", () =>
      cms.from("scms_kb_article").select("id, section_id")
        .eq("team_id", ctx.team).in("section_id", ids).limit(FETCH_CEILING)),
    step<any>(ctx, "Sub-section counts", "scms_kb_section", () =>
      cms.from("scms_kb_section").select("id, parent_section_id")
        .eq("team_id", ctx.team).in("parent_section_id", ids)),
  ])
  const count = new Map<string, number>()
  for (const a of arts) count.set(a.section_id, (count.get(a.section_id) ?? 0) + 1)
  for (const s of subs) count.set(s.parent_section_id, (count.get(s.parent_section_id) ?? 0) + 1)

  return sortByPosition(sections).map((s: any) => ({
    path: pathOf("articles", { kind: "section", id: s.id }),
    kind: "section",
    title: titleOf(ctx, s),
    childCount: count.get(s.id) ?? 0,
  }))
}

/** Locale coverage and publish state — what a content editor needs to see. */
function articleDetail(a: any): string {
  const locales = Object.keys(a.translations ?? {})
  const published = locales.filter(l => (a.translations[l]?.state ?? a.state) === "published")
  const bits = [`${locales.length} locale${locales.length === 1 ? "" : "s"}`]
  if (published.length) bits.push(`published: ${published.join(", ")}`)
  else bits.push("draft")
  return bits.join(" · ")
}

const sortByPosition = <T extends { position?: number }>(rows: T[]) =>
  [...rows].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

// ── Listing: services ────────────────────────────────────────────────────────

const SERVICE_COLS = "id, name, description, translations, status, address, "
  + "country_id, region_id, city_id, provider_id, category_ids"

async function listServiceArea(ctx: Ctx, segments: CmsPath["segments"]): Promise<Entry[]> {
  const last = segments[segments.length - 1]

  if (!last) {
    const [countries, cats, providers] = await Promise.all([
      step<any>(ctx, "Countries", "scms_svc_country", () =>
        cms.from("scms_svc_country").select("id, name, translations").eq("team_id", ctx.team)),
      step<any>(ctx, "Service categories", "scms_svc_service_category", () =>
        cms.from("scms_svc_service_category").select("id, name, translations, status").eq("team_id", ctx.team)),
      step<any>(ctx, "Providers", "scms_svc_provider", () =>
        cms.from("scms_svc_provider").select("id, name, translations, status").eq("team_id", ctx.team)),
    ])
    return [
      ...countries.map((c: any) => ({
        path: pathOf("services", { kind: "country", id: c.id }),
        kind: "country",
        title: titleOf(ctx, c, c.name),
        detail: "by geography",
      })),
      ...cats.map((c: any) => ({
        path: pathOf("services", { kind: "category", id: c.id }),
        kind: "category",
        title: titleOf(ctx, c, c.name),
        detail: c.status && c.status !== "published" ? `by category · ${c.status}` : "by category",
      })),
      // Providers are the organisations delivering services -- a first-class
      // reachable at all.
      ...providers.map((p: any) => ({
        path: pathOf("services", { kind: "provider", id: p.id }),
        kind: "provider",
        title: titleOf(ctx, p, p.name),
        detail: p.status && p.status !== "Active" ? `by provider · ${p.status}` : "by provider",
      })),
    ]
  }

  if (last.kind === "country") {
    const [regions, direct] = await Promise.all([
      step<any>(ctx, "Regions", "scms_svc_region", () =>
        cms.from("scms_svc_region").select("id, name, translations")
          .eq("team_id", ctx.team).eq("country_id", last.id)),
      step<any>(ctx, "Services in country", "scms_svc_service", () =>
        cms.from("scms_svc_service").select(SERVICE_COLS)
          .eq("team_id", ctx.team).eq("country_id", last.id).limit(FETCH_CEILING)),
    ])
    // Services with no region would otherwise be unreachable by browsing.
    const orphans = direct.filter(s => !s.region_id)
    return [
      ...regions.map((r: any) => ({
        path: pathOf("services", { kind: "region", id: r.id }),
        kind: "region",
        title: titleOf(ctx, r, r.name),
      })),
      ...orphans.map(serviceEntry(ctx)),
    ]
  }

  if (last.kind === "region") {
    const [cities, direct] = await Promise.all([
      step<any>(ctx, "Cities", "scms_svc_city", () =>
        cms.from("scms_svc_city").select("id, name, translations")
          .eq("team_id", ctx.team).eq("region_id", last.id)),
      step<any>(ctx, "Services in region", "scms_svc_service", () =>
        cms.from("scms_svc_service").select(SERVICE_COLS)
          .eq("team_id", ctx.team).eq("region_id", last.id).limit(FETCH_CEILING)),
    ])
    const orphans = direct.filter(s => !s.city_id)
    return [
      ...cities.map((c: any) => ({
        path: pathOf("services", { kind: "city", id: c.id }),
        kind: "city",
        title: titleOf(ctx, c, c.name),
      })),
      ...orphans.map(serviceEntry(ctx)),
    ]
  }

  if (last.kind === "city") {
    const svcs = await step<any>(ctx, "Services in city", "scms_svc_service", () =>
      cms.from("scms_svc_service").select(SERVICE_COLS)
        .eq("team_id", ctx.team).eq("city_id", last.id).limit(FETCH_CEILING))
    return svcs.map(serviceEntry(ctx))
  }

  if (last.kind === "provider") {
    const svcs = await step<any>(ctx, "Services from provider", "scms_svc_service", () =>
      cms.from("scms_svc_service").select(SERVICE_COLS)
        .eq("team_id", ctx.team).eq("provider_id", last.id).limit(FETCH_CEILING))
    return svcs.map(serviceEntry(ctx))
  }

  if (last.kind === "category") {
    const svcs = await step<any>(ctx, "Services in category", "scms_svc_service", () =>
      cms.from("scms_svc_service").select(SERVICE_COLS)
        .eq("team_id", ctx.team).limit(FETCH_CEILING))
    return svcs.filter(s => asIdList(s.category_ids).includes(last.id)).map(serviceEntry(ctx))
  }

  return []
}

async function resolveGeography(ctx: Ctx, s: any): Promise<string[]> {
  const lookups: Array<Promise<string | null>> = [
    lookupName(ctx, "scms_svc_country", s.country_id),
    lookupName(ctx, "scms_svc_region", s.region_id),
    lookupName(ctx, "scms_svc_city", s.city_id),
  ]
  return (await Promise.all(lookups)).filter((n): n is string => !!n)
}

async function lookupName(ctx: Ctx, table: string, id: string | null): Promise<string | null> {
  if (!id) return null
  const rows = await step<any>(ctx, `Resolve ${table.replace("scms_svc_", "")}`, table, () =>
    cms.from(table).select("id, name, translations").eq("team_id", ctx.team).eq("id", id))
  const row = rows[0]
  if (!row) return null
  return tr(ctx, row).value?.name || row.name || null
}

/** An id-array column, tolerating either a Postgres array or a jsonb array. */
function asIdList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === "string") {
    // A Postgres text[] can arrive as the literal "{a,b}" over PostgREST.
    const trimmed = v.trim()
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed.slice(1, -1).split(",").map(s => s.replace(/^"|"$/g, "").trim()).filter(Boolean)
    }
    try {
      const parsed = JSON.parse(trimmed)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return []
}

const serviceEntry = (ctx: Ctx) => (s: any): Entry => {
  const t = tr(ctx, s).value
  return {
    path: pathOf("services", { kind: "service", id: s.id }),
    kind: "service",
    title: titleOf(ctx, s, s.name),
    readable: true,
    // Status is PER LOCALE (types.ts serviceStatusFor): a service can be
    // published in English and draft in Arabic, so the record-level status
    // alone misreports what a given locale actually sees.
    detail: [t?.status ?? s.status, t?.address ?? s.address].filter(Boolean).join(" · ") || undefined,
  }
}

// ── Listing: site ────────────────────────────────────────────────────────────

async function listSiteArea(ctx: Ctx, segments: CmsPath["segments"]): Promise<Entry[]> {
  const last = segments[segments.length - 1]

  if (!last) {
    const sites = await step<any>(ctx, "Sites", "scms_site", () =>
      cms.from("scms_site").select("id, name, base_url, locales, content_ids").eq("team_id", ctx.team))
    return sites.map((s: any) => ({
      path: pathOf("site", { kind: "site", id: s.id }),
      kind: "site",
      title: s.name || "(unnamed site)",
      childCount: asIdList(s.content_ids).length,
      detail: [s.base_url, asIdList(s.locales).join(", ")].filter(Boolean).join(" · ") || undefined,
    }))
  }

  if (last.kind === "site") {
    const sites = await step<any>(ctx, "Site content ids", "scms_site", () =>
      cms.from("scms_site").select("content_ids").eq("team_id", ctx.team).eq("id", last.id))
    const ids = asIdList(sites[0]?.content_ids)
    if (!ids.length) return []
    const blocks = await step<any>(ctx, "Page content", "scms_site_page_content", () =>
      cms.from("scms_site_page_content").select("id, type, title, translations")
        .eq("team_id", ctx.team).in("id", ids).limit(FETCH_CEILING))
    // content_ids is render order, and the database does not preserve it.
    const byId = new Map(blocks.map((b: any) => [b.id, b]))
    return ids.filter(id => byId.has(id)).map(id => {
      const b: any = byId.get(id)
      return {
        path: pathOf("site", { kind: "block", id: b.id }),
        kind: "block",
        title: titleOf(ctx, b, b.title) || b.type,
        readable: true,
        detail: b.type,
      }
    })
  }

  return []
}

// ── Reading ──────────────────────────────────────────────────────────────────

async function readNode(ctx: Ctx, area: Area, seg: { kind: string; id: string }): Promise<string> {
  if (area === "articles" && seg.kind === "article") {
    const rows = await step<any>(ctx, "Read article", "scms_kb_article", () =>
      cms.from("scms_kb_article").select("id, translations, section_id, state, labels, attachments, source_locale")
        .eq("team_id", ctx.team).eq("id", seg.id))
    const a = rows[0]
    if (!a) return `No article with id ${seg.id}.`
    const { value, locale } = tr(ctx, a)
    if (!value) return `Article ${seg.id} has no translations.`
    const parts = [
      `# ${value.title || "(untitled)"}`,
      `_${[`locale: ${locale}`, `state: ${value.state ?? a.state}`,
        a.labels?.length ? `labels: ${a.labels.join(", ")}` : null,
      ].filter(Boolean).join(" · ")}_`,
      "",
      toPlainText(value.body) || value.description || "(no body)",
    ]
    if (a.attachments?.length) {
      parts.push("", "Attachments:", ...a.attachments.map((f: any) => `- ${f.fileName}: ${f.url}`))
    }
    const others = Object.keys(a.translations ?? {}).filter(l => l !== locale)
    if (others.length) parts.push("", `Also available in: ${others.join(", ")}`)
    return parts.join("\n")
  }

  if (area === "services" && seg.kind === "service") {
    // Column names are snake_case; see SERVICE_COLS.
    const rows = await step<any>(ctx, "Read service", "scms_svc_service", () =>
      cms.from("scms_svc_service")
        .select("id, name, description, translations, status, address, contact_info, hours, "
          + "always_open, provider_id, country_id, region_id, city_id, category_ids")
        .eq("team_id", ctx.team).eq("id", seg.id))
    const s = rows[0]
    if (!s) return `No service with id ${seg.id}.`

    const catIds = asIdList(s.category_ids)
    const [providers, geo, cats] = await Promise.all([
      s.provider_id
        ? step<any>(ctx, "Service provider", "scms_svc_provider", () =>
          cms.from("scms_svc_provider").select("id, name, translations")
            .eq("team_id", ctx.team).eq("id", s.provider_id))
        : Promise.resolve([]),
      resolveGeography(ctx, s),
      catIds.length
        ? step<any>(ctx, "Service categories", "scms_svc_service_category", () =>
          cms.from("scms_svc_service_category").select("id, name, translations")
            .eq("team_id", ctx.team).in("id", catIds))
        : Promise.resolve([]),
    ])

    const { value, locale } = tr(ctx, s)
    // Per-locale status, falling back to the record's own.
    const status = value?.status ?? s.status
    const parts = [
      `# ${value?.name || s.name || "(unnamed service)"}`,
      `_${[`status: ${status}`, locale && `locale: ${locale}`].filter(Boolean).join(" · ")}_`,
      "",
      toPlainText(value?.description ?? s.description) || "(no description)",
    ]

    const provider = providers[0]
    if (provider) {
      const pName = tr(ctx, provider).value?.name || provider.name
      parts.push("", `Provider: ${pName}  (${pathOf("services", { kind: "provider", id: provider.id })})`)
    }
    if (geo.length) parts.push(`Location: ${geo.join(" / ")}`)
    if (cats.length) {
      parts.push(`Categories: ${cats.map((c: any) =>
        tr(ctx, c).value?.name || c.name).join(", ")}`)
    }

    const address = value?.address ?? s.address
    if (address) parts.push(`Address: ${address}`)
    if (s.always_open) parts.push("Hours: always open")
    else if (s.hours?.length) {
      parts.push("", "Hours:", ...s.hours.map((h: any) => `- ${h.day}: ${h.open}–${h.close}`))
    }
    if (s.contact_info?.length) {
      parts.push("", "Contact:",
        ...s.contact_info.map((c: any) => `- ${c.channel}: ${c.contactDetails}`))
    }

    const others = Object.keys(s.translations ?? {}).filter(l => l !== locale)
    if (others.length) parts.push("", `Also available in: ${others.join(", ")}`)
    return parts.join("\n")
  }

  if (area === "services" && seg.kind === "provider") {
    const rows = await step<any>(ctx, "Read provider", "scms_svc_provider", () =>
      cms.from("scms_svc_provider")
        .select("id, name, description, translations, status, address, country_id")
        .eq("team_id", ctx.team).eq("id", seg.id))
    const p = rows[0]
    if (!p) return `No provider with id ${seg.id}.`
    const { value, locale } = tr(ctx, p)
    const parts = [
      `# ${value?.name || p.name || "(unnamed provider)"}`,
      `_${[`status: ${p.status}`, locale && `locale: ${locale}`].filter(Boolean).join(" · ")}_`,
      "",
      toPlainText(value?.description ?? p.description) || "(no description)",
    ]
    const address = value?.address ?? p.address
    if (address) parts.push("", `Address: ${address}`)
    parts.push("", `List ${pathOf("services", { kind: "provider", id: p.id })} to see this provider's services.`)
    return parts.join("\n")
  }

  if (area === "site" && seg.kind === "block") {
    const rows = await step<any>(ctx, "Read page block", "scms_site_page_content", () =>
      cms.from("scms_site_page_content").select("id, type, title, fields, translations")
        .eq("team_id", ctx.team).eq("id", seg.id))
    const b = rows[0]
    if (!b) return `No page-content block with id ${seg.id}.`
    const { value, locale } = tr(ctx, b)
    const f = b.fields ?? {}
    // The block model is flat, so prose lives under one of several field
    // names depending on the block type.
    const body = toPlainText(
      value?.text ?? value?.richtext ?? f.text ?? f.richtext ?? f.aboutText ?? "",
    )
    return [
      `# ${value?.title || b.title || b.type}`,
      `_${[`type: ${b.type}`, locale && `locale: ${locale}`].filter(Boolean).join(" · ")}_`,
      "",
      body || "(no text content)",
    ].join("\n")
  }

  return `"${seg.kind}" is a branch, not a document. Use action "list" on this path to see `
    + `what it contains; only ${readableKinds(area)} can be read.`
}

const readableKinds = (area: Area) =>
  area === "articles" ? "articles"
    : area === "services" ? "services and providers"
      : "page-content blocks"

// ── Search ───────────────────────────────────────────────────────────────────

interface Hit extends Entry {
  score: number
  body: string
}

async function searchArea(ctx: Ctx, area: Area, query: string, scope: CmsPath["segments"]): Promise<Hit[]> {
  const terms = queryTerms(query)
  const hits: Hit[] = []

  if (area === "articles") {
    const sectionIds = await articleScopeSections(ctx, scope)
    // null means unscoped; an empty array means the scope holds nothing.
    if (sectionIds && !sectionIds.length) return []
    const rows = await step<any>(ctx, "Search articles", "scms_kb_article", () => {
      let q = cms.from("scms_kb_article").select("id, translations, section_id, state, source_locale").eq("team_id", ctx.team)
      if (sectionIds) q = q.in("section_id", sectionIds)
      return q.limit(FETCH_CEILING)
    })
    for (const a of rows) {
      const { value } = tr(ctx, a)
      if (!value) continue
      const score = scoreRecord(a.translations, terms, value.title)
      if (!score) continue
      hits.push({
        path: pathOf("articles", { kind: "article", id: a.id }),
        kind: "article", title: value.title || "(untitled)", readable: true,
        detail: articleDetail(a), score,
        body: toPlainText(value.body ?? value.description),
      })
    }
  }

  if (area === "services") {
    const [rows, providers] = await Promise.all([
      step<any>(ctx, "Search services", "scms_svc_service", () => {
        let q = cms.from("scms_svc_service").select(SERVICE_COLS).eq("team_id", ctx.team)
        // Geography and provider scopes narrow in SQL; category is an id
        // array, filtered below for the reason given in listServiceArea.
        for (const s of scope) {
          if (s.kind === "country") q = q.eq("country_id", s.id)
          if (s.kind === "region") q = q.eq("region_id", s.id)
          if (s.kind === "city") q = q.eq("city_id", s.id)
          if (s.kind === "provider") q = q.eq("provider_id", s.id)
        }
        return q.limit(FETCH_CEILING)
      }),
      step<any>(ctx, "Search providers", "scms_svc_provider", () =>
        cms.from("scms_svc_provider")
          .select("id, name, description, address, status, translations")
          .eq("team_id", ctx.team).limit(FETCH_CEILING)),
    ])

    const categoryScope = scope.filter(s => s.kind === "category").map(s => s.id)
    const scoped = categoryScope.length
      ? rows.filter(s => categoryScope.every(id => asIdList(s.category_ids).includes(id)))
      : rows

    // Provider name -> id, so a service can inherit its provider's score.
    const providerById = new Map<string, any>(providers.map((p: any) => [p.id, p]))
    for (const p of providers) {
      const { value } = tr(ctx, p)
      const score = scoreRecord(
        { name: p.name, description: p.description, address: p.address, translations: p.translations },
        terms, value?.name || p.name,
      )
      if (!score) continue
      hits.push({
        path: pathOf("services", { kind: "provider", id: p.id }),
        // Readable: readNode has a provider branch, and readableKinds()
        // advertises "services and providers". Without this the entry renders
        // [dir], contradicting both.
        kind: "provider", title: value?.name || p.name || "(unnamed provider)",
        readable: true,
        detail: "provider — read it, or list it to see its services", score,
        body: toPlainText(value?.description ?? p.description),
      })
    }

    for (const s of scoped) {
      const { value } = tr(ctx, s)
      const provider = s.provider_id ? providerById.get(s.provider_id) : undefined
      const providerName = provider
        ? (tr(ctx, provider).value?.name || provider.name)
        : undefined
      // The provider's name is part of what a service is findable by.
      const searchable = {
        name: s.name, description: s.description, address: s.address,
        translations: s.translations, provider: providerName,
      }
      const score = scoreRecord(searchable, terms, value?.name || s.name)
      if (!score) continue
      const description = toPlainText(value?.description ?? s.description)
      const address = value?.address ?? s.address
      const status = value?.status ?? s.status
      hits.push({
        path: pathOf("services", { kind: "service", id: s.id }),
        kind: "service", title: value?.name || s.name || "(unnamed service)", readable: true,
        detail: [status, address].filter(Boolean).join(" · ") || undefined, score,
        body: [
          description,
          address && `Address: ${address}`,
          providerName && `Provider: ${providerName}`,
        ].filter(Boolean).join("\n"),
      })
    }
  }

  if (area === "site") {
    const rows = await step<any>(ctx, "Search site content", "scms_site_page_content", () =>
      cms.from("scms_site_page_content").select("id, type, title, fields, translations")
        .eq("team_id", ctx.team).limit(FETCH_CEILING))
    for (const b of rows) {
      const { value } = tr(ctx, b)
      // `type` is a block name and `id` a ULID; neither is content.
      const score = scoreRecord(
        { title: b.title, fields: b.fields, translations: b.translations },
        terms, value?.title || b.title,
      )
      if (!score) continue
      const f = b.fields ?? {}
      hits.push({
        path: pathOf("site", { kind: "block", id: b.id }),
        kind: "block", title: value?.title || b.title || b.type, readable: true,
        detail: b.type, score,
        body: toPlainText(value?.text ?? value?.richtext ?? f.text ?? f.richtext ?? f.aboutText ?? ""),
      })
    }
  }

  return hits
}

async function articleScopeSections(ctx: Ctx, scope: CmsPath["segments"]): Promise<string[] | null> {
  const last = scope[scope.length - 1]
  if (!last) return null
  // Checked before the query: an article scope discards the result.
  if (last.kind === "article") return [] // A leaf scope: read it instead.

  // Explicitly capped. Left unbounded, PostgREST applies its own 1000-row
  // truncation FETCH_CEILING exists to make visible.
  const all = await step<any>(ctx, "Section tree", "scms_kb_section", () =>
    cms.from("scms_kb_section").select("id, category_id, parent_section_id")
      .eq("team_id", ctx.team).limit(FETCH_CEILING))

  const roots = last.kind === "category"
    ? all.filter(s => s.category_id === last.id && !s.parent_section_id).map(s => s.id)
    : [last.id]

  const out = new Set<string>(roots)
  let frontier = new Set<string>(roots)
  while (frontier.size) {
    // walk over every section in the KB.
    const next = all.filter(s => frontier.has(s.parent_section_id)).map(s => s.id)
    frontier = new Set(next.filter(id => !out.has(id)))
    for (const id of frontier) out.add(id)
  }
  return [...out]
}

// ── Tree ─────────────────────────────────────────────────────────────────────

/** Several levels at once, when listing one at a time would take too many calls. */
async function buildTree(
  ctx: Ctx, area: Area, segments: CmsPath["segments"], depth: number,
): Promise<string[]> {
  const lines: string[] = []
  const seen = new Set<string>()

  const walk = async (segs: CmsPath["segments"], level: number, indent: string) => {
    if (level > depth) return
    const entries = await listArea(ctx, area, segs)
    for (const e of entries) {
      const size = e.childCount != null ? ` (${e.childCount})` : ""
      lines.push(`${indent}${e.readable ? "-" : "+"} ${e.title}${size}  ${e.path}`)
      if (e.readable || level >= depth || seen.has(e.path)) continue
      seen.add(e.path)
      // re-derived by slicing — one definition of the path format, not two.
      const parsed = parsePath(e.path)
      if ("error" in parsed) continue
      await walk(parsed.segments, level + 1, `${indent}  `)
    }
  }
  await walk(segments, 1, "")
  return lines
}

function listArea(ctx: Ctx, area: Area, segments: CmsPath["segments"]): Promise<Entry[]> {
  if (area === "articles") return listArticleArea(ctx, segments)
  if (area === "services") return listServiceArea(ctx, segments)
  return listSiteArea(ctx, segments)
}

// ── Formatting ───────────────────────────────────────────────────────────────

function formatEntries(entries: Entry[], header: string): string {
  if (!entries.length) {
    return `${header}\n\n(empty — nothing is filed here)`
  }
  const lines = entries.map(e => {
    const bits = [e.title]
    if (e.childCount != null) bits.push(`(${e.childCount})`)
    if (e.detail) bits.push(`— ${e.detail}`)
    return `${e.readable ? "[doc]" : "[dir]"} ${bits.join(" ")}\n      path: ${e.path}`
  })
  return `${header}\n\n${lines.join("\n")}`
}

function formatTrace(trace: StepTrace[]): string {
  if (!trace.length) return ""
  const lines = trace.map(s =>
    s.error
      ? `  x ${s.label} (${s.table}): FAILED — ${s.error}`
      : `  . ${s.label} (${s.table}): ${s.rows} row${s.rows === 1 ? "" : "s"}`
        + (s.truncated ? " (CAPPED — more exist)" : ""))
  return `Steps:\n${lines.join("\n")}`
}

function callHeader(step: number, action: string, where: string, outcome: string): string {
  return `[${step}] ${action} ${where || "/"} → ${outcome}`
}

function nextStep(w: CMSSearchWorker): number {
  const n = ((w as any).callCount ?? 0) + 1
  ;(w as any).callCount = n
  return n
}

/** One recorded call, as the node's trace panel renders it. */
export interface NavCall {
  step: number
  action: string
  path: string
  outcome: string
  failed: boolean
  /** Per-query detail: which table, how many rows, what failed. */
  steps: StepTrace[]
  result: string
}

const RESULT_KEEP = 4000

const CALL_LOG_LIMIT = 40

function logCall(w: CMSSearchWorker, call: NavCall) {
  const log: NavCall[] = ((w as any).callLog ??= [])
  log.push(call)
  if (log.length > CALL_LOG_LIMIT) log.splice(0, log.length - CALL_LOG_LIMIT)
  w.updateWorker?.()
}

// ── Worker execution ─────────────────────────────────────────────────────────

async function execute(worker: CMSSearchWorker, p: AgentParameters) {
  worker.fields.output.value = []
  worker.fields.textOutput.value = ""
  worker.fields.references.value = []

  const query = String(worker.fields.input.value ?? "").trim()
  if (!query) return

  const team = p.team
  if (!team) {
    worker.error = "CMS Navigator needs a team. It scopes every query by team_id."
    return
  }
  const areas = enabledAreas(worker.parameters)
  if (!areas.length) {
    worker.error = "CMS Navigator has every area switched off. Enable at least one of "
      + "Articles, Service Map or Site Config."
    return
  }

  const ctx: Ctx = {
    team,
    locale: worker.parameters.locale || worker.fields.locale?.value || undefined,
    // Honour the node's Max Results input handle, as locale's is.
    limit: Number(worker.fields.maxResults?.value) || worker.parameters.maxResults || 5,
    trace: [],
  }
  ctx.defaultLocale = ((worker as any).defaultLocale ??= await loadDefaultLocale(ctx))

  const results = await Promise.all(areas.map(a => searchArea(ctx, a, query, [])))
  const hits = results.flat().sort((a, b) => b.score - a.score).slice(0, ctx.limit)

  worker.fields.output.value = hits
  worker.fields.textOutput.value = hits.length
    ? hits.map(h => `### ${h.title}\n_${h.path}_\n\n${h.body || "(no body text)"}`).join("\n\n---\n\n")
    : "No matching content."
  worker.fields.references.value = hits.map(h => ({ link: h.path, title: h.title }))

  logCall(worker, {
    step: nextStep(worker),
    action: "search",
    path: areas.join("+"),
    outcome: `${hits.length} match${hits.length === 1 ? "" : "es"} for "${query}"`,
    failed: ctx.trace.some(t => t.error),
    steps: ctx.trace,
    result: worker.fields.textOutput.value as string,
  })
}

// ── Tool surface ─────────────────────────────────────────────────────────────

const ACTIONS = ["list", "tree", "read", "search"] as const

function getTool(w: CMSSearchWorker, p: AgentParameters): ToolConfig {
  const toolName = "cms_navigator"

  const areas = enabledAreas(w.parameters)

  return {
    name: toolName,
    description:
      (w.parameters?.toolDescription
        ?? "Navigate and read the team's CMS: knowledge-base articles, mapped services, and site page content.")
      + `\n\nThe CMS is a TREE, and this tool walks it like a filesystem. Available areas: `
      + `${areas.join(", ")}.`
      + `\n\nACTIONS`
      + `\n- list(path)   children of one node. path:"" returns the areas. THE DEFAULT MOVE.`
      + `\n- tree(path,depth)  several levels at once, when listing one by one is too slow.`
      + `\n- read(path)   full text of one document (an article, service, or page block).`
      + `\n- search(query, path?)  keyword match; pass a path to search only inside it.`
      + `\n\nPATHS look like "articles/category:01H.../section:01H...". Never compose one`
      + ` by hand — every result gives you the exact path of each entry, so copy it.`
      + `\n\nHOW TO WORK`
      + `\n1. Do not guess a query against content you have not seen. If you do not know`
      + ` what exists, list("") first: three calls down a tree beats one blind search.`
      + `\n2. Entries are marked [dir] (list it) or [doc] (read it), and [dir] entries show`
      + ` how many children they hold — an empty branch is visible as empty.`
      + `\n3. Chain calls. Narrow with list/tree, then read the specific documents, or`
      + ` search inside the branch you landed on. A vague result is a reason to go a`
      + ` level deeper, not a reason to stop.`
      + `\n4. Search the TOPIC, not the sentence. "What are the eligibility requirements`
      + ` for housing support?" searches well as "housing eligibility" and badly as the`
      + ` whole question — matching is on words that appear in the content, and a`
      + ` question's words mostly do not.`
      + `\n5. No matches is not an answer yet. Retry once with broader or different terms,`
      + ` or browse the area instead. Only after that is "it is not in the CMS" a finding.`
      + `\n6. Quote from read() output; cite the path you got it from. If a call reports`
      + ` INCOMPLETE, or you never retrieved the content, say what you could not verify`
      + ` rather than answering as though you had it. Never present an unverified claim`
      + ` as something the CMS says.`,
    parameters: z.object({
      action: z.enum(ACTIONS)
        .describe('Which operation to run: "list", "tree", "read" or "search".'),
      path: z.string()
        .describe(
          'Where to act. "" is the root (the list of areas). Copy a path from an earlier '
          + 'result, e.g. "articles/category:01HXYZ". For search, an optional scope.',
        ),
      query: z.string()
        .describe('Search terms. Only used when action is "search"; pass "" otherwise.'),
      depth: z.number().nullable()
        .describe(`Levels to expand for "tree" (1-${MAX_TREE_DEPTH}). Null means 2.`),
    }),

    async execute(args, ctx) {
      const { action, path, query, depth } = args

      const refuse = (reason: string, detail: string) => {
        const outcome = `REFUSED — ${reason}`
        const step = nextStep(w)
        logCall(w, { step, action, path, outcome, failed: true, steps: [], result: detail })
        return `${callHeader(step, action, path, outcome)}\n\n${detail}`
      }

      const team = p.team
      if (!team) {
        return refuse(
          "no team",
          "This agent has no team, so there is nothing to scope a CMS query to. Every call "
          + "to this tool will refuse until that is fixed, and the graph is not at fault.\n\n"
          + "The team comes from the agent's saved record, so this normally means the agent "
          + "has never been saved. Save it and run again. Do not retry these calls or try "
          + "another path — the result will be the same.",
        )
      }

      const allowed = enabledAreas(w.parameters)
      if (!allowed.length) {
        return refuse(
          "all areas off",
          "Every area is switched off on this CMS Navigator node, so there is nothing to read.",
        )
      }

      const parsed = parsePath(path)
      if ("error" in parsed) return refuse("bad path", parsed.error)
      // narrowing from the guard above does not reach into a nested closure.
      const { area: pathArea, segments } = parsed
      if (pathArea && !allowed.includes(pathArea)) {
        return refuse(
          `${pathArea} is off`,
          `The "${pathArea}" area is switched off on this node. Available: ${allowed.join(", ")}.`,
        )
      }

      const runCtx: Ctx = {
        team,
        locale: w.parameters.locale || undefined,
        limit: w.parameters.maxResults || 5,
        trace: [],
      }
      // Cached on the worker; it does not change between calls in a run.
      // a navigation walk is many calls.
      runCtx.defaultLocale = ((w as any).defaultLocale ??= await loadDefaultLocale(runCtx))

      const step = nextStep(w)
      const { body, outcome } = await run()

      const header = callHeader(step, action, path, outcome)
      const explain = w.parameters.explainSteps !== false
      const trace = explain ? formatTrace(runCtx.trace) : ""

      const failedSteps = runCtx.trace.filter(t => t.error)
      const cappedSteps = runCtx.trace.filter(t => t.truncated)
      const warnings: string[] = []
      if (failedSteps.length) {
        warnings.push(
          `INCOMPLETE — ${failedSteps.length} of ${runCtx.trace.length} queries failed `
          + `(${failedSteps.map(t => t.label).join(", ")}). What follows is missing whatever `
          + `those would have returned. Say so rather than presenting this as the full answer.`,
        )
      }
      // count shown for a capped listing is a floor, not a total.
      if (cappedSteps.length) {
        warnings.push(
          `CAPPED — ${cappedSteps.map(t => t.label).join(", ")} hit the ${FETCH_CEILING}-row `
          + `limit, so this is a partial view and any count is a lower bound. Narrow the path `
          + `or search within a branch rather than treating this as everything there is.`,
        )
      }
      const warning = warnings.join("\n")

      const out = [header, warning, "", body, trace && `\n${trace}`]
        .filter(Boolean).join("\n")

      // Surfaced on the node itself, so the canvas shows the trail too.
      logCall(w, {
        step, action, path, outcome,
        failed: outcome.startsWith("FAILED") || runCtx.trace.some(t => t.error),
        steps: runCtx.trace,
        result: body.length > RESULT_KEEP ? `${body.slice(0, RESULT_KEEP)}

…truncated` : body,
      })
      ctx["searchResults"] = out
      return out

      async function run(): Promise<{ body: string; outcome: string }> {
        // Outcomes are phrased as counts, so an empty result is unmistakably
        const plural = (n: number, one: string, many = `${one}s`) =>
          `${n} ${n === 1 ? one : many}`

        try {
          // Root: the areas themselves, so an agent with no context has a
          // first call that always works.
          if (!pathArea) {
            if (action === "read") {
              return {
                body: 'The root is not a document. Call list with path:"" instead.',
                outcome: "not a document",
              }
            }
            if (action === "search") {
              const results = await Promise.all(
                allowed.map(a => searchArea(runCtx, a, query, [])),
              )
              const hits = results.flat()
              return {
                body: formatSearch(hits, query, "the whole CMS", runCtx.limit),
                outcome: `${plural(Math.min(hits.length, runCtx.limit), "match", "matches")} for "${query}" across all areas`,
              }
            }
            return {
              body: formatEntries(
                allowed.map(a => ({
                  path: a,
                  kind: "area",
                  title: AREA_LABEL[a],
                  detail: areaHint(a),
                })),
                "CMS root — three areas:",
              ),
              outcome: `${plural(allowed.length, "area")} to explore`,
            }
          }

          const area = pathArea

          if (action === "read") {
            const last = segments[segments.length - 1]
            if (!last) {
              return {
                body: `"${area}" is an area, not a document. Call list on it instead.`,
                outcome: "not a document",
              }
            }
            const body = await readNode(runCtx, area, last)
            return { body, outcome: `${last.kind}, ${body.length} chars` }
          }

          if (action === "search") {
            if (!query.trim()) {
              return {
                body: 'search needs a query. Pass one, or use action "list" to browse.',
                outcome: "no query given",
              }
            }
            const hits = await searchArea(runCtx, area, query, segments)
            const shown = Math.min(hits.length, runCtx.limit)
            return {
              body: formatSearch(hits, query, path || AREA_LABEL[area], runCtx.limit),
              outcome: `${plural(shown, "match", "matches")} for "${query}"`,
            }
          }

          if (action === "tree") {
            const d = Math.max(1, Math.min(depth ?? 2, MAX_TREE_DEPTH))
            const lines = await buildTree(runCtx, area, segments, d)
            const head = `${path || AREA_LABEL[area]} — ${d} level${d === 1 ? "" : "s"} deep:`
            return {
              body: lines.length ? `${head}\n\n${lines.join("\n")}` : `${head}\n\n(empty)`,
              outcome: `${plural(lines.length, "node")}, ${d} level${d === 1 ? "" : "s"} deep`,
            }
          }

          const entries = await listArea(runCtx, area, segments)
          // Split by type: "3 dirs, 12 docs" tells the reader whether to keep
          // descending or start reading, which is the decision at every step.
          const docs = entries.filter(e => e.readable).length
          const dirs = entries.length - docs
          const parts = [dirs && `${plural(dirs, "folder")}`, docs && `${plural(docs, "document")}`]
            .filter(Boolean) as string[]
          return {
            body: formatEntries(entries, `${path || AREA_LABEL[area]}:`),
            outcome: parts.length ? parts.join(", ") : "empty",
          }
        } catch (err) {
          return { body: `CMS Navigator failed: ${errText(err)}`, outcome: `FAILED — ${errText(err)}` }
        }
      }
    },
  }
}

const areaHint = (a: Area) =>
  a === "articles" ? "knowledge base: category > section > article"
    : a === "services"
      ? "services three ways: by geography (country > region > city), by category, or by provider"
      : "site settings and page-content blocks"

function formatSearch(hits: Hit[], query: string, where: string, limit: number): string {
  const top = [...hits].sort((a, b) => b.score - a.score).slice(0, limit)
  if (!top.length) {
    return `No matches for "${query}" in ${where}.\n\n`
      + `Keyword search only finds words that actually appear in the content. If you are `
      + `not sure what is there, browse instead: list this path and look at what exists.`
  }
  const body = top.map(h => {
    const meta = [h.kind, h.detail].filter(Boolean).join(" · ")
    return `### ${h.title}\n_${meta}_\npath: ${h.path}\n\n${h.body || "(no body text)"}`
  }).join("\n\n---\n\n")
  return `${top.length} match${top.length === 1 ? "" : "es"} for "${query}" in ${where}:\n\n${body}`
}

export const cmssearch: WorkerRegistryItem = {
  title: "CMS Navigator 🧪",
  category: "tool",
  type: "cmssearch",
  description:
    "Navigate the Smart CMS as a tree — list categories and sections, read articles, "
    + "services and page content, and search within any branch.",
  execute,
  create(agent: Agent) {
    const w = agent.initializeWorker(
      { type: "cmssearch", parameters: { maxResults: 5 } },
      [
        { type: "string", direction: "input", title: "Query", name: "input" },
        { type: "doc", direction: "output", title: "Results", name: "output" },
        { type: "string", direction: "output", title: "Text Output", name: "textOutput" },
        { type: "references", direction: "output", title: "References", name: "references" },
        { type: "tool", direction: "input", title: "Tool", name: "tool" },
        { type: "string", direction: "input", title: "Locale", name: "locale" },
        { type: "number", direction: "input", title: "Max Results", name: "maxResults" },
      ],
      cmssearch,
    )
    w.getTool = getTool
    return w
  },
  get registry() { return cmssearch },
}
