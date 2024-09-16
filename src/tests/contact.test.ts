import 'dotenv/config'
import { expect, test } from '@jest/globals'
import { executeAgent } from '../agents'
import { router } from './worker.router'
import { contactResponse } from './worker.contacts'

test('Weaviate', async () => {

  const testSchema: Agent = {
    title: "Test Schema",
    input: "I need contact information",
    workers: [
      router,
      contactResponse,
    ],
  }

  const r = await executeAgent(testSchema)

  expect(r.output).toBe(`
  This is the contact information:
  email@domain.com
  `)

})


