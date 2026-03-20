// assets/js/supabaseClient.js
const SUPABASE_URL = "https://pozhvgotidnmddqonmrz.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_pibSOQynt2QJg6ySSwJkcg_th5cYd8U"

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
