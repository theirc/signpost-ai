import 'dotenv/config'
import { expect, test } from '@jest/globals'
import { executeAgent } from '../agents'
import { router } from './worker.router'
import { searchWeaviateTanzania } from './worker.waviate'

test('Weaviate', async () => {

  const testSchema: Agent = {
    input: "what is malaria?",
    workers: [
      router,
      searchWeaviateTanzania,
    ],
  }

  const r = await executeAgent(testSchema)

  expect(r.documents.length).toBeGreaterThan(0)

})


