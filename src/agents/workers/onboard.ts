import Handlebars from "handlebars"

declare global {
  interface OnboardOption {
    label: string
    answer: string
    action?: "continue" | "reset" | "goto"
    goto?: string
  }

  interface OnboardItem {
    id?: string
    name?: string
    title?: string //used for summary
    question?: string
    summarize?: boolean
    options?: OnboardOption[]
  }

  interface OnboardWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
      summary: NodeIO
      finished: NodeIO
    }
    parameters: {
      name?: string
      locale?: string //default locale
      items?: OnboardItem[]
      invalidOptionAnswer?: string
    }
  }
}

interface State {
  asking?: string
  questions: { [question: string]: string }
}


function create(agent: Agent) {
  return agent.initializeWorker(
    {
      type: "onboard",
      parameters: {
        locale: "en-US",
        items: [],
        invalidOptionAnswer: "Please answer using a valid option.",
      },
      conditionable: true,
    },
    [
      { type: "string", direction: "input", title: "Input", name: "input" },
      { type: "string", direction: "output", title: "Output", name: "output" },
      { type: "string", direction: "output", title: "Summary", name: "summary" },
      { type: "boolean", direction: "output", title: "Finished", name: "finished" },
    ],
    onboard
  )
}



function getNext(items: OnboardItem[], state: State): OnboardItem {
  for (let s of items) {
    if (!s.name) continue
    if (state.questions[s.name] != null) continue
    return s
  }
}

async function execute(worker: OnboardWorker, p: AgentParameters) {

  // worker.state = {}
  // return

  const { parameters } = worker

  const state: State = worker.state as any
  state.questions ||= {}

  const handlers = worker.getUserHandlers()
  let input: string = worker.fields.input.value || ""
  worker.fields.output.value = ""
  input = input.trim().toLowerCase()

  if (!input) return

  console.log("State:", state)

  worker.fields.finished.value = false

  let next: OnboardItem = null
  let asking: OnboardItem = parameters.items.find(i => i.name == state.asking)
  let invalidOptionAnswerPrefix = ""

  if (asking && state.questions[asking.name] != null) {
    //The question was already answered and this goes out of sync. Reset and continue with next.
    asking = null
    delete state.asking
  }

  if (asking) {

    if (asking.options && asking.options.length) {

      let optionFound: OnboardOption = null

      for (let o of asking.options) {
        const optlabel = (o.label || "").toLowerCase().replace("[", "").replace("]", "").trim()
        if (optlabel == input) {
          optionFound = o
          break
        }
      }
      if (optionFound) {

        if (optionFound.action == "continue") {
          state.questions[asking.name] = input
          next = getNext(parameters.items, state)
        } else if (optionFound.action == "reset") {
          state.questions = {}
          delete state.asking
          worker.fields.output.value = optionFound.answer || ""
        } else if (optionFound.action == "goto") {
          next = parameters.items.find(i => i.name == optionFound.goto)
        }
      } else {
        invalidOptionAnswerPrefix = (parameters.invalidOptionAnswer || "Please answer using a valid option.") + "\n\n"
        next = getNext(parameters.items, state)
      }
    } else {
      state.questions[asking.name] = input
      next = getNext(parameters.items, state)
    }

  } else {
    next = getNext(parameters.items, state)
  }

  if (next) {
    next.question ||= ""
    const options = (next.options || []).map(o => o.label).join(" ")
    let answer = next.question + "\n\n" + options
    if (invalidOptionAnswerPrefix) {
      answer = invalidOptionAnswerPrefix + "\n\n" + answer
    }

    const template = Handlebars.compile(answer)
    const result = template(state.questions || {})

    worker.fields.output.value = result
    state.asking = next.name
  }
  else {
    if (!worker.fields.output.value) {
      worker.fields.output.value = worker.fields.input.value
      worker.fields.finished.value = true
    }
  }

  let summary = ""

  for (let i of parameters.items) {
    if (!state.questions[i.name]) continue
    worker.fields[i.name] = state.questions[i.name]
    if (!i.summarize) continue
    summary += (i.title || i.name || "Item") + ": " + (state.questions[i.name] || "") + "\n"
  }

  worker.fields.summary.value = summary


}

export const onboard: WorkerRegistryItem = {
  title: "Onboard",
  category: "tool",
  type: "onboard",
  description: "This worker extracts onboarding information from input text and structures it into defined fields.",
  execute,
  create,
  get registry() { return onboard },
}
