import 'dotenv/config'
import { expect, test } from '@jest/globals'
import { executeAgent } from '../agents'
import { searchExaGreece } from './worker.exa'

test('Exa Search', async () => {

  const testSchema: Agent = {
    input: "where can i find english classes in athens?",
    workers: [
      searchExaGreece,
    ],
  }

  const r = await executeAgent(testSchema)

  expect(r.documents.length).toBeGreaterThan(0)

}, 30000)


