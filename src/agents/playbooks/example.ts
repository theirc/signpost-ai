/**
 * Smoke playbook: fully deterministic wizard, zero model calls.
 * Exercises exact options, a validated slot, goto, call/return with the stack, requires/else and no-match.
 */
export const examplePlaybook: Playbook = {
  id: "pb_demo",
  version: 1,
  entry: "main",

  globals: [
    { match: ["exit", "quit", "menu"], then: "goto:main.welcome" },
    // Annotate without moving: the guard writes a var and the turn ends there
    { match: ["voice", "speak", "audio"], set: { _voice: true }, then: "stay:silent" },
  ],

  defaults: {
    on_no_match: { policy: "reask", max: 2, then: "goto:main.help" },
  },

  flows: {

    main: [
      {
        id: "welcome",
        intent: "Introduces the playbook and asks for acceptance",
        say: [
          { kind: "text", content: "Welcome to the Playbooks demo. Shall we start?" },
          { kind: "quick_replies", from: "options" },
        ],
        interpret: "exact",
        options: [
          { id: "accept", label: "Start", match: ["yes", "ok", "sure", "start"], then: "next" },
          {
            id: "cancel", label: "Not now", match: ["no"],
            say: [{ kind: "text", content: "No problem, we stop here." }],
            then: "goto:main.welcome",
          },
        ],
      },
      {
        id: "ask_name",
        intent: "Captures the name with a length validator",
        say: [{ kind: "text", content: "What is your name?" }],
        slot: { name: "name", validate: "text:2..60" },
        then: "next",
      },
      {
        id: "confirm",
        intent: "Confirms the captured name, exercises interpolation",
        say: [
          { kind: "text", content: "Is {name} correct?" },
          { kind: "quick_replies", from: "options" },
        ],
        interpret: "exact",
        options: [
          { id: "yes", label: "Yes", match: ["ok", "correct", "right"], then: "next" },
          { id: "no", label: "Fix it", match: ["wrong"], then: "goto:main.ask_name" },
        ],
      },
      {
        id: "pick",
        intent: "Course selection. Accepts the number or the name",
        say: [
          { kind: "text", content: "Pick a course, {name}: 1 history, 2 mathematics, 3 languages." },
          { kind: "quick_replies", from: "options" },
        ],
        interpret: "exact",
        options: [
          { id: "1", label: "History", match: ["history"], set: { course: "history" }, then: "call:deliver" },
          // "matemática" is here on purpose: the match is accent and case insensitive
          { id: "2", label: "Mathematics", match: ["mathematics", "math", "matemática"], set: { course: "math" }, then: "call:deliver" },
          { id: "3", label: "Languages", match: ["languages"], set: { course: "languages" }, then: "call:deliver" },
        ],
      },
      {
        id: "help",
        intent: "Destination of the no-match policy once the attempts run out",
        say: [
          { kind: "text", content: "Let me help: answer with one of the options, or type \"exit\" to start over." },
          { kind: "quick_replies", from: "options" },
        ],
        interpret: "exact",
        options: [
          { id: "restart", label: "Start over", match: ["*"], then: "goto:main.welcome" },
        ],
      },
    ],

    // Reusable flow: it does not know who called it, it goes back with return
    deliver: [
      {
        id: "gate_history",
        intent: "Chain of routing gates: they do not emit, they only decide on the course var",
        requires: "course == history",
        then: "goto:deliver.history",
        else: "next",
      },
      {
        id: "gate_math",
        requires: "course == math",
        then: "goto:deliver.math",
        else: "next",
      },
      {
        id: "gate_languages",
        requires: "course == languages",
        then: "goto:deliver.languages",
        else: "goto:deliver.unknown",
      },
      {
        id: "history",
        say: [
          { kind: "text", content: "History: we start with the French Revolution." },
          { kind: "quick_replies", from: "options" },
        ],
        interpret: "exact",
        options: [{ id: "back", label: "Change course", match: ["*"], then: "return" }],
      },
      {
        id: "math",
        say: [
          { kind: "text", content: "Mathematics: we start with fractions." },
          { kind: "quick_replies", from: "options" },
        ],
        interpret: "exact",
        options: [{ id: "back", label: "Change course", match: ["*"], then: "return" }],
      },
      {
        id: "languages",
        say: [
          { kind: "text", content: "Languages: we start with pronunciation." },
          { kind: "quick_replies", from: "options" },
        ],
        interpret: "exact",
        options: [{ id: "back", label: "Change course", match: ["*"], then: "return" }],
      },
      {
        id: "unknown",
        intent: "No gate claimed the course. Unreachable with the current wizard",
        say: [{ kind: "text", content: "I do not have that course loaded." }],
        interpret: "exact",
        options: [{ id: "back", label: "Back", match: ["*"], then: "return" }],
      },
    ],

  },
}
