const express = require('express');
const router = express.Router();
const storage = require('../storage');
const { getCategoryById } = require('../storage/categories');

// GET /api/years/:year - Get full year data
router.get('/:year', async (req, res) => {
  try {
    const { year } = req.params;
    const yearData = await storage.getYearData(year);
    res.json(yearData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/years/:year/months/:month - Get single month
router.get('/:year/months/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const monthData = await storage.getMonthData(year, month);
    const remainder = storage.calculateRemainder(monthData);
    
    res.json({
      ...monthData,
      remainder,
      totalExpenses: monthData.expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/years/:year/months/:month/income - Set monthly income
router.put('/:year/months/:month/income', async (req, res) => {
  try {
    const { year, month } = req.params;
    const { income } = req.body;
    
    if (income === undefined || isNaN(parseFloat(income))) {
      return res.status(400).json({ error: 'Income must be a valid number' });
    }
    
    const updatedMonth = await storage.updateIncome(year, month, income);
    const remainder = storage.calculateRemainder(updatedMonth);
    
    res.json({
      ...updatedMonth,
      remainder,
      totalExpenses: updatedMonth.expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/years/:year/months/:month/expenses - Add expense
router.post('/:year/months/:month/expenses', async (req, res) => {
  try {
    const { year, month } = req.params;
    const { day, categoryId, description, amount } = req.body;
    
    // Validation
    if (!day || !Number.isInteger(Number(day)) || day < 1 || day > 31) {
      return res.status(400).json({ error: 'Day must be an integer between 1 and 31' });
    }
    if (!categoryId || typeof categoryId !== 'string') {
      return res.status(400).json({ error: 'Category ID is required' });
    }
    // Validate category exists
    const category = await getCategoryById(categoryId);
    if (!category) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    if (amount === undefined || isNaN(parseFloat(amount))) {
      return res.status(400).json({ error: 'Amount must be a valid number' });
    }
    
    const expense = await storage.addExpense(year, month, {
      day: parseInt(day),
      categoryId,
      description: description || '',
      amount: parseFloat(amount)
    });
    
    res.status(201).json(expense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/years/:year/months/:month/expenses/:expenseId - Update expense
router.put('/:year/months/:month/expenses/:expenseId', async (req, res) => {
  try {
    const { year, month, expenseId } = req.params;
    const { day, categoryId, description, amount } = req.body;
    
    // Build updates object
    const updates = {};
    
    if (day !== undefined) {
      if (!Number.isInteger(Number(day)) || day < 1 || day > 31) {
        return res.status(400).json({ error: 'Day must be an integer between 1 and 31' });
      }
      updates.day = parseInt(day);
    }
    
    if (categoryId !== undefined) {
      if (typeof categoryId !== 'string') {
        return res.status(400).json({ error: 'Category ID must be a string' });
      }
      // Validate category exists
      const category = await getCategoryById(categoryId);
      if (!category) {
        return res.status(400).json({ error: 'Invalid category ID' });
      }
      updates.categoryId = categoryId;
    }
    
    if (description !== undefined) {
      updates.description = description;
    }
    
    if (amount !== undefined) {
      if (isNaN(parseFloat(amount))) {
        return res.status(400).json({ error: 'Amount must be a valid number' });
      }
      updates.amount = parseFloat(amount);
    }
    
    const expense = await storage.updateExpense(year, month, expenseId, updates);
    res.json(expense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/years/:year/months/:month/expenses/:expenseId - Remove expense
router.delete('/:year/months/:month/expenses/:expenseId', async (req, res) => {
  try {
    const { year, month, expenseId } = req.params;
    const result = await storage.removeExpense(year, month, expenseId);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/years/:year/months/:month/expenses/by-category - Get expenses grouped by category
router.get('/:year/months/:month/expenses/by-category', async (req, res) => {
  try {
    const { year, month } = req.params;
    const breakdown = await storage.getExpensesByCategory(year, month, getCategoryById);
    res.json({ breakdown });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
