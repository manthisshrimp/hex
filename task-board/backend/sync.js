const HABITS_URL = process.env.HABITS_URL || '';
const HABITS_SYNC_USER = process.env.HABITS_SYNC_USER || 'aldus';

class HabitsSync {
  constructor(habitsUrl, apiKey) {
    this.habitsUrl = habitsUrl;
    this.apiKey = apiKey;
  }

  async createTodo(title, taskBoardId) {
    try {
      const resp = await fetch(`${this.habitsUrl}/api/service/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.apiKey },
        body: JSON.stringify({ title, taskBoardId }),
      });
      if (!resp.ok) {
        console.warn(`Habits sync createTodo failed: ${resp.status}`);
        return null;
      }
      const body = await resp.json();
      return body.id || null;
    } catch (e) {
      console.warn('Habits sync createTodo error:', e.message);
      return null;
    }
  }

  async completeTodo(habitsId) {
    try {
      const resp = await fetch(`${this.habitsUrl}/api/service/todos/${habitsId}/complete`, {
        method: 'POST',
        headers: { 'X-Api-Key': this.apiKey },
      });
      if (!resp.ok) console.warn(`Habits sync completeTodo failed: ${resp.status}`);
    } catch (e) {
      console.warn('Habits sync completeTodo error:', e.message);
    }
  }

  async deleteTodo(habitsId) {
    try {
      const resp = await fetch(`${this.habitsUrl}/api/service/todos/${habitsId}`, {
        method: 'DELETE',
        headers: { 'X-Api-Key': this.apiKey },
      });
      if (!resp.ok) console.warn(`Habits sync deleteTodo failed: ${resp.status}`);
    } catch (e) {
      console.warn('Habits sync deleteTodo error:', e.message);
    }
  }
}

let instance = null;

function initHabitsSync(apiKey) {
  if (!HABITS_URL || !apiKey) {
    console.info('Habits sync disabled (HABITS_URL or API key not set)');
    return;
  }
  instance = new HabitsSync(HABITS_URL, apiKey);
  console.info(`Habits sync enabled → ${HABITS_URL} (user: ${HABITS_SYNC_USER})`);
}

function getHabitsSync() {
  return instance;
}

module.exports = { initHabitsSync, getHabitsSync, HABITS_SYNC_USER };
