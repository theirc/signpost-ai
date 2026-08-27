/**
 * Smoke playbook: a Signpost style referral desk, fully deterministic, zero model calls.
 * Exercises consent as a skip guard, closed options, a captured slot, two levels of call/return,
 * chained requires gates and the no-match policy.
 */
export const examplePlaybook: Playbook = {
  id: "pb_referral",
  version: 1,

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
      id: "consent",
      // The condition reads a var the contact never picked in this conversation: on a returning contact
      // the session already carries consent, so the whole item is skipped without emitting anything
      intent: "Data protection consent. Skipped entirely for a contact that already accepted",
      condition: ["consent", "!=", true],
      say: "Hello, this is the Signpost desk. May we store your answers to refer you to a service?",
      options: [
        { id: "accept", label: "Yes", match: ["ok", "sure", "i agree"], set: { consent: true } },
        // end closes the session: if the contact writes again we ask for consent from scratch
        { id: "decline", label: "No", match: ["nope"], say: "Understood, we cannot continue without it. Take care.", then: "end" },
      ],
    },
    {
      id: "ask_country",
      // Guarding a capture with the var it writes is what makes a restart graceful: the recovery walks
      // main from the top and this item skips itself instead of asking again for something already known
      intent: "Location. The last option is a catch-all, so this item can never fall into no-match",
      condition: ["country", "isEmpty"],
      say: "Where are you right now?",
      options: [
        { id: "greece", label: "🇬🇷 Greece", match: ["grecia"], set: { country: "Greece" } },
        { id: "italy", label: "🇮🇹 Italy", match: ["italia"], set: { country: "Italy" } },
        { id: "other", label: "Somewhere else", match: ["*"], set: { country: "other" } },
      ],
    },
    {
      id: "menu",
      intent: "Hub of the conversation. The satellites return here, and re-entering re-emits the menu",
      say: "What do you need help with in {country}?",
      options: [
        { id: "1", label: "⚖️ Legal aid", match: ["lawyer", "papers"], set: { need: "legal" }, then: "call:referral" },
        { id: "2", label: "🏥 Medical care", match: ["doctor", "health"], set: { need: "medical" }, then: "call:referral" },
        { id: "3", label: "That is all", match: ["nothing", "bye"], then: "goto:main.farewell" },
      ],
    },
    {
      id: "help",
      intent: "Destination of the no-match policy once the attempts run out",
      say: "Let me put you back on track.",
      options: [{ id: "back", label: "Back to the menu", match: ["*"], then: "goto:main.menu" }],
    },
    {
      // End of the flow: it says goodbye and stays. Only a global can move the cursor from here
      id: "farewell",
      say: "Thanks for reaching out. Write \"menu\" any time to start again.",
    },
  ],

  flows: {

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
          { id: "callback", label: "Ask for a callback", match: ["call me"], then: "call:contact" },
          { id: "back", label: "Back to the menu", match: ["*"], then: "return" },
        ],
      },
      {
        id: "legal_other",
        say: "We do not have a legal partner mapped in {country} yet.",
        options: [{ id: "back", label: "Back to the menu", match: ["*"], then: "return" }],
      },
      {
        id: "medical",
        say: "Primary care is free at public health centres. Bring any document you have.",
        options: [
          { id: "callback", label: "Ask for a callback", match: ["call me"], then: "call:contact" },
          { id: "back", label: "Back to the menu", match: ["*"], then: "return" },
        ],
      },
      {
        id: "unknown",
        intent: "No gate claimed the need. Unreachable while the menu only sets legal or medical",
        say: "I do not have that service mapped.",
        options: [{ id: "back", label: "Back to the menu", match: ["*"], then: "return" }],
      },
    ],

    // Reusable satellite, called from two items of referral, one stack level deeper
    contact: [
      {
        // The clearest case for a condition: no message, no choice, nothing options could ever express.
        // A single element tuple is a truth test, so this reads as "if the phone is already stored, go back"
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
        say: "Noted, we will call you at {phone}.",
        options: [{ id: "ok", label: "Thanks", match: ["*"], then: "return" }],
      },
    ],

  },
}
