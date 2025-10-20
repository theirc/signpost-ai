import { agents } from "./agents"
import { supabase } from "./agents/db"
import { Database } from "./agents/supabase"

type Job = Database["public"]["Tables"]["jobs"]["Row"]

export async function executeCronJobs() {

  const { data, error } = await supabase.from("jobs").select("*")
  if (error || !data) {
    console.error("Error fetching cron jobs:", error)
    throw error
  }

  if (data.length === 0) {
    console.log("No cron jobs to execute")
    return
  }

  const now = new Date()

  const hour = now.getHours()

  for (const job of data) {

    const range = job.range || 0
    if (hour != range) continue

    if (job.type === 0) {

      //Hourly
      await executeJob(job)

    } else if (job.type === 1) {

      //Daily
      const day = now.getDay()
      if (day === 0 && job.sun) {
        await executeJob(job)
      } else if (day === 1 && job.mon) {
        await executeJob(job)
      } else if (day === 2 && job.tue) {
        await executeJob(job)
      } else if (day === 3 && job.wed) {
        await executeJob(job)
      } else if (day === 4 && job.thu) {
        await executeJob(job)
      } else if (day === 5 && job.fri) {
        await executeJob(job)
      } else if (day === 6 && job.sat) {
        await executeJob(job)
      }

    } else if (job.type === 2) {

      //Monthly
      const date = now.getDate()
      if (date === job.day) {
        await executeJob(job)
      }
    }

  }

}

async function executeJob(job: Job) {
  const a = await agents.loadAgent(job.agent, job.team)

  let apiKeys = {}
  if (job.team) {
    const { data, error } = await supabase.from("api_keys").select("*").eq("team_id", job.team)
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
    input: job.parameters,
    apiKeys,
  }

  await a.execute(p)


}

