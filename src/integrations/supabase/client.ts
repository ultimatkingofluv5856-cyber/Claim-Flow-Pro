import { createClient } from "@supabase/supabase-js"

const FALLBACK_SUPABASE_URL = 'https://jluzssnjbwykkhomxomy.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsdXpzc25qYnd5a2tob214b215Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDc5NTgsImV4cCI6MjA4ODkyMzk1OH0.WSRutLRhrqEEr3FGFVJOw73kBEFvUJbuv0fkfYcBo9U'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY

console.log("Supabase URL:", supabaseUrl)
console.log("Anon key loaded:", !!supabaseAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase configuration is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
)
