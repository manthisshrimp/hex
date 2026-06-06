const API_URL = import.meta.env.VITE_API_URL || '/calendar/api';

let _token = null;
let _onAuthFailure = null;

export function setAuthToken(token) { _token = token; }
export function setAuthFailureHandler(fn) { _onAuthFailure = fn; }

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers, ...(_token ? { 'X-Admin-Token': _token } : {}) },
  });
  if (response.status === 401 || response.status === 403) {
    if (_onAuthFailure) _onAuthFailure();
    throw new Error('Unauthorized');
  }
  return response;
}

export async function fetchEventsInRange(startDate, endDate) {
  try {
    const response = await apiFetch(`${API_URL}/events?start=${startDate}&end=${endDate}`);
    if (!response.ok) throw new Error('Failed to fetch events');
    const data = await response.json();
    return data.events ?? data;
  } catch (error) {
    console.error('Error fetching events in range:', error);
    return [];
  }
}

export async function fetchEventsForDate(date) {
  try {
    const response = await apiFetch(`${API_URL}/events/${date}`);
    if (!response.ok) throw new Error('Failed to fetch events');
    const data = await response.json();
    return data.events ?? data;
  } catch (error) {
    console.error('Error fetching events for date:', error);
    return [];
  }
}

export async function fetchEventById(id) {
  try {
    const response = await apiFetch(`${API_URL}/events/by-id/${id}`);
    if (!response.ok) throw new Error('Failed to fetch event');
    return await response.json();
  } catch (error) {
    console.error('Error fetching event:', error);
    return null;
  }
}

export async function createEvent(eventData) {
  const response = await apiFetch(`${API_URL}/events`, {
    method: 'POST',
    body: JSON.stringify(eventData),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to create event (${response.status})`);
  }
  return await response.json();
}

export async function updateEvent(id, updates) {
  const response = await apiFetch(`${API_URL}/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to update event (${response.status})`);
  }
  return await response.json();
}

export async function deleteEvent(id) {
  const response = await apiFetch(`${API_URL}/events/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to delete event (${response.status})`);
  }
  return true;
}

export async function fetchDays(start, count = 28) {
  try {
    const response = await apiFetch(`${API_URL}/days?start=${start}&count=${count}`);
    if (!response.ok) throw new Error('Failed to fetch days');
    return await response.json();
  } catch (error) {
    console.error('Error fetching days:', error);
    return [];
  }
}

export async function fetchCategories() {
  try {
    const res = await apiFetch(`${API_URL}/categories`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    const data = await res.json();
    return data.categories ?? [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function createCategory(data) {
  const res = await apiFetch(`${API_URL}/categories`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to create category');
  }
  return res.json();
}

export async function updateCategory(id, data) {
  const res = await apiFetch(`${API_URL}/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update category');
  }
  return res.json();
}

export async function importHolidays() {
  const res = await apiFetch(`${API_URL}/holidays/import`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to import holidays');
  }
  return res.json();
}

export async function deleteCategory(id) {
  const res = await apiFetch(`${API_URL}/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to delete category');
  }
  return true;
}
