
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  const missingVariables = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabaseKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
  ].filter(Boolean)

  throw new Error(
    `Missing Supabase environment variable(s): ${missingVariables.join(', ')}. Add them to your .env.local file and restart the Vite server.`,
  )
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)
