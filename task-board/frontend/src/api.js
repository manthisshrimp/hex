const API_URL = '/todo/api';

let _token = null;
let _username = null;
let _onAuthFailure = null;

export function setAuthToken(token, username) { _token = token; _username = username; }
export function setAuthFailureHandler(fn) { _onAuthFailure = fn; }

async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (_token) {
    headers['X-Auth-Token'] = _token;
    headers['X-Username'] = _username;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    if (_onAuthFailure) _onAuthFailure();
    throw new Error('Unauthorized');
  }
  if (res.status === 403) {
    throw new Error('Forbidden');
  }
  return res;
}

// Auth
export async function login(username, password) {
  const res = await fetch(`${API_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Invalid username or password');
  return res.json(); // { token, username, isAdmin }
}

export async function fetchMe() {
  const res = await apiFetch(`${API_URL}/auth/me`);
  if (!res.ok) throw new Error('Failed to fetch session');
  return res.json(); // { username, isAdmin, canAccess }
}

// Tasks
export async function fetchTasks(username) {
  const res = await apiFetch(`${API_URL}/tasks/${username}`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json(); // { tasks }
}

export async function createTask(username, data) {
  const res = await apiFetch(`${API_URL}/tasks/${username}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to create task');
  }
  return res.json();
}

export async function updateTask(username, id, data) {
  const res = await apiFetch(`${API_URL}/tasks/${username}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update task');
  }
  return res.json();
}

export async function deleteTask(username, id) {
  const res = await apiFetch(`${API_URL}/tasks/${username}/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to delete task');
  }
  return true;
}

// Admin — users
export async function fetchAdminUsers() {
  const res = await apiFetch(`${API_URL}/admin/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createUser(username, password) {
  const res = await apiFetch(`${API_URL}/admin/users`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to create user');
  }
  return res.json(); // { username, password }
}

export async function deleteUser(username) {
  const res = await apiFetch(`${API_URL}/admin/users/${username}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to delete user');
  }
  return true;
}

export async function resetPassword(username) {
  const res = await apiFetch(`${API_URL}/admin/users/${username}/reset-password`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to reset password');
  }
  return res.json(); // { password }
}

// Admin — permissions
export async function fetchPermissions() {
  const res = await apiFetch(`${API_URL}/admin/permissions`);
  if (!res.ok) throw new Error('Failed to fetch permissions');
  return res.json();
}

export async function addGrant(grantee, owner) {
  const res = await apiFetch(`${API_URL}/admin/permissions`, {
    method: 'POST',
    body: JSON.stringify({ grantee, owner }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to add grant');
  }
  return res.json();
}

export async function removeGrant(grantee, owner) {
  const res = await apiFetch(`${API_URL}/admin/permissions`, {
    method: 'DELETE',
    body: JSON.stringify({ grantee, owner }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to remove grant');
  }
  return res.json();
}

// Users list (for dropdowns)
export async function fetchUsers() {
  const res = await apiFetch(`${API_URL}/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

// Requests
export async function sendRequest(data) {
  const res = await apiFetch(`${API_URL}/requests`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to send request');
  }
  return res.json();
}

export async function fetchSentRequests() {
  const res = await apiFetch(`${API_URL}/requests/sent`);
  if (!res.ok) throw new Error('Failed to fetch sent requests');
  return res.json(); // { requests }
}

export async function fetchReceivedRequests() {
  const res = await apiFetch(`${API_URL}/requests/received`);
  if (!res.ok) throw new Error('Failed to fetch received requests');
  return res.json(); // { requests }
}

export async function acceptRequest(id) {
  const res = await apiFetch(`${API_URL}/requests/${id}/accept`, { method: 'PUT' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to accept request');
  }
  return res.json(); // { request, task }
}

export async function declineRequest(id) {
  const res = await apiFetch(`${API_URL}/requests/${id}/decline`, { method: 'PUT' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to decline request');
  }
  return res.json(); // request
}
