const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, '..', 'data');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // Directory already exists or can't be created
  }
}

// Get file path for a year
function getYearFilePath(year) {
  return path.join(DATA_DIR, `${year}.jsonl`);
}

// Read all years from data directory (full data for category usage counting)
async function getAllYearsData() {
  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);
  const yearFiles = files.filter(f => f.endsWith('.jsonl'));
  
  const years = [];
  for (const file of yearFiles) {
    const year = parseInt(file.replace('.jsonl', ''));
    const yearData = await getYearData(year);
    years.push(yearData);
  }
  
  return years.sort((a, b) => b.year - a.year);
}

// Read all years from data directory (summary only)
async function getAllYears() {
  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);
  const yearFiles = files.filter(f => f.endsWith('.jsonl'));
  
  const years = [];
  for (const file of yearFiles) {
    const year = parseInt(file.replace('.jsonl', ''));
    const yearData = await getYearData(year);
    const totalIncome = yearData.months.reduce((sum, m) => sum + (m.income || 0), 0);
    const totalExpenses = yearData.months.reduce((sum, m) => {
      return sum + m.expenses.reduce((eSum, e) => eSum + (e.amount || 0), 0);
    }, 0);
    const remainder = totalIncome - totalExpenses;
    
    years.push({
      year,
      totalIncome,
      totalExpenses,
      remainder
    });
  }
  
  return years.sort((a, b) => b.year - a.year);
}

// Read year data from JSONL file
async function getYearData(year) {
  const filePath = getYearFilePath(year);
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line);
    const months = lines.map(line => JSON.parse(line));
    
    // Ensure all 12 months exist
    const monthMap = new Map(months.map(m => [m.month, m]));
    const fullMonths = [];
    
    for (let i = 1; i <= 12; i++) {
      if (monthMap.has(i)) {
        fullMonths.push(monthMap.get(i));
      } else {
        fullMonths.push({
          month: i,
          year: parseInt(year),
          income: 0,
          expenses: []
        });
      }
    }
    
    return { year: parseInt(year), months: fullMonths };
  } catch (err) {
    // File doesn't exist or is empty - return 12 empty months
    return {
      year: parseInt(year),
      months: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        year: parseInt(year),
        income: 0,
        expenses: []
      }))
    };
  }
}

// Get single month data
async function getMonthData(year, month) {
  const yearData = await getYearData(year);
  return yearData.months.find(m => m.month === parseInt(month)) || {
    month: parseInt(month),
    year: parseInt(year),
    income: 0,
    expenses: []
  };
}

// Write year data to JSONL file
async function writeYearData(year, months) {
  await ensureDataDir();
  const filePath = getYearFilePath(year);
  
  const lines = months.map(m => JSON.stringify(m));
  await fs.writeFile(filePath, lines.join('\n') + '\n', 'utf-8');
}

// Create new year with 12 empty months
async function createYear(year) {
  const existing = await getYearData(year);
  if (existing.months.some(m => m.income > 0 || m.expenses.length > 0)) {
    throw new Error('Year already exists with data');
  }
  
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    year: parseInt(year),
    income: 0,
    expenses: []
  }));
  
  await writeYearData(year, months);
  return { year: parseInt(year), months };
}

// Update month income
async function updateIncome(year, month, income) {
  const yearData = await getYearData(year);
  const monthIndex = yearData.months.findIndex(m => m.month === parseInt(month));
  
  if (monthIndex === -1) {
    throw new Error('Month not found');
  }
  
  yearData.months[monthIndex].income = parseFloat(income) || 0;
  await writeYearData(year, yearData.months);
  
  return yearData.months[monthIndex];
}

// Add expense to month
async function addExpense(year, month, expense) {
  const yearData = await getYearData(year);
  const monthIndex = yearData.months.findIndex(m => m.month === parseInt(month));
  
  if (monthIndex === -1) {
    throw new Error('Month not found');
  }
  
  const newExpense = {
    id: uuidv4(),
    day: parseInt(expense.day),
    categoryId: expense.categoryId,
    description: expense.description,
    amount: parseFloat(expense.amount) || 0
  };
  
  yearData.months[monthIndex].expenses.push(newExpense);
  await writeYearData(year, yearData.months);
  
  return newExpense;
}

// Update an existing expense
async function updateExpense(year, month, expenseId, updates) {
  const yearData = await getYearData(year);
  const monthIndex = yearData.months.findIndex(m => m.month === parseInt(month));
  
  if (monthIndex === -1) {
    throw new Error('Month not found');
  }
  
  const expenseIndex = yearData.months[monthIndex].expenses.findIndex(
    e => e.id === expenseId
  );
  
  if (expenseIndex === -1) {
    throw new Error('Expense not found');
  }
  
  const expense = yearData.months[monthIndex].expenses[expenseIndex];
  
  if (updates.day !== undefined) expense.day = parseInt(updates.day);
  if (updates.categoryId !== undefined) expense.categoryId = updates.categoryId;
  if (updates.description !== undefined) expense.description = updates.description;
  if (updates.amount !== undefined) expense.amount = parseFloat(updates.amount) || 0;
  
  await writeYearData(year, yearData.months);
  return expense;
}

// Remove expense from month
async function removeExpense(year, month, expenseId) {
  const yearData = await getYearData(year);
  const monthIndex = yearData.months.findIndex(m => m.month === parseInt(month));
  
  if (monthIndex === -1) {
    throw new Error('Month not found');
  }
  
  const originalLength = yearData.months[monthIndex].expenses.length;
  yearData.months[monthIndex].expenses = yearData.months[monthIndex].expenses.filter(
    e => e.id !== expenseId
  );
  
  if (yearData.months[monthIndex].expenses.length === originalLength) {
    throw new Error('Expense not found');
  }
  
  await writeYearData(year, yearData.months);
  return { deleted: expenseId };
}

// Calculate remainder for a month
function calculateRemainder(month) {
  const totalExpenses = month.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  return (month.income || 0) - totalExpenses;
}

// Get expenses grouped by category for a month
async function getExpensesByCategory(year, month, getCategoryFn) {
  const monthData = await getMonthData(year, month);
  const breakdown = {};
  
  for (const expense of monthData.expenses) {
    const category = await getCategoryFn(expense.categoryId);
    const catId = expense.categoryId;
    
    if (!breakdown[catId]) {
      breakdown[catId] = {
        categoryId: catId,
        categoryName: category ? category.name : 'Unknown',
        color: category ? category.color : '#6b7280',
        total: 0,
        count: 0,
      };
    }
    
    breakdown[catId].total += expense.amount;
    breakdown[catId].count += 1;
  }
  
  return Object.values(breakdown).sort((a, b) => b.total - a.total);
}

// Check if a category is used in any expenses
async function isCategoryUsed(categoryId) {
  const years = await getAllYearsData();
  
  for (const year of years) {
    for (const month of year.months) {
      if (month.expenses.some(e => e.categoryId === categoryId)) {
        return true;
      }
    }
  }
  
  return false;
}

module.exports = {
  getAllYears,
  getAllYearsData,
  getYearData,
  getMonthData,
  createYear,
  updateIncome,
  addExpense,
  updateExpense,
  removeExpense,
  calculateRemainder,
  getExpensesByCategory,
  isCategoryUsed,
};
