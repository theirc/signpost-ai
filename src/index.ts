import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import axios, { AxiosRequestConfig } from 'axios'
import { agents } from './agents'
import { supabase } from './agents/db'
import { executeCronJobs } from './cron'
import Exa from 'exa-js'
import { telerivetHook, type TelerivetHookRequest } from './integrations/telerivet'

const version = '2.0323.1128'

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
    console.error(`Error: ${error?.toString() ?? 'Unknown error'}`)
    res.status(500).send(er)
  }
})


app.post('/decors', async (req: Request, res: Response): Promise<void> => {
  try {
    let { url, headers: customHeaders, method, ...otherParams } = req.body || {}

    if (!url) {
      res.status(400).json({ error: 'URL is required in request body' })
      return
    }

    method = method || req.method || ""
    method = method.toUpperCase()


    const config: AxiosRequestConfig = {
      method,
      url: url,
      headers: {
        ...customHeaders,
        'User-Agent': 'SignPost-AI-Proxy/1.0'
      },
      timeout: 30000
    }


    if (method !== 'GET' && method !== 'HEAD') {
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

app.use('/decorsify/', async (req: Request, res: Response): Promise<void> => {
  const targetUrl = req.originalUrl.replace('/decorsify/', '')

  if (!targetUrl) {
    res.status(400).json({ error: 'URL is required' })
    return
  }

  if (req.method === 'OPTIONS') {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    })
    res.status(204).end()
    return
  }

  try {
    const config: AxiosRequestConfig = {
      method: req.method as any,
      url: targetUrl,
      headers: { ...req.headers, host: new URL(targetUrl).host },
      data: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
      params: req.query,
      timeout: 120000,
      responseType: 'stream',
      validateStatus: () => true,
    }
    delete config.headers!['content-length']

    const response = await axios(config)

    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': '*',
    })

    const fwd = ['content-type', 'content-encoding', 'transfer-encoding', 'cache-control']
    for (const h of fwd) {
      if (response.headers[h]) res.set(h, response.headers[h])
    }

    res.status(response.status)
    response.data.pipe(res)
  } catch (error: any) {
    console.error('Decorsify proxy error:', error?.message || 'Unknown error')
    res.status(502).json({ error: 'Proxy error', message: error?.message || 'Unknown error' })
  }
})



app.post('/cron', async (req, res) => {

  try {
    await executeCronJobs()
    res.send("Cron jobs executed")
  } catch (error) {
    console.error("Error executing cron jobs:", error)
    res.status(500).send("Error executing cron jobs")
  }
})

app.post('/exa', async (req, res) => {

  let { query, domain, limit, key } = (req.body || {})

  if (!query || !key) {
    res.status(400).send("Missing required parameters")
    return
  }

  try {

    const exa = new Exa(key)

    const q: any = {
      type: "auto",
      useAutoprompt: true,
      numResults: limit || 10,
      text: true,
    }

    if (domain) q.includeDomains = [domain]

    const result = await exa.searchAndContents(query, q)

    res.send(result.results || {})
    res.end()

  } catch (error) {
    console.error("Error executing exa search:", error)
    res.status(500).send("Error executing exa search")
  }
})


app.post('/integrations/:provider/:agent', async (req, res) => {
  const { provider, agent } = req.params
  const body: TelerivetHookRequest = req.body
  res.end()

  if (!provider || !agent || !body) return

  body.integration = {}
  body.integration.useDebug = !!req.query.debug
  body.integration.route_id = req.query.route_id as string || null

  try {
    if (provider === "telerivet") {
      await telerivetHook(body, Number(agent))
    }
  } catch (error) {
    console.error(`Error Executing Telerivet Integration ${error}`)
  }

})


app.listen(3000, () => {
  console.log(`Server version ${version} running on port ${3000}`)
})


