import { createClient } from '@supabase/supabase-js'
import type { Database } from './supabase'
import { env } from '../env'

export const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)

declare global {

  type TableKeys = keyof Database["public"]["Tables"]
  type ViewKeys = keyof Database["public"]["Views"]
  type Table<T extends TableKeys> = Database["public"]["Tables"][T]["Row"]
  type View<T extends ViewKeys> = Database["public"]["Views"][T]["Row"]

}

