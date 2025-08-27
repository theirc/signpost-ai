import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import axios, { AxiosRequestConfig } from 'axios'
import { agents } from './agents'
import { supabase } from './agents/db'

const version = '1.0827.1647'

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

    const a = await agents.loadAgent(input.id, team.data.id)

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



app.all('/decors', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, headers: customHeaders, ...otherParams } = req.body || {}

    if (!url) {
      res.status(400).json({ error: 'URL is required in request body' })
      return
    }

    const config: AxiosRequestConfig = {
      method: req.method.toLowerCase() as any,
      url: url,
      headers: {
        ...customHeaders,
        'User-Agent': 'SignPost-AI-Proxy/1.0'
      },
      timeout: 30000
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (otherParams && Object.keys(otherParams).length > 0) {
        config.data = otherParams
      } else if (req.body && typeof req.body === 'object' && !req.body.url) {
        config.data = req.body
      }
    }

    if (req.query && Object.keys(req.query).length > 0) {
      config.params = req.query
    }

    const response = await axios(config)

    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Content-Type': response.headers['content-type'] || 'application/json'
    })

    res.status(response.status).json(response.data)

  } catch (error: any) {
    console.error('Proxy error:', error?.message || 'Unknown error')

    if (error?.response) {
      res.status(error.response.status).json({
        error: 'Proxy request failed',
        status: error.response.status,
        message: error.response.data || error.message
      })
    } else if (error?.request) {
      res.status(503).json({
        error: 'Service unavailable',
        message: 'Unable to reach the target server'
      })
    } else {
      res.status(500).json({
        error: 'Internal proxy error',
        message: error?.message || 'Unknown error'
      })
    }
  }
})



app.listen(3000, () => {
  console.log(`Server version ${version} running on port ${3000}`)
})
