let authToken = null
let authFailureHandler = null

// On module load: restore token from localStorage
const stored = localStorage.getItem('octiron_token')
if (stored) {
  authToken = stored
}

export function setAuthToken(token) {
  authToken = token
  if (token) {
    localStorage.setItem('octiron_token', token)
  } else {
    localStorage.removeItem('octiron_token')
  }
}

export function setAuthFailureHandler(fn) {
  authFailureHandler = fn
}

export async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (authToken) {
    headers['X-Admin-Token'] = authToken
  }

  const res = await fetch(path, { ...options, headers })

  if (res.status === 401 || res.status === 403) {
    if (authFailureHandler) {
      authFailureHandler()
    }
    throw new Error('Authentication failed')
  }

  return res
}

export async function searchItems(q) {
  const res = await apiFetch(`/inventory/api/items/search?q=${encodeURIComponent(q)}`)
  return res.json()
}

export async function listItems() {
  const res = await apiFetch('/inventory/api/items')
  return res.json()
}

export async function getItem(id) {
  const res = await apiFetch(`/inventory/api/items/${id}`)
  return res.json()
}

export async function createItem(data) {
  const res = await apiFetch('/inventory/api/items', { method: 'POST', body: JSON.stringify(data) })
  return res.json()
}

export async function updateItem(id, data) {
  const res = await apiFetch(`/inventory/api/items/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  return res.json()
}

export async function deleteItem(id) {
  return apiFetch(`/inventory/api/items/${id}`, { method: 'DELETE' })
}

export async function createCheck(locationId, mode = 'oneLevel') {
  const res = await apiFetch('/inventory/api/checks', {
    method: 'POST',
    body: JSON.stringify({ locationId, mode }),
  })
  return res.json()
}

export async function submitCheck(checkId, entries) {
  // entries: array of { itemId, actualQuantity }
  const res = await apiFetch(`/inventory/api/checks/${checkId}/submit`, {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  })
  return res.json()
}

export async function listTodoSets() {
  const res = await apiFetch('/inventory/api/todo-sets')
  return res.json()
}

export async function deleteTodoSet(id) {
  return apiFetch(`/inventory/api/todo-sets/${id}`, { method: 'DELETE' })
}

// Public — no auth token needed
export async function getTodoSet(id) {
  const res = await fetch(`/inventory/api/todo-sets/${id}`, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error('Todo set not found')
  return res.json()
}

// Public — no auth token needed
export async function markTodoSetItemDone(setId, itemId) {
  const res = await fetch(`/inventory/api/todo-sets/${setId}/items/${itemId}/done`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error('Failed to mark item done')
  return res.json()
}

export async function listTags() {
  const res = await apiFetch('/inventory/api/tags')
  return res.json()
}

export async function authenticate(password) {
  const res = await fetch('/inventory/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })

  if (!res.ok) {
    throw new Error('Invalid password')
  }

  const data = await res.json()
  return data.token
}
