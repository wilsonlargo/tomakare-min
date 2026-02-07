// assets/js/auth.js

async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
  })
  if (error) throw error
  return data
}

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut()
  if (error) throw error
}

async function requireAuth() {
  const { data, error } = await supabaseClient.auth.getSession()
  if (error) throw error

  if (!data.session) {
    window.location.href = "index.html"
    return null
  }
  return data.session
}

// Util: mostrar mensajes
function setMsg(id, text, type = "info") {
  const el = document.getElementById(id)
  if (!el) return
  el.className = `alert alert-${type}`
  el.textContent = text
  el.style.display = "block"
}
