declare global {

  // ── Definition ────────────────────────────────────────────────────────────

  interface Playbook {
    id: string
    version?: number
    main: PlaybookItem[]                            // the orchestrator. Always present, the session starts on its first item
    flows?: { [flow: string]: PlaybookItem[] }      // satellite flows, entered with call: and left with return. "main" is reserved
    globals?: PlaybookGuard[]                       // deterministic guards, always active, matched on the raw text
    defaults?: { on_no_match?: PlaybookNoMatch }
  }

  // say is what makes an item wait: it emits and the cursor rests there until the next message arrives.
  // An item without say is a routing item: it decides and moves on inside the same turn, emitting nothing
  interface PlaybookItem {
    id: string
    intent?: string                                 // prose for the human author and for the AI that edits later. The runtime ignores it
    say?: string                                    // accepts {var}
    options?: PlaybookOption[]                      // closed answers, emitted as the quick replies of the turn
    slot?: string                                   // captures the raw text into vars[slot]. The only way to store what the user wrote
    condition?: PlaybookCondition                   // evaluated on entry, before say. Decides whether the item runs at all
    then?: PlaybookOutcome                          // routing item: the branch taken now. Item with slot: where to go after the capture
    else?: PlaybookOutcome                          // outcome when the condition is false
    on_no_match?: PlaybookNoMatch                   // overrides the playbook default. Only reachable on items with options
  }

  interface PlaybookOption {
    id: string                                      // what the channel sends back when the button is tapped
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
    layer?: "boot" | "duplicate" | "global" | "item" | "no_match" | "enter" | "recover"
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
