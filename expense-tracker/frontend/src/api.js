const BASE_URL = '/expenses/api'

let _token = null;
let _onAuthFailure = null;

export const setAuthToken = (t) => { _token = t; };
export const setAuthFailureHandler = (fn) => { _onAuthFailure = fn; };

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
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
  const res = await fetch('/expenses/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error('Unauthorized');
  const data = await res.json();
  return data.token;
}

/**
 * Get all categories
 * @returns {Promise<{ categories: Array<Category> }>}
 */
export async function getCategories() {
  const res = await apiFetch(`${BASE_URL}/categories`)
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.statusText}`)
  return res.json()
}

/**
 * Create a new category
 * @param {{ name: string, color: string }} category
 * @returns {Promise<Category>}
 */
export async function createCategory(category) {
  const res = await apiFetch(`${BASE_URL}/categories`, {
    method: 'POST',
    body: JSON.stringify(category),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to create category: ${res.statusText}`)
  }
  return res.json()
}

/**
 * Update a category
 * @param {string} categoryId
 * @param {{ name?: string, color?: string }} updates
 * @returns {Promise<Category>}
 */
export async function updateCategory(categoryId, updates) {
  const res = await apiFetch(`${BASE_URL}/categories/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to update category: ${res.statusText}`)
  }
  return res.json()
}

/**
 * Delete a category
 * @param {string} categoryId
 * @returns {Promise<{ success: boolean }>}
 */
export async function deleteCategory(categoryId) {
  const res = await apiFetch(`${BASE_URL}/categories/${categoryId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to delete category: ${res.statusText}`)
  }
  return res.json()
}

/**
 * Get all years with annual summary totals
 * @returns {Promise<{ years: Array<{ year: number, totalIncome: number, totalExpenses: number, remainder: number }> }>}
 */
export async function getYears() {
  const res = await apiFetch(`${BASE_URL}/years`)
  if (!res.ok) throw new Error(`Failed to fetch years: ${res.statusText}`)
  return res.json()
}

/**
 * Get full year data (all 12 months with summaries)
 * @param {number} year
 * @returns {Promise<{ year: number, months: Array<MonthData> }>}
 */
export async function getYear(year) {
  const res = await apiFetch(`${BASE_URL}/years/${year}`)
  if (!res.ok) throw new Error(`Failed to fetch year: ${res.statusText}`)
  return res.json()
}

/**
 * Create a new year (auto-creates 12 empty months)
 * @param {number} year
 * @returns {Promise<{ year: number, months: Array<MonthData> }>}
 */
export async function createYear(year) {
  const res = await apiFetch(`${BASE_URL}/years`, {
    method: 'POST',
    body: JSON.stringify({ year: Number(year) }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to create year: ${res.statusText}`)
  }
  return res.json()
}

/**
 * Get full month data
 * @param {number} year
 * @param {number} month
 * @returns {Promise<MonthData>}
 */
export async function getMonth(year, month) {
  const res = await apiFetch(`${BASE_URL}/years/${year}/months/${month}`)
  if (!res.ok) throw new Error(`Failed to fetch month: ${res.statusText}`)
  return res.json()
}

/**
 * Update monthly income
 * @param {number} year
 * @param {number} month
 * @param {number} income
 * @returns {Promise<MonthData>}
 */
export async function updateIncome(year, month, income) {
  const res = await apiFetch(`${BASE_URL}/years/${year}/months/${month}/income`, {
    method: 'PUT',
    body: JSON.stringify({ income: Number(income) }),
  })
  if (!res.ok) throw new Error(`Failed to update income: ${res.statusText}`)
  return res.json()
}

/**
 * Add a new expense
 * @param {number} year
 * @param {number} month
 * @param {{ day: number, categoryId: string, description: string, amount: number }} expense
 * @returns {Promise<Expense>}
 */
export async function addExpense(year, month, expense) {
  const res = await apiFetch(`${BASE_URL}/years/${year}/months/${month}/expenses`, {
    method: 'POST',
    body: JSON.stringify({
      day: Number(expense.day),
      categoryId: expense.categoryId,
      description: expense.description,
      amount: Number(expense.amount),
    }),
  })
  if (!res.ok) throw new Error(`Failed to add expense: ${res.statusText}`)
  return res.json()
}

/**
 * Update an expense
 * @param {number} year
 * @param {number} month
 * @param {string} expenseId
 * @param {{ day?: number, categoryId?: string, description?: string, amount?: number }} updates
 * @returns {Promise<Expense>}
 */
export async function updateExpense(year, month, expenseId, updates) {
  const res = await apiFetch(
    `${BASE_URL}/years/${year}/months/${month}/expenses/${expenseId}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    }
  )
  if (!res.ok) throw new Error(`Failed to update expense: ${res.statusText}`)
  return res.json()
}

/**
 * Delete an expense
 * @param {number} year
 * @param {number} month
 * @param {string} expenseId
 * @returns {Promise<void>}
 */
export async function deleteExpense(year, month, expenseId) {
  const res = await apiFetch(
    `${BASE_URL}/years/${year}/months/${month}/expenses/${expenseId}`,
    {
      method: 'DELETE',
    }
  )
  if (!res.ok) throw new Error(`Failed to delete expense: ${res.statusText}`)
}

/**
 * Copy an expense to the next month
 * @param {number} year
 * @param {number} month
 * @param {string} expenseId
 * @returns {Promise<Expense>}
 */
export async function copyExpenseToNextMonth(year, month, expenseId) {
  // First get the expense details
  const monthData = await getMonth(year, month)
  const expense = monthData.expenses.find(e => e.id === expenseId)
  if (!expense) throw new Error('Expense not found')

  // Calculate next month/year
  let nextMonth = month + 1
  let nextYear = year
  if (nextMonth > 12) {
    nextMonth = 1
    nextYear = year + 1
  }

  // Add the expense to next month
  return addExpense(nextYear, nextMonth, {
    day: expense.day,
    categoryId: expense.categoryId,
    description: expense.description,
    amount: expense.amount
  })
}

/**
 * Get expenses grouped by category for a month
 * @param {number} year
 * @param {number} month
 * @returns {Promise<{ breakdown: Array<CategoryBreakdown> }>}
 */
export async function getExpensesByCategory(year, month) {
  const res = await apiFetch(
    `${BASE_URL}/years/${year}/months/${month}/expenses/by-category`
  )
  if (!res.ok) throw new Error(`Failed to fetch category breakdown: ${res.statusText}`)
  return res.json()
}
