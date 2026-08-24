declare global {

  // ── Definition ────────────────────────────────────────────────────────────

  interface Playbook {
    id: string
    version?: number
    entry: string                                   // id of the starting flow
    globals?: PlaybookGuard[]                       // deterministic guards, always active, matched on the raw text
    defaults?: { on_no_match?: PlaybookNoMatch }
    flows: { [flow: string]: PlaybookItem[] }       // array order only defines what "next" means
  }

  interface PlaybookItem {
    id: string
    intent?: string                                 // prose for the human author and for the AI that edits later. The runtime ignores it
    say?: PlaybookElement[]                         // emitted when entering the item
    interpret?: "exact"                             // having interpret or slot is what makes the item consume the message
    options?: PlaybookOption[]
    slot?: PlaybookSlot
    requires?: string                               // entry precondition, closed vocabulary: var op literal
    then?: PlaybookOutcome                          // outcome for routing items and for items with a slot
    else?: PlaybookOutcome                          // outcome when requires is not met
    on_no_match?: PlaybookNoMatch                   // overrides the playbook default
    terminal?: boolean                              // reserved hook, no behaviour yet
  }

  interface PlaybookOption {
    id: string
    label?: string                                  // text used for quick replies
    match?: string[]                                // synonyms. The id works as an alias, "*" is a catch-all
    set?: { [key: string]: any }                    // writes vars when this option is picked
    say?: PlaybookElement[]                         // accumulates with the say of the destination
    then: PlaybookOutcome
  }

  interface PlaybookSlot {
    name: string
    validate: string                                // mandatory. "text" | "text:1..60" | "number" | "number:0..10"
  }

  interface PlaybookGuard {
    match: string[]
    set?: { [key: string]: any }
    then: PlaybookOutcome
  }

  interface PlaybookNoMatch {
    policy: "reask"
    max?: number
    then?: PlaybookOutcome                          // where to go once the attempts run out
  }

  interface PlaybookElement {
    kind: "text" | "quick_replies"
    content?: string                                // kind text. Accepts {var}
    from?: "options"                                // kind quick_replies. Builds the replies from the options of the item
    options?: { id: string, label: string }[]       // explicit quick replies, or the result of expanding "from"
  }

  // Besides these: "goto:<flow>.<item>" and "call:<flow>"
  type PlaybookOutcome = LiteralUnion<"next" | "stay:reask" | "stay:silent" | "return" | "end">

  // ── Runtime ───────────────────────────────────────────────────────────────

  interface PlaybookInput {
    id?: string                                     // idempotency
    text?: string
    received_at?: string
  }

  interface PlaybookCursor {
    flow: string
    item: string
  }

  interface PlaybookState {
    playbook_version?: number
    rev: number
    cursor: PlaybookCursor | null                   // null = session not started
    stack: PlaybookCursor[]                         // return points pushed by call
    vars: { [key: string]: any }
    attempts: number                                // reset on every cursor change
    status: "active" | "ended"
    last_inbound_id?: string
  }

  interface PlaybookTrace {
    seq: number
    flow?: string
    item?: string
    layer?: "boot" | "duplicate" | "ended" | "global" | "item" | "no_match" | "enter"
    option?: string
    outcome?: string
    note?: string                                   // requires, exhausted budget, resolution errors
  }

  interface PlaybookTurn {
    emissions: PlaybookElement[]
    state: PlaybookState
    trace: PlaybookTrace[]
  }

}

export { }
