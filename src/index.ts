import 'dotenv/config'
import "./types"
import express, { Request } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { executeAgent } from './agents'

const version = '1.0917.1552'

const app = express()
app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(morgan("tiny"))

app.get('/', (req, res) => {
  res.type("text").send(`Version ${version}`)
})

app.post('/agent', async (req: Request<any, any, Agent>, res) => {
  let answer = req.body
  try {
    const response = await executeAgent(answer)
    res.send(response)
  } catch (error) {
    const er = `Error: ${error?.toString() ?? 'Unknown error'}`
    console.log(`Error: ${error?.toString() ?? 'Unknown error'}`)
    res.status(500).send(er)
  }
})

app.listen(3000, () => {
  console.log(`Server version ${version} running on port ${3000}`)
})

