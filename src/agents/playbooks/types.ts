declare global {

  // ── Definition ────────────────────────────────────────────────────────────

  interface Playbook {
    id: string
    version?: number
    config?: PlaybookConfig                         // settings of the playbook, as opposed to steps of the conversation
    interrupts?: PlaybookInterrupt[]                // checked before anything else. The first pending one takes the turn
    main: PlaybookItem[]                            // the orchestrator. Always present, the session starts on its first item
    flows?: { [flow: string]: PlaybookItem[] }      // satellite flows, entered with call: and left with return. "main" is reserved
    globals?: PlaybookGuard[]                       // deterministic guards, always active, matched on the raw text
    defaults?: { on_no_match?: PlaybookNoMatch }
  }

  interface PlaybookConfig {
    model?: string                                  // the model every ai item of this playbook runs on
  }

  /**
   * A terms of service, a consent screen: something that must run once and give the conversation back
   * where it was. It lives outside the path of the cursor, so nothing about the cursor remembers that it
   * ran — its own flow writes the var its condition reads, and that is the one place where a var
   * legitimately records progress. Everywhere else the cursor is the only record (see PlaybookItem.condition).
   *
   * Nothing about it is stored in the state: pending is derived from the condition on every turn, and
   * while it is pending the conversation belongs to its flow
   */
  interface PlaybookInterrupt {
    condition: PlaybookCondition                    // true = pending. The flow it calls has to falsify it or it fires forever
    then: PlaybookOutcome                           // "call:<flow>", so the return lands back on the exact item
  }

  // say is what makes an item wait: it emits and the cursor rests there until the next message arrives.
  // An item without say is a routing item: it decides and moves on inside the same turn, emitting nothing
  interface PlaybookItem {
    id: string
    type?: "ai"                                     // absent = deterministic. An ai item always waits and never reasks
    intent?: string                                 // prose for the human author and for the AI that edits later. The runtime ignores it
    say?: string                                    // handlebars template rendered against vars
    prompt?: string                                 // ai item only: the instruction handed to the model. Same template
    options?: PlaybookOption[]                      // closed answers, emitted as the quick replies of the turn. On an ai item, its escapes
    slot?: string                                   // captures the raw text into vars[slot]. The only way to store what the user wrote
    condition?: PlaybookCondition                   // evaluated on entry, before say. A precondition about data, never about
    //                                                 whether this item already ran: an item does not gate itself on a var it writes
    then?: PlaybookOutcome                          // routing item: the branch taken now. Item with slot: where to go after the capture
    else?: PlaybookOutcome                          // outcome when the condition is false
    on_no_match?: PlaybookNoMatch                   // overrides the playbook default. Only reachable on items with options
  }

  interface PlaybookOption {
    id?: string                                     // what the channel sends back when tapped. Derived from the label when omitted
    label?: string                                  // button text, and the primary thing the typed message is matched against
    match?: string[]                                // extra synonyms beyond the label. "*" is a catch-all
    set?: { [key: string]: any }                    // writes vars when this option is picked
    say?: string                                    // prepended to the say of the destination
    then?: PlaybookOutcome
  }

  interface PlaybookGuard {
    match: string[]
    set?: { [key: string]: any }
    then?: PlaybookOutcome
  }

  interface PlaybookNoMatch {
    policy: "reask"
    max?: number
    then?: PlaybookOutcome                          // where to go once the attempts run out
  }

  // Besides these: "goto:<flow>.<item>" and "call:<flow>". Omitting an outcome means "next".
  // "end" closes the session: the cursor goes null and the next message boots a fresh one
  type PlaybookOutcome = LiteralUnion<"next" | "stay:reask" | "stay:silent" | "return" | "end">

  type PlaybookOperator = "==" | "!=" | ">" | ">=" | "<" | "<="

  // Presence, which no comparison can express: undefined, null and "" are all unset
  type PlaybookTest = "isSet" | "isEmpty"

  // Stored already split so the runtime never parses anything. ["consent"] is a truth test,
  // ["country", "isEmpty"] asks about presence, ["country", "==", "greece"] compares. Strings compare normalized
  type PlaybookCondition = [string] | [string, PlaybookTest] | [string, PlaybookOperator, any]

  // ── Runtime ───────────────────────────────────────────────────────────────

  interface PlaybookInput {
    id?: string                                     // idempotency
    message?: string
    received_at?: string
  }

  // The whole call in one object, assembled for the turn and thrown away: what survives is the PlaybookTurn.
  // playbook, state and input are data; hooks, tools and ai are capabilities the caller lends to the turn.
  // Keeping them apart is what lets a test replay a stored conversation against a fake model
  interface PlaybookRequest {
    playbook: Playbook
    state: PlaybookState | null
    input: PlaybookInput
    hooks?: PlaybookHooks
    tools?: PlaybookTool[]
    ai?: PlaybookAI
  }

  // The single AI surface of the runtime. Injected instead of imported so the core carries no provider
  // and a test can hand over a fake. Async by nature, and the reason step is async
  type PlaybookAI = (call: PlaybookAICall) => Promise<PlaybookAIResult>

  interface PlaybookAICall {
    model?: string
    prompt: string                                  // the prompt of the item, already interpolated
    message: string                                 // what the contact just wrote
    vars: { [key: string]: any }
    tools?: PlaybookTool[]
  }

  // Prose only for now. Vars written by the model and transitions it chooses arrive with the tool dispatch
  interface PlaybookAIResult {
    text?: string
  }

  // Declared, not wired: the runtime does not read them yet, it only hands them to the adapter.
  // run is injected for the same reason ai is, so a test never leaves the process
  interface PlaybookTool {
    name: string
    description?: string
    parameters?: any                                // json schema shown to the model
    run?: (args: any) => Promise<any>
  }

  // Observation, kept out of the input so what arrived stays plain data: serializable, storable, replayable.
  // A hook can never change the turn. It is not awaited and anything it throws or rejects is swallowed,
  // so the core stays synchronous and deterministic. Interception points come later, with the model stage
  interface PlaybookHooks {
    onTrace?: (entry: PlaybookTrace) => void | Promise<void>
  }

  // One envelope per turn, assembled at the end. Mirrors ChannelOutput: the adapter maps it to its own payload
  interface PlaybookOutput {
    response?: string                                // every text of the turn already interpolated and joined
    quick_replies?: PlaybookQuickReply[]            // the options of the item where the cursor came to rest
    files?: string[]                                // the media fields stay empty in the deterministic core
    images?: string[]
    audio?: { audio: string, ext: string }
  }

  interface PlaybookQuickReply {
    id: string
    label: string
  }

  // Where the session is right now. flow is "main" or a key of playbook.flows
  interface PlaybookCursor {
    flow: string
    item: string
  }

  interface PlaybookState {
    playbook_version?: number
    rev: number
    cursor: PlaybookCursor | null                   // null = closed session. The next message boots a fresh one
    stack: PlaybookCursor[]                         // return points pushed by call
    vars: { [key: string]: any }
    attempts: number                                // reset on every cursor change
    last_inbound_id?: string
  }

  interface PlaybookTrace {
    seq: number
    flow?: string
    item?: string
    layer?: "boot" | "duplicate" | "interrupt" | "global" | "item" | "ai" | "no_match" | "enter" | "recover" | "template"
    option?: string
    outcome?: string
    note?: string                                   // requires, exhausted budget, resolution errors
  }

  interface PlaybookTurn {
    output: PlaybookOutput
    state: PlaybookState
    trace: PlaybookTrace[]
  }

}

export { }
