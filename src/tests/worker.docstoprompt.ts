

export const convertDocsToPrompt: AgentWorker = {
  type: "content",
  output: "prompt",
  template: `
Use the following context for the conversation:
<context>
{documents}
</context>`

}