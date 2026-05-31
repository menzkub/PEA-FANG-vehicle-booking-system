import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = !!(supabaseUrl && supabaseAnonKey)

// Use placeholder to prevent crash when env vars not set
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder'
)

// Register listener at module level — BEFORE React mounts — so we catch
// PASSWORD_RECOVERY even when getSession() awaits _initialize() internally.
// Works for both implicit flow (hash tokens) and PKCE flow (code exchange).
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    sessionStorage.setItem('pea-recovery', '1')
  }
})
