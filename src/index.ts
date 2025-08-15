import 'dotenv/config'
import express, { Request } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { agents } from './agents'
import { supabase } from './agents/db'

const version = '1.0813.1542'

const app = express()
app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(morgan("tiny"))

app.get('/', (req, res) => {
  res.type("text").send(`Version ${version}`)
})

app.post('/agent', async (req: Request<any, any, AgentParameters & { id: number, team_id?: string }>, res) => {

  let input = req.body

  try {

    if (!input.team_id) {
      res.status(400).send("team_id is required")
      return
    }

    const team = await supabase.from("teams").select("*").eq("id", input.team_id).single()
    if (!team.data || team.error) {
      res.status(400).send("team_id is not valid")
      return
    }

    const a = await agents.loadAgent(input.id)

    let apiKeys = {}
    if (input.team_id) {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .eq("team_id", input.team_id)

      if (error) {
        console.error('Error fetching api keys:', error)
      } else {
        apiKeys = data?.reduce<Record<string, string>>((acc, key) => {
          if (key.type && key.key) {
            acc[key.type] = key.key
          }
          return acc
        }, {}) || {}
      }
    }

    const p: AgentParameters = {
      input,
      apiKeys,
      uid: input.uid,
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

