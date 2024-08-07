import 'dotenv/config'
import "./types"
import { Bot } from "./bot"
import { db } from "./db"
import express, { Request } from 'express'
import cors from 'cors'
import morgan from 'morgan'

const version = '1.0805.1315'

const app = express()
app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(morgan("tiny"))


app.get('/', (req, res) => {
  res.type("text").send(`Version ${version}`)
})

app.post('/ai', async (req: Request<any, any, BotRequest>, res) => {
  try {
    const isBackground = (req.body.background || req.body.zendeskid)
    if (isBackground) res.end()
    const bot = await Bot.fromId(req.body.id)
    const answer = await bot.execute(req.body)
    if (!isBackground) res.send(answer)
  } catch (error) {
    const er = `Error: ${error?.toString() ?? 'Unknown error'}`
    console.log(`Error: ${error?.toString() ?? 'Unknown error'}`)
    const answer: Answer = {
      message: er,
      error: er,
    }
    res.send(answer)
  }
})

app.get('/bots/', async (req, res) => {
  try {
    res.send(await db.getBots())
  } catch (error) {
    console.log(`Error: ${error?.toString() ?? 'Unknown error'}`)
    res.status(500).send(error?.toString() ?? 'Unknown error')
    debugger
  }
})


app.listen(3000, () => {
  console.log(`Server version ${version} running on port ${3000}`)
})

