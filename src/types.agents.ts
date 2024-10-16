export { }

type Operators = "=" | "!=" | "<" | "<=" | ">" | ">=" | "null" | "notnull" | "contains" | "notcontain" | "startswith" | "notstartswith" | "endswith" | "notendswith"
type Members = "input" | "output" | "documents" | "prompt"
type VariableTypes = "text" | "number" | "flag"

declare global {

  type RightOperands = "input" | "output" | "documents" | "prompt" | "true" | "false"
  type WorkerTypes = "ai" | "content" | "documentselector" | "schema" | "search" | "stt" | "tts" | "zendesk"

  type ReservedMembers = keyof Omit<Agent, "variables">

  type SchemaTypes = {
    title?: string
    name: string
    type: VariableTypes
    prompt: string
  }

  interface Agent {
    title?: string
    workers: AgentWorker[]
    input: string
    prompt?: string
    history?: ChatHistoryItem[]
    documents?: Doc[]
    audio?: {
      content: string
      extension: string
    }
    error?: string
    variables?: {
      [key: string]: any
    }
  }

  interface Payload {
    input?: any
    output?: any
    prompt?: any
    documents?: any[]
    [key: string]: unknown
  }


  interface AgentWorker {
    title?: string
    type: WorkerTypes
    end?: boolean // End the request if executed
    input?: LiteralUnion<Members>
    output?: LiteralUnion<Members>
    template?: string
    condition?: { left: LiteralUnion<Members>, operator: Operators, right: LiteralUnion<RightOperands> }


    //Specific for ai
    model?: string
    temperature?: number


    //Specific for schema Worker
    schemas?: SchemaTypes[]

    //Specific for search worker
    searchengine?: "weaviate" | "exa"
    searchDistance?: number
    searchLimit?: number
    domains?: string[]

    //Specific for tts
    ttsProvider?: "whisper"

    //Specific for zendesk
    zendeskDomain?: string
    zendeskAction?: "getcomments" | "sendmessage"

  }

}


