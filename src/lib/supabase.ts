import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Missing Supabase configuration. Add VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_PUBLISHABLE_KEY to your .env file (see .env.example), ' +
        'then restart the dev server.'
    )
}

// Typed against the generated schema, so table names, columns and function
// arguments are checked by TypeScript.
export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
