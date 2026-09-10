declare global {

  // ── Definition ────────────────────────────────────────────────────────────

  interface Playbook {
    id: string
    version?: number
    config?: PlaybookConfig                         // settings of the playbook, as opposed to steps of the conversation
    main: PlaybookItem[]                            // the orchestrator. Always present, the session starts on its first item
    flows?: { [flow: string]: PlaybookItem[] }      // the conversation moves into one with a goto and leaves the same way. "main" is reserved
    defaults?: { on_no_match?: PlaybookNoMatch }
  }

  interface PlaybookConfig {
    model?: string                                  // the model every ai item of this playbook runs on
    on_lost?: PlaybookCursor                        // where a cursor that no longer resolves goes, because the playbook was
    //                                                 edited with the conversation live. Usually the main menu, or the top.
    //                                                 Omitted = main[0]. The runtime does not walk and does not guess:
    //                                                 deleting an item that conversations are parked on is a save time error
  }

  /**
   * A flow is a sequence, and every item of it is visited twice, in two different turns: entering it says
   * its piece and the cursor rests there, and the next message comes back to that same item to be
   * processed. Leaving the sequence takes an option the contact picked or a tool the model called — never
   * the item itself, and never a condition.
   *
   * What the second visit does is whatever the item declares: options to pick from, a set to capture into,
   * or type "ai". An item that declares none of the three waits for an answer it cannot use, and the
   * validator blocks it. Saying nothing is not allowed either: with nothing to say there is no question to
   * answer, so nothing to wait for, and the walk goes over it
   */
  interface PlaybookItem {
    id: string
    type?: "ai"                                     // absent = deterministic. An ai item always waits and never reasks
    intent?: string                                 // prose for the human author and for the AI that edits later. The runtime ignores it
    say?: string                                    // handlebars template rendered against vars
    prompt?: string                                 // ai item only: the instruction handed to the model. Same template
    options?: PlaybookOption[]                      // closed answers, emitted as the quick replies of the turn. On an ai item, its escapes
    set?: string                                    // the var this item captures into. An item only captures if it names one,
    //                                                 and it is the only way to store what the contact wrote rather than a literal.
    //                                                 The option flavour of set writes literals; this one writes the message
    condition?: PlaybookCondition                   // a filter, not a branch: false means this item does not run and the
    //                                                 conversation moves to the next one. There is no else. On an item that
    //                                                 captures, gating on its own var is the idiom for "we already have this
    //                                                 and a reset should not ask again"
    on_no_match?: PlaybookNoMatch                   // overrides the playbook default. Only reachable on items with options
  }

  interface PlaybookOption {
    id?: string                                     // what the channel sends back when tapped. Derived from the label when omitted
    label?: string                                  // button text, and what a typed message is matched against
    match?: string[]                                // other ways of saying the same label. The label always matches on its own,
    //                                                 so this is only for synonyms. There is no catch-all: an option is a
    //                                                 closed answer, and anything else is a no-match
    condition?: PlaybookCondition                   // when it does not hold the option is not on offer: not drawn, and not
    //                                                 selectable by typing its label either
    set?: { [key: string]: any }                    // writes vars when this option is picked. Writing null is how it forgets one
    say?: string                                    // prepended to the say of the destination
    action?: PlaybookOutcome                        // what picking it does. Omitted means the item below
  }

  // What goes in front of the question when nothing matched. There is no escalation and nothing is counted:
  // an item with options is a closed question and it repeats until one is picked. The only way out is one
  // of its own options
  interface PlaybookNoMatch {
    say?: string                                    // prepended to the say of the item, rendered like any other text
  }

  /**
   * What an option hands back to the runtime, and the only way anything moves the cursor.
   *
   * Stored already split, same reason as PlaybookCondition: the runtime parses nothing, and the type
   * constrains what can be written. As a string a typo like "gotoo:main.menu" compiled and failed at
   * runtime; now it does not compile. Omitting an outcome altogether still means next.
   *
   * Three cases, and each one moves the cursor. There is no call and no return, so entering another flow
   * is a one way move; and there is no outcome that keeps the cursor where it is, because an item that
   * said its piece and got an answer either moves on or stays without being asked to
   */
  type PlaybookOutcome =
    | { type: "next" }                              // the following item of the array. The default when omitted
    | { type: "reset" }                             // back to the first item of main, in this same turn. vars survive, so every item already answered is skipped by its own condition
    | { type: "goto", flow: string, item: string }  // jump. The same pair as a PlaybookCursor

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
    cursor: PlaybookCursor | null                   // null = closed session. The next message boots a fresh one
    vars: { [key: string]: any }                    // what is known about the contact. Nothing in the language clears them: a reset moves the cursor, and forgetting a datum is a set to null
    last_inbound_id?: string
  }

  interface PlaybookTrace {
    seq: number
    flow?: string
    item?: string
    layer?: "boot" | "duplicate" | "item" | "ai" | "no_match" | "enter" | "lost" | "template"
    option?: string
    outcome?: string
    note?: string                                   // filtered items, template holes, resolution errors
  }

  interface PlaybookTurn {
    output: PlaybookOutput
    state: PlaybookState
    trace: PlaybookTrace[]
  }

}

export { }
