/**
 * Smoke playbook: a Signpost style referral desk. Every item is deterministic except the qa flow.
 * Exercises consent as an interrupt, closed options, a captured slot, two levels of call/return,
 * chained condition gates, the no-match policy and an ai item with a declared escape.
 */
export const examplePlaybook: Playbook = {
  id: "pb_referral",
  version: 1,

  config: { model: "claude-haiku-4-5-20251001" },

  // Checked before the globals and before the item, so a contact who has not consented cannot navigate
  // anywhere until they answer. Adding a terms of service to a playbook already in production is this one line
  interrupts: [
    { condition: ["consent", "!=", true], then: "call:consent" },
  ],

  // Opt-out is deliberately not here: unsubscribing is a mark on the contact, not on one conversation,
  // so it belongs to the platform ring alongside format translation
  globals: [
    { match: ["menu", "start over"], then: "goto:main.menu" },
  ],

  defaults: {
    on_no_match: { policy: "reask", max: 2, then: "goto:main.help" },
  },

  main: [
    {
      id: "ask_country",
      // Nothing guards it. Reaching an item that emits is the delivery, and no var cancels that:
      // how far the conversation already got is the business of the cursor, not of something stored
      intent: "Location. The last option is a catch-all, so this item can never fall into no-match",
      say: "Where are you right now?",
      options: [
        { label: "🇬🇷 Greece", match: ["grecia"], set: { country: "Greece" } },
        { label: "🇮🇹 Italy", match: ["italia"], set: { country: "Italy" } },
        { label: "Somewhere else", match: ["*"], set: { country: "other" } },
      ],
    },
    {
      id: "menu",
      intent: "Hub of the conversation. The satellites return here, and re-entering re-emits the menu",
      say: "What do you need help with in {{country}}?",
      // The only item that declares its ids: these are what a referral report counts, so they cannot
      // move when the copy is reworded or translated. Everywhere else the label is identity enough
      options: [
        { id: "legal", label: "⚖️ Legal aid", match: ["1", "lawyer", "papers"], set: { need: "legal" }, then: "call:referral" },
        { id: "medical", label: "🏥 Medical care", match: ["2", "doctor", "health"], set: { need: "medical" }, then: "call:referral" },
        { id: "ask", label: "💬 Ask a question", match: ["3", "question"], then: "call:qa" },
        { id: "done", label: "That is all", match: ["4", "nothing", "bye"], then: "goto:main.farewell" },
      ],
    },
    {
      id: "help",
      intent: "Destination of the no-match policy once the attempts run out",
      say: "Let me put you back on track.",
      options: [{ label: "Back to the menu", match: ["*"], then: "goto:main.menu" }],
    },
    {
      // End of the flow: it says goodbye and stays. Only a global can move the cursor from here
      id: "farewell",
      // The {{#if}} is not logic: this is one text with an optional piece of data inside it.
      // Routing still lives entirely in condition and options
      say: "Thanks for reaching out{{#if phone}}, we will call you at {{phone}}{{/if}}. Write \"menu\" any time to start again.",
    },
  ],

  flows: {

    // Not an item of main: an interrupt, so it runs once for a contact who has not accepted and hands
    // the conversation back on the exact item it took it from. Modelling it as main[0] with a condition
    // over its own var was the workaround for not having this
    consent: [
      {
        id: "ask",
        intent: "Data protection consent. Runs before anything else and returns wherever the contact was",
        say: "Hello, this is the Signpost desk. May we store your answers to refer you to a service?",
        options: [
          // The one place where a var legitimately records that something ran: an interrupt lives outside
          // the path of the cursor, so nothing else remembers it. This set is what falsifies its condition
          { label: "Yes", match: ["ok", "sure", "i agree"], set: { consent: true }, then: "return" },
          // end wipes the vars and closes the session, which is the only decent answer to someone who
          // just said we cannot store anything. If they write again we ask from scratch
          { label: "No", match: ["nope"], say: "Understood, we cannot continue without it. Take care.", then: "end" },
        ],
      },
    ],

    // Called from two different options and it does not know which one. The var is the only input it has
    referral: [
      {
        id: "gate_legal",
        intent: "First level: which need. Chained because a condition holds a single comparison",
        condition: ["need", "==", "legal"],
        then: "goto:referral.legal",
      },
      {
        id: "gate_medical",
        condition: ["need", "==", "medical"],
        then: "goto:referral.medical",
        else: "goto:referral.unknown",
      },
      {
        // Second level: this is the case options cannot express. The answer depends on need AND country,
        // captured several turns apart. The option that was tapped only knew about need
        id: "legal",
        intent: "Splits the legal referral by country. Compares against Greece with normalization",
        condition: ["country", "==", "greece"],
        then: "goto:referral.legal_greece",
        else: "goto:referral.legal_other",
      },
      {
        id: "legal_greece",
        say: "In Greece, GCR offers free legal counselling in Athens and Thessaloniki.",
        options: [
          { label: "Ask for a callback", match: ["call me"], then: "call:contact" },
          { label: "Back to the menu", match: ["*"], then: "return" },
        ],
      },
      {
        id: "legal_other",
        say: "We do not have a legal partner mapped in {{country}} yet.",
        options: [{ label: "Back to the menu", match: ["*"], then: "return" }],
      },
      {
        id: "medical",
        say: "Primary care is free at public health centres. Bring any document you have.",
        options: [
          { label: "Ask for a callback", match: ["call me"], then: "call:contact" },
          { label: "Back to the menu", match: ["*"], then: "return" },
        ],
      },
      {
        id: "unknown",
        intent: "No gate claimed the need. Unreachable while the menu only sets legal or medical",
        say: "I do not have that service mapped.",
        options: [{ label: "Back to the menu", match: ["*"], then: "return" }],
      },
    ],

    // The only flow that is not deterministic
    qa: [
      {
        id: "open",
        type: "ai",
        intent: "Open questions. The escapes are declared as options, so leaving never depends on the model",
        // Both texts are authored and both interpolate. say is emitted once, on entry;
        // prompt is never emitted, it goes to the adapter on every message that lands here
        say: "Go ahead, ask me anything about services in {{country}}.",
        prompt: "You are the Signpost desk in {{country}}. Answer briefly and only about available services. Say so when you do not know.",
        // No catch-all here on purpose: a "*" would swallow every question before the model sees it
        options: [
          { label: "Back to the menu", match: ["done", "thanks", "that is all"], then: "return" },
        ],
      },
    ],

    // Reusable satellite, called from two items of referral, one stack level deeper
    contact: [
      {
        // The clearest case for a condition, and the shape of a legitimate one: it reads a var another
        // item writes, so it asks about data and not about whether this flow already ran. No message,
        // no choice, nothing options could express. A single element tuple is a truth test
        id: "check",
        intent: "Never ask twice for the same data",
        condition: ["phone"],
        then: "return",
      },
      {
        id: "ask_phone",
        say: "What number should we call?",
        slot: "phone",
      },
      {
        // Says and waits like any other item. The return happens on the next message, not on entry
        id: "confirm",
        say: "Noted, we will call you at {{phone}}.",
        options: [{ label: "Thanks", match: ["*"], then: "return" }],
      },
    ],

  },
}
