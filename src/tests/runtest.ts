import { executeAgent } from "../agents"
import { contactResponse } from "./worker.contacts"
import { convertDocsToPrompt } from "./worker.docstoprompt"
import { searchExaGreece } from "./worker.exa"
import { router } from "./worker.router"
import { searchWeaviateTanzania } from "./worker.waviate"

export async function test() {

}

async function testDocToPrompts() {

  const testSchema: Agent = {
    title: "Test Doc To Prompts",
    input: "where can i find english classes in athens?",
    workers: [
      searchExaGreece,
      convertDocsToPrompt,
    ],
  }

  await executeAgent(testSchema)

  return testSchema

}

async function testExaSearch() {

  const testSchema: Agent = {
    title: "Test Exa",
    input: "where can i find english classes in athens?",
    workers: [
      router,
      searchExaGreece,
    ],
  }

  await executeAgent(testSchema)

  return testSchema

}

async function testWeaviteSearch() {

  //"where can i find english classes in athens?"

  const testSchema: Agent = {
    title: "Test Weaviate",
    input: "what is malaria?",
    workers: [
      router,
      searchWeaviateTanzania,
    ],
  }

  await executeAgent(testSchema)

  return testSchema

}


async function testContactInformation() {

  const testSchema: Agent = {
    title: "Test Schema",
    input: "I need contact information",
    workers: [
      router,
      contactResponse,
    ],
  }

  await executeAgent(testSchema)

  return testSchema

}


async function testContent() {
  const testContent: Agent = {
    title: "Test Content",
    workers: [
      {
        type: "schema",
        output: "output",
        template: "Test output content"
      }
    ],
    input: "test"
  }
  await executeAgent(testContent)

  return testContent
}


