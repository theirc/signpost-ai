/**
 * Smoke playbook: a Signpost style referral desk. main runs the intake and moves into the flow of the
 * country the contact is in, because what you can tell someone depends on where they are. Exercises the
 * capture and confirm loop, conditions that keep a restart from asking twice for what it already knows,
 * a menu that jumps around inside its own flow, a condition filtering an item out, an option that is only
 * on offer sometimes, and an ai item.
 *
 * There is no call and no return. The callback question is written once per country flow, which is less
 * to read than a stack, and every item leaves the same way anything else does: through an option.
 */

export const examplePlaybook: Playbook = {
  id: "pb_referral",
  version: 1,

  // on_lost is where a conversation goes when the item it was parked on no longer exists. Here it is the
  // country question rather than the top: it re-enters the country flow, which is where everything is
  config: { model: "claude-haiku-4-5-20251001", on_lost: { flow: "main", item: "ask_country" } },

  // No escalation and nothing counted: with no catch-all anywhere, anything that is not one of the options
  // puts this in front of the question and asks again
  defaults: {
    on_no_match: { say: "Please pick one of the options." },
  },

  main: [
    {
      // The three items of the intake carry the same kind of condition: a var that remembers the answer, so
      // a reset walks past them instead of asking a second time. It is also what lets the platform ring seed
      // a known contact and have the desk skip straight to the question it does not have yet
      id: "consent",
      condition: ["consent", "!=", true],
      say: "Hello, this is the Signpost desk. May we store your answers to refer you to a service?",
      options: [
        { label: "Yes", match: ["ok", "sure", "i agree"], set: { consent: true } },
        // Nothing here writes consent, so the reset comes straight back to this same question. That is what
        // "we cannot continue without it" means when there is nowhere else to be
        { label: "No", match: ["nope"], say: "We cannot continue without it.", action: { type: "reset" } },
      ],
    },
    {
      // An item only captures if it names a var. Free text, so no options: whatever the contact writes
      // lands in vars.name and the conversation moves on
      id: "ask_name",
      condition: ["name", "isEmpty"],
      say: "What is your name?",
      set: "name",
    },
    {
      // The confirmation loop, which is what a capture is normally worth: No forgets the name and sends the
      // cursor back up, which re-opens the item above because its condition reads the var that was just
      // cleared. Going backwards is a jump, so it lives on an option
      id: "confirm_name",
      condition: ["name_confirmed", "isEmpty"],
      say: "Thanks, {{name}}. Did I get that right?",
      options: [
        { label: "Yes", match: ["correct", "right"], set: { name_confirmed: true } },
        { label: "No", match: ["wrong", "nope"], say: "Let me take that again.", set: { name: null }, action: { type: "goto", flow: "main", item: "ask_name" } },
      ],
    },
    {
      // Last item of main and deliberately ungated: someone who starts over is usually somewhere else, or
      // asking on behalf of someone who is. Its options are what picks the desk that answers
      id: "ask_country",
      say: "Where are you right now?",
      options: [
        { label: "🇬🇷 Greece", match: ["grecia"], set: { country: "Greece" }, action: { type: "goto", flow: "greece", item: "menu" } },
        { label: "🇮🇹 Italy", match: ["italia"], set: { country: "Italy" }, action: { type: "goto", flow: "italy", item: "menu" } },
      ],
    },
  ],

  flows: {

    greece: [
      {
        id: "menu",
        intent: "The menu lives inside the country flow and jumps around it. Nothing returns to main on its own",
        say: "What do you need help with in {{country}}, {{name}}?",
        // The only item that declares its ids: these are what a referral report counts, so they cannot move when the copy is reworded or translated. Everywhere else the label is identity enough
        options: [
          { id: "legal", label: "⚖️ Legal aid", match: ["1", "lawyer", "papers"], action: { type: "goto", flow: "greece", item: "legal" } },
          { id: "medical", label: "🏥 Medical care", match: ["2", "doctor", "health"], action: { type: "goto", flow: "greece", item: "medical" } },
          { id: "ask", label: "💬 Ask a question", match: ["3", "question"], action: { type: "goto", flow: "greece", item: "qa" } },
          { id: "done", label: "That is all", match: ["4", "nothing"], action: { type: "goto", flow: "greece", item: "wrap" } },
        ],
      },
      {
        id: "legal",
        say: "In Greece, GCR offers free legal counselling in Athens and Thessaloniki.",
        options: [{ label: "Back to the menu", match: ["menu", "back"], action: { type: "goto", flow: "greece", item: "menu" } }],
      },
      {
        id: "medical",
        say: "Primary care is free at public health centres. Bring any document you have.",
        options: [
          // No action: whoever wants more falls through to the items below, which is what a sequence is for
          { label: "Tell me more", match: ["more"] },
          { label: "Back to the menu", match: ["menu", "back"], action: { type: "goto", flow: "greece", item: "menu" } },
        ],
      },
      {
        id: "ask_age",
        intent: "Captured once, and what comes after it is filtered by the answer",
        condition: ["age", "isEmpty"],
        say: "How old are you? Some of what I can offer depends on it.",
        set: "age",
      },
      {
        // The filter, and the whole of what a condition does: it decides whether this item runs, never
        // where the conversation goes. A minor simply does not see it and moves on to the one below
        id: "adult_clinic",
        condition: ["age", ">=", 18],
        say: "There is also a walk-in clinic for adults on Alexandras Avenue, no appointment needed.",
        options: [{ label: "Back to the menu", match: ["menu", "back"], action: { type: "goto", flow: "greece", item: "menu" } }],
      },
      {
        // The last item of a filtered run carries no condition, so the run can never fall off the end of
        // the flow. That is what the validator checks, and it is why this one is not guarded by age < 18
        id: "minor_support",
        say: "For under 18s, METAdrasi runs a guardianship and health support programme.",
        options: [{ label: "Back to the menu", match: ["menu", "back"], action: { type: "goto", flow: "greece", item: "menu" } }],
      },
      {
        id: "qa",
        type: "ai",
        intent: "Open questions. The escape is declared as an option, so leaving never depends on the model",
        // Both texts are authored and both interpolate. say is emitted once, on entry;
        // prompt is never emitted, it goes to the adapter on every message that lands here
        say: "Go ahead, ask me anything about services in {{country}}.",
        prompt: "You are the Signpost desk in {{country}}. Answer briefly and only about available services. Say so when you do not know.",
        options: [
          { label: "Back to the menu", match: ["done", "thanks", "that is all"], action: { type: "goto", flow: "greece", item: "menu" } },
        ],
      },
      {
        // Written out here and again in italy, which is the trade the removal of call bought: two short
        // questions instead of a shared flow, a stack, and a rule about where a return lands
        id: "ask_phone",
        say: "What number should we call?",
        set: "phone",
      },
      {
        // No action on its option, so it falls through to the item below
        id: "confirm_phone",
        say: "Noted, we will call you at {{phone}}.",
        options: [{ label: "Thanks", match: ["thank you", "ok"] }],
      },
      {
        id: "wrap",
        say: "Anything else before you go?",
        options: [
          // Only on offer while we do not have the number, so it disappears on the way back from
          // confirm_phone. An option with a condition that does not hold is not drawn, and typing its
          // label does not select it either
          { label: "Ask for a callback", match: ["call me"], condition: ["phone", "isEmpty"], action: { type: "goto", flow: "greece", item: "ask_phone" } },
          { label: "Back to the menu", match: ["menu", "back"], action: { type: "goto", flow: "greece", item: "menu" } },
          { label: "No, that is all", match: ["nothing else"], say: "Take care, {{name}}.", action: { type: "reset" } },
        ],
      },
    ],

    // Same services, different country, different answers. That is the whole reason the flow is the country
    italy: [
      {
        id: "menu",
        say: "What do you need help with in {{country}}, {{name}}?",
        options: [
          { id: "legal", label: "⚖️ Legal aid", match: ["1", "lawyer", "papers"], action: { type: "goto", flow: "italy", item: "legal" } },
          { id: "done", label: "That is all", match: ["nothing"], action: { type: "goto", flow: "italy", item: "wrap" } },
        ],
      },
      {
        id: "legal",
        say: "In Italy, ASGI runs a free legal helpline for asylum seekers.",
        options: [{ label: "Back to the menu", match: ["menu", "back"], action: { type: "goto", flow: "italy", item: "menu" } }],
      },
      {
        id: "ask_phone",
        say: "What number should we call?",
        set: "phone",
      },
      {
        id: "confirm_phone",
        say: "Noted, we will call you at {{phone}}.",
        options: [{ label: "Thanks", match: ["thank you", "ok"] }],
      },
      {
        id: "wrap",
        say: "Anything else before you go?",
        options: [
          { label: "Ask for a callback", match: ["call me"], condition: ["phone", "isEmpty"], action: { type: "goto", flow: "italy", item: "ask_phone" } },
          { label: "No, that is all", match: ["nothing else"], say: "Take care, {{name}}.", action: { type: "reset" } },
        ],
      },
    ],

  },
}
