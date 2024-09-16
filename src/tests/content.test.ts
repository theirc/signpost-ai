import 'dotenv/config'
import { expect, test } from '@jest/globals'
import { executeAgent } from '../agents'

test('Content', async () => {
  const testContent: Agent = {
    workers: [
      {
        type: "content",
        output: "output",
        template: "Test output content"
      }
    ],
    input: "test"
  }
  const r = await executeAgent(testContent)

  expect(r.output).toBe("Test output content")

})


