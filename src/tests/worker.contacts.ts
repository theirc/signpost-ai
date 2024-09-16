
export const contactResponse: AgentWorker = {
  type: "content",
  input: "isContact",
  output: "output",
  end: true,
  condition: {
    left: "isContact",
    operator: "=",
    right: "true"
  },
  template: `
  This is the contact information:
  email@domain.com
  `
}
