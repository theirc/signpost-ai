import Handlebars from "handlebars"

declare global {
  interface TemplateWorker extends AIWorker {
    fields: {
      output: NodeIO
      template: NodeIO
    }
  }
}

function create(agent: Agent) {
  return agent.initializeWorker(
    {
      type: "template",
      conditionable: true,
    },
    [
      { type: "string", direction: "input", title: "Template", name: "template" },
      { type: "string", direction: "output", title: "Output", name: "output" },
    ],
    template
  )
}

async function execute(worker: TemplateWorker, p: AgentParameters) {

  const userFields = worker.getUserHandlers()
  const values = {}
  const templateText = worker.fields.template.value
  if (!templateText) return

  for (const h of userFields) {
    if (!h.value) continue
    values[h.name] = h.value
  }

  // Register Handlebars helpers
  Handlebars.registerHelper('includes', function (str, search) {
    if (typeof str !== 'string') return false
    return str.includes(search)
  })

  const template = Handlebars.compile(templateText)
  const result = template(values)

  worker.fields.output.value = result



}

export const template: WorkerRegistryItem = {
  title: "Template",
  category: "tool",
  type: "template",
  description: "This worker creates templated text using dynamic input fields.",
  execute,
  create,
  get registry() { return template },
}
