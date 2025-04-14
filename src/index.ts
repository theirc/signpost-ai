import 'dotenv/config'
import express, { Request } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { agents } from './agents'

const version = '1.0413.1836'

const app = express()
app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(morgan("tiny"))

const apikeys = {
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_API_KEY,
}

app.get('/', (req, res) => {
  res.type("text").send(`Version ${version}`)
})

app.post('/agent', async (req: Request<any, any, AgentParameters & { id: number }>, res) => {
  let input = req.body
  try {
    const a = await agents.loadAgent(input.id)
    const p: AgentParameters = {
      input,
      apikeys,
    }

    await a.execute(p)

    if (p.error) {
      throw new Error(p.error)
      return
    }
    res.send(p.output || {})

  } catch (error) {
    const er = `Error: ${error?.toString() ?? 'Unknown error'}`
    console.log(`Error: ${error?.toString() ?? 'Unknown error'}`)
    res.status(500).send(er)
  }
})

app.listen(3000, () => {
  console.log(`Server version ${version} running on port ${3000}`)
})

