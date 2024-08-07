import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core/index.js'
import { createPool } from 'mysql2' // do not use 'mysql2/promises'!
import { Kysely, MysqlDialect } from 'kysely'
import { DB } from "./db.types"

const dialect = new MysqlDialect({
  pool: createPool({
    host: 'theirc-mysql-57-prod-eastus.mysql.database.azure.com',
    database: process.env.DB,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: 3306,
  })
})

export const dbk = new Kysely<DB>({ dialect, log: ["query"] })

async function getRelated<JunctionTable extends keyof DB, RelatedTable extends keyof DB>(id: number, table: JunctionTable, tableId: keyof DB[JunctionTable], related: RelatedTable, relatedId: keyof DB[JunctionTable]): Promise<DB[RelatedTable][]> {
  const joint = await dbk.selectFrom(table).where(tableId as any, '=', id).select(`${relatedId as string} as id` as any).execute()
  const dest = await dbk.selectFrom(related).where("id" as any, "in", joint.map((x: any) => x.id)).selectAll().execute()
  return dest as any || []
}



declare global {

  type Providers = "openai" | "gemini" | "claude" | "ollama"

  interface BotConfigBase {
    id?: number
    title?: string

    kbtype?: "zd" | "zdsearch" | "services" | "country" | "weaviate" | "vectorless"

    temperature?: number

    ignoredefaultprompt?: boolean
    ignoredefaultconstitutional?: boolean
    prompt?: string

    llm?: Providers
    model?: string

    enablehistory?: boolean

    distance?: number
    maxresults?: number
    solinum?: boolean

    channels?: {
      link?: string
      title?: string
      disable?: boolean
    }[]

  }

  interface BotConfig extends BotConfigBase {
    countries?: string[]
    zddomains?: string[]
    constitution?: {
      critique?: string
      revision?: string
    }[]
  }

}


interface BotConfigDB extends BotConfigBase {

  zddomains?: {
    domain: string
  }[]

  countries?: {
    countries_n_id?: {
      id?: number
    }
  }[]

  ai_system_prompts?: {
    ai_system_prompts_id: {
      systemconstitution?: string
    }
  }[]

  constitution?: {
    constitutionalai_id?: {
      critique?: string
      revision?: string
    }
  }[]
}

interface DefaultBotConfig {
  botsconfig: {
    id?: string
    distance?: number
    maxresults?: number
    prompt?: string
    constitution?: {
      constitutionalai_id?: {
        critique?: string
        revision?: string
      }
    }[]
  }
}

const client = new ApolloClient({
  uri: `${process.env.DIRECTUS}graphql`,
  cache: new InMemoryCache(),
  headers: { Authorization: `Bearer ${process.env.DIRECTUS_AUTH}` }
})

const clientProd = new ApolloClient({
  uri: `${process.env.DIRECTUS_PROD}graphql`,
  cache: new InMemoryCache(),
  headers: { Authorization: `Bearer ${process.env.DIRECTUS_AUTH_PROD}` }
})


async function getBotConfig(id: number): Promise<BotConfig> {

  const b = await dbk.selectFrom('ai').where('id', '=', id).selectAll().executeTakeFirst()
  const defaults = await dbk.selectFrom("botsconfig").selectAll().where("id", "=", 1).executeTakeFirst()
  const defaultConstitution = await getRelated(1, "botsconfig_constitutionalai", "botsconfig_id", "constitutionalai", "constitutionalai_id")

  const prompts = await getRelated(id, "ai_ai_system_prompts", "ai_id", "ai_system_prompts", "ai_system_prompts_id")
  const constitution = await getRelated(id, "ai_constitutionalai", "ai_id", "constitutionalai", "constitutionalai_id")
  const countries = await getRelated(id, "ai_countries_n", "ai_id", "countries_n", "countries_n_id")

  let prompt = b.ignoredefaultprompt ? "" : (defaults.prompt || "")
  const linkedpropmpts = prompts.map(p => p.systemconstitution ?? null).filter(p => p).join("\n")
  if (linkedpropmpts) prompt = prompt + "\n" + linkedpropmpts + "\n"

  const llm: Providers = b.llm as Providers
  let model = ""

  if (llm == "openai") {
    model = b.model
  } else if (llm == "gemini") {
    model = b.modelgemini
  } else if (llm == "claude") {
    model = b.modelclaude
  } else if (llm == "ollama") {
    model = b.modelollama
  }

  const bot: BotConfig = {
    id,
    title: b.title || '',
    channels: b.channels as any || [],
    constitution: [
      ...((defaultConstitution || []).filter(c => c.critique && c.revision).map(c => ({ critique: c.critique, revision: c.revision }))),
      ...(constitution || []).filter(c => c.critique && c.revision).map(c => ({ critique: c.critique, revision: c.revision }))
    ],
    countries: (countries || []).map(c => c.id + "").filter(c => c),
    distance: Number(b.distance) || Number(defaults.distance) || 0.4,
    maxresults: b.maxresults || defaults.maxresults || 4,
    enablehistory: b.enablehistory as unknown as boolean || false,
    ignoredefaultconstitutional: b.ignoredefaultconstitutional as any || false,
    ignoredefaultprompt: b.ignoredefaultprompt as any || false,
    kbtype: b.kbtype as any || 'weaviate',
    llm,
    model,
    prompt,
    temperature: Number(b.temperature) || 0,
    solinum: b.solinum as any || false,
    zddomains: (b.zddomains as { domain: string }[] || []).map(d => d.domain),
  }

  return bot

}

// async function getBotConfig(id: number): Promise<BotConfig> {

//   await testK()

//   const defaultConfig = await client.query<DefaultBotConfig>({
//     variables: { id },
//     query: gql`
//         query  {
//           botsconfig {
//             id
//             prompt
//             distance
//             maxresults
//             constitution {
//               constitutionalai_id {
//                 critique
//                 revision
//               }
//             }
//           }
//         }
//     `}
//   )

//   const cfg = await client.query<{ ai_by_id: BotConfigDB }>({
//     variables: { id },
//     query: gql`
//         query Bot($id: ID!) {
//           ai_by_id(id: $id) {
//             id
//             title
//             kbtype
//             llm
//             modelgemini
//             modelollama
//             temperature
//             ignoredefaultprompt
//             ignoredefaultconstitutional
//             prompt
//             zddomains
//             llm
//             model
//             modelgemini
//             modelollama
//             enablehistory
//             channels
//             distance
//             maxresults
//             countries {
//               countries_n_id {
//                 id
//               }
//             }
//             constitution {
//               constitutionalai_id {
//                 critique
//                 revision
//               }
//             }
//             ai_system_prompts {
//               ai_system_prompts_id {
//                 systemconstitution
//               }
//             }
//           }
//         }
//     `}
//   )

//   const defaults = defaultConfig.data?.botsconfig || {}

//   const b = cfg.data.ai_by_id || {}


//   let prompt = b.ignoredefaultprompt ? "" : (defaults.prompt || "")

//   const linkedpropmpts = (b.ai_system_prompts || []).map(p => p.ai_system_prompts_id?.systemconstitution ?? null).filter(p => p).join("\n")
//   if (linkedpropmpts) prompt = prompt + "\n" + linkedpropmpts + "\n"


//   const bot: BotConfig = {
//     id,
//     title: b.title || '',
//     channels: b.channels || [],
//     constitution: [
//       ...((defaults.constitution || []).filter(c => c.constitutionalai_id && c.constitutionalai_id.critique && c.constitutionalai_id.revision).map(c => ({ critique: c.constitutionalai_id.critique, revision: c.constitutionalai_id.revision }))),
//       ...(b.constitution || []).filter(c => c.constitutionalai_id && c.constitutionalai_id.critique && c.constitutionalai_id.revision).map(c => ({ critique: c.constitutionalai_id.critique, revision: c.constitutionalai_id.revision }))
//     ],
//     countries: (b.countries || []).map(c => c.countries_n_id.id + "").filter(c => c),
//     distance: b.distance || defaults.distance || 0.4,
//     maxresults: b.maxresults || defaults.maxresults || 4,
//     enablehistory: b.enablehistory || false,
//     ignoredefaultconstitutional: b.ignoredefaultconstitutional || false,
//     ignoredefaultprompt: b.ignoredefaultprompt || false,
//     kbtype: b.kbtype || 'weaviate',
//     llm: b.llm || 'openai',
//     model: b.model || '',
//     modelgemini: b.modelgemini || '',
//     modelollama: b.modelollama || '',
//     prompt,
//     temperature: b.temperature || 0,
//     solinum: b.solinum || false,
//     zddomains: (b.zddomains || []).map(d => d.domain),
//   }

//   return bot

// }

async function getBots(): Promise<Promise<{ [index: number]: string }>> {
  const list = await dbk.selectFrom("ai").selectAll().execute()
  return list.reduce((p, c) => ({ ...p, [c.id]: c.title }), {})
}


async function saveLog(log: AILog) {
  await dbk.insertInto("botlogs").values(log as any).execute()
}

export const db = {
  saveLog,
  getBots,
  getBotConfig,

}


