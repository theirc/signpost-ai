export const router: AgentWorker = {
  type: "schema",
  input: "input",
  schemas: [
    {
      prompt: "Determine if the input is primarily about communication channels (such as email, phone, messaging apps, social media, etc.) or methods of contact between individuals or groups. If the question is related to communication channels or contact, this value should be true.",
      name: "isContact",
      type: "flag",
    },
    {
      prompt: "The language used in the input. Use the text, not what it references. Use the full name of the language and not the locale code.",
      name: "language",
      type: "text",
    },
    {
      prompt: `Based on the input, create the minimal search terms that will be used to search the knowledge base.
  It's important to use your own appropiate words based on the input and don't just extract the words from the input.
  For example, if the input is "I'm tired of this life", search for "suicidal support and not "tired of life".
  Do it in the same way a person searches for information using a search engine.
  Always use the input as a guide to search information as closely as possible, and only use keywords, not phrases.
  If the user provides a location, country or city, use that in order to narrow the search results in the search.`,
      name: "searchTerms",
      type: "text",
    }

  ]
}
