import 'dotenv/config'
import { expect, test } from '@jest/globals'
import { executeAgent } from '../agents'
import { searchExaGreece } from './worker.exa'
import { convertDocsToPrompt } from './worker.docstoprompt'

test('Documents To Prompts', async () => {

  const testSchema: Agent = {
    title: "Test Doc To Prompts",
    input: "where can i find english classes in athens?",
    workers: [
      searchExaGreece,
      convertDocsToPrompt,
    ],
  }

  const r = await executeAgent(testSchema)

  expect(r.prompt.length).toBeGreaterThan(1000)

}, 30000)


