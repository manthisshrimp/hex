let _token = null;
let _onAuthFailure = null;

export const setAuthToken = (t) => { _token = t; };
export const setAuthFailureHandler = (fn) => { _onAuthFailure = fn; };

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': _token,
      ...options.headers,
    },
  });
  if (res.status === 401 || res.status === 403) {
    _onAuthFailure?.();
    throw new Error('Unauthorized');
  }
  return res;
}

export async function authenticate(password) {
  const res = await fetch('/habits/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error('Unauthorized');
  const data = await res.json();
  return data.token;
}

export const getCharacter = () => apiFetch('/habits/api/character');

export const getHabits = () => apiFetch('/habits/api/habits');

export const createHabit = (data) =>
  apiFetch('/habits/api/habits', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateHabit = (id, data) =>
  apiFetch(`/habits/api/habits/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const moveHabit = (id, direction) =>
  apiFetch(`/habits/api/habits/${id}/move`, {
    method: 'POST',
    body: JSON.stringify({ direction }),
  });

export const deleteHabit = (id) =>
  apiFetch(`/habits/api/habits/${id}`, { method: 'DELETE' });

export const completeHabit = (id) =>
  apiFetch(`/habits/api/habits/${id}/complete`, { method: 'POST' });

export const rescheduleHabit = (id) =>
  apiFetch(`/habits/api/habits/${id}/reschedule`, { method: 'POST' });

export const inscribeHabit = (id) =>
  apiFetch(`/habits/api/habits/${id}/inscribe`, { method: 'POST' });

export const restoreHabit = (id) =>
  apiFetch(`/habits/api/habits/${id}/restore`, { method: 'POST' });

export const payFerryman = () =>
  apiFetch('/habits/api/character/pay-ferryman', { method: 'POST' });

export const debugAdvanceDays = (days) =>
  apiFetch('/habits/api/debug/advance-days', {
    method: 'POST',
    body: JSON.stringify({ days }),
  });

export const getHistoryHp = () => apiFetch('/habits/api/history/hp');

export const getHistoryGold = () => apiFetch('/habits/api/history/gold');

export const getHistoryCompletions = (days = 60) => apiFetch(`/habits/api/history/completions?days=${days}`);

export const getRandomEvent = () => apiFetch('/habits/api/random-event');
export const resolveRandomEvent = () => apiFetch('/habits/api/random-event/resolve', { method: 'POST' });
export const chooseRandomEvent = (optionIndex) =>
  apiFetch('/habits/api/random-event/choose', {
    method: 'POST',
    body: JSON.stringify({ optionIndex }),
  });
export const getRandomEventHistory = () => apiFetch('/habits/api/random-event/history');

export const getShop = () => apiFetch('/habits/api/shop');
export const buyItem = (id) => apiFetch(`/habits/api/shop/buy/${id}`, { method: 'POST' });

export const getEquipment = () => apiFetch('/habits/api/equipment');
export const equipItem = (id) => apiFetch(`/habits/api/equipment/equip/${id}`, { method: 'POST' });
export const unequipSlot = (slot) => apiFetch(`/habits/api/equipment/unequip/${slot}`, { method: 'POST' });

export const getTodos = () => apiFetch('/habits/api/todos');
export const createTodo = (title) => apiFetch('/habits/api/todos', { method: 'POST', body: JSON.stringify({ title }) });
export const completeTodo = (id) => apiFetch(`/habits/api/todos/${id}/complete`, { method: 'POST' });
export const deleteTodo = (id) => apiFetch(`/habits/api/todos/${id}`, { method: 'DELETE' });
export const getWeeklyReward = () => apiFetch('/habits/api/todos/reward');
export const claimWeeklyReward = (type) => apiFetch('/habits/api/todos/reward/claim', { method: 'POST', body: JSON.stringify({ type }) });

export const getDeeds = () => apiFetch('/habits/api/deeds');
export const createDeed = (data) => apiFetch('/habits/api/deeds', { method: 'POST', body: JSON.stringify(data) });
export const updateDeed = (id, data) => apiFetch(`/habits/api/deeds/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteDeed = (id) => apiFetch(`/habits/api/deeds/${id}`, { method: 'DELETE' });
export const logDeed = (id) => apiFetch(`/habits/api/deeds/${id}/log`, { method: 'POST' });

// ── Boss quests ───────────────────────────────────────────────────────────────

export const getBoss = () => apiFetch('/habits/api/boss');

export const launchBoss = (bossId) =>
  apiFetch('/habits/api/boss/launch', {
    method: 'POST',
    body: JSON.stringify({ bossId }),
  });

export const joinBoss = (hostUrl) =>
  apiFetch('/habits/api/boss/join', {
    method: 'POST',
    body: JSON.stringify({ hostUrl }),
  });

export const abandonBoss = () =>
  apiFetch('/habits/api/boss/abandon', { method: 'POST' });

export const submitCheckin = (completedIds) =>
  apiFetch('/habits/api/character/checkin', {
    method: 'POST',
    body: JSON.stringify({ completedIds }),
  });

export const patchCharacter = (data) =>
  apiFetch('/habits/api/character', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const getParty = () => apiFetch('/habits/api/party');

export const addPartyMember = (url, myUrl) =>
  apiFetch('/habits/api/party/members', {
    method: 'POST',
    body: JSON.stringify({ url, myUrl }),
  });

export const removePartyMember = (url, myUrl) =>
  apiFetch('/habits/api/party/members', {
    method: 'DELETE',
    body: JSON.stringify({ url, myUrl }),
  });

export const cheerMember = (targetUrl, myUrl) =>
  apiFetch('/habits/api/party/cheer', {
    method: 'POST',
    body: JSON.stringify({ targetUrl, myUrl }),
  });
