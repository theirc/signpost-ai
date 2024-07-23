import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core/index.js'

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
    modelgemini?: string
    modelollama?: string

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
    prompts?: string[]
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

  const defaultConfig = await db.client.query<DefaultBotConfig>({
    variables: { id },
    query: gql`
        query  {
          botsconfig {
            id
            prompt
            distance
            maxresults
            constitution {
              constitutionalai_id {
                critique
                revision
              }
            }
          }
        }
    `}
  )

  const cfg = await db.client.query<{ ai_by_id: BotConfigDB }>({
    variables: { id },
    query: gql`
        query Bot($id: ID!) {
          ai_by_id(id: $id) {
            id
            title
            kbtype
            llm
            modelgemini
            modelollama
            temperature
            ignoredefaultprompt
            ignoredefaultconstitutional
            prompt
            zddomains
            llm
            model
            modelgemini
            modelollama
            enablehistory
            channels
            distance
            maxresults
            countries {
              countries_n_id {
                id
              }
            }
            constitution {
              constitutionalai_id {
                critique
                revision
              }
            }
            ai_system_prompts {
              ai_system_prompts_id {
                systemconstitution
              }
            }
          }
        }
    `}
  )

  const b = cfg.data.ai_by_id

  const bot: BotConfig = {
    id,
    title: b.title || '',
    channels: b.channels || [],
    constitution: [
      ...((defaultConfig.data.botsconfig.constitution || []).filter(c => c.constitutionalai_id && c.constitutionalai_id.critique && c.constitutionalai_id.revision).map(c => ({ critique: c.constitutionalai_id.critique, revision: c.constitutionalai_id.revision }))),
      ...(b.constitution || []).filter(c => c.constitutionalai_id && c.constitutionalai_id.critique && c.constitutionalai_id.revision).map(c => ({ critique: c.constitutionalai_id.critique, revision: c.constitutionalai_id.revision }))
    ],
    countries: (b.countries || []).map(c => c.countries_n_id.id + "").filter(c => c),
    distance: b.distance || defaultConfig.data.botsconfig.distance || 0.4,
    maxresults: b.maxresults || defaultConfig.data.botsconfig.maxresults || 4,
    enablehistory: b.enablehistory || false,
    ignoredefaultconstitutional: b.ignoredefaultconstitutional || false,
    ignoredefaultprompt: b.ignoredefaultprompt || false,
    kbtype: b.kbtype || 'weaviate',
    llm: b.llm || 'openai',
    model: b.model || '',
    modelgemini: b.modelgemini || '',
    modelollama: b.modelollama || '',
    prompt: (defaultConfig.data.botsconfig.prompt || '') + "\n" + (b.prompt || ''),
    temperature: b.temperature || 0,
    prompts: (b.ai_system_prompts || []).map(p => p.ai_system_prompts_id?.systemconstitution ?? null).filter(p => p),
    solinum: b.solinum || false,
    zddomains: (b.zddomains || []).map(d => d.domain),
  }

  return bot

}




async function getBots(): Promise<Promise<{ [index: number]: string }>> {

  interface BotList {
    ai: {
      id: number
      title: string
    }[]
  }

  const lists = await db.client.query<BotList>({
    query: gql`
        query  {
          ai {
            id
            title
          }
        }
    `}
  )

  return lists.data.ai.reduce((p, c) => ({ ...p, [c.id]: c.title }), {})

}

export const db = {
  getBots,
  client,
  clientProd,
  getBotConfig,
}


