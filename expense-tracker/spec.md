# Expense Tracker - Specification

## Overview
A personal expense tracking application to log monthly expenses, track income, and calculate remaining budget per month. Data stored in JSONL files per year.

## Tech Stack
- **Backend:** Node.js + Express (simple REST API)
- **Frontend:** React + Vite (SPA)
- **Storage:** JSONL files (one per year)
- **Deployment:** Docker + Ansible (same pattern as School Dashboard)

## Data Model

### Category
```typescript
interface Category {
  id: string;           // UUID
  name: string;         // Display name (e.g., "Groceries")
  color: string;        // Hex color code (e.g., "#22c55e")
}
```

### Expense Entry
```typescript
interface Expense {
  id: string;           // UUID
  day: number;          // 1-31
  categoryId: string;   // Reference to Category.id
  description: string;  // Brief description
  amount: number;       // Positive number
}
```

### Month Data
```typescript
interface MonthData {
  month: number;        // 1-12
  year: number;
  income: number;       // Total income for month
  expenses: Expense[];  // List of expenses
}
```

### Categories File (Global)
Stored as JSON: `data/categories.json`
```json
{
  "categories": [
    {"id":"cat-1","name":"Groceries","color":"#22c55e"},
    {"id":"cat-2","name":"Transport","color":"#3b82f6"},
    {"id":"cat-3","name":"Utilities","color":"#f59e0b"},
    {"id":"cat-4","name":"Entertainment","color":"#8b5cf6"},
    {"id":"cat-5","name":"Dining","color":"#ef4444"},
    {"id":"cat-6","name":"Healthcare","color":"#06b6d4"},
    {"id":"cat-7","name":"Shopping","color":"#ec4899"},
    {"id":"cat-8","name":"Other","color":"#6b7280"}
  ]
}
```

### Year Data (File Format)
Stored as JSONL: `data/YYYY.jsonl`
```jsonl
{"month":1,"year":2026,"income":50000,"expenses":[{"id":"...","day":5,"categoryId":"cat-1","description":"Weekly shop","amount":1200}]}
{"month":2,"year":2026,"income":50000,"expenses":[]}
```

## Categories
Configurable categories with color coding for visual expense tracking.

### Default Categories (with suggested colors)
| Category | Color | Hex |
|----------|-------|-----|
| Groceries | Green | `#22c55e` |
| Transport | Blue | `#3b82f6` |
| Utilities | Amber | `#f59e0b` |
| Entertainment | Purple | `#8b5cf6` |
| Dining | Red | `#ef4444` |
| Healthcare | Cyan | `#06b6d4` |
| Shopping | Pink | `#ec4899` |
| Other | Gray | `#6b7280` |

### Color Usage in UI
- **Expense list:** Category name displayed with colored badge/dot
- **Month summary:** Category breakdown uses category colors in legend/chips
- **Year view:** Monthly cards show category color indicators for top expense categories
- **Category picker:** Color swatch shown next to category name in dropdown

## UI Pages

### 1. Years List Page (Home)
**Route:** `/`

**Content:**
- List of all years with data
- Each year shows: year number, total annual income, total annual expenses, annual remainder
- Click to navigate to Year page
- Button to add new year

### 2. Year Page
**Route:** `/year/:year`

**Content:**
- Header: Year number, back to Years list
- Grid of 12 month cards:
  - Month name (January, February, etc.)
  - Number of expenses logged
  - Income amount (or "Not set")
  - Remainder amount (or "--")
  - Click to open Month page

### 3. Month Page
**Route:** `/month/:year/:month`

**Content:**

**Header Section:**
- Month name and year
- Back to Year page
- Navigation: Previous month / Next month arrows
- Link to "Manage Categories" page

**Income Section:**
- Label: "Monthly Income"
- Input field for income amount
- Auto-saves on change

**Remainder Section:**
- Label: "Remaining Budget"
- Display: `income - sum(all expenses)`
- Color: Green if positive, Red if negative

**Expenses List Section:**
- Table with columns: Day, Category (colored), Description, Amount, Actions
- Sortable by: Day (ascending/descending), Category (A-Z)
- Each row shows category with color indicator (badge or left border)
- Each row has delete button
- "Add Expense" button opens form

**Add/Edit Expense Form (inline or modal):**
- Day: Number input (1-31)
- Category: Dropdown with color swatches
- Description: Text input
- Amount: Number input
- Save button

**Category Breakdown (optional summary):**
- List of categories with total spent per category
- Uses category colors for visual identification

### 4. Categories Management Page
**Route:** `/categories`

**Content:**

**Header Section:**
- Title: "Manage Categories"
- Back navigation (returns to previous page)
- Short help text: "Add, edit, or remove expense categories. Changes apply to all years."

**Categories List:**
- Grid/list of all categories
- Each category card shows:
  - Color picker/preview (click to change)
  - Category name (editable inline)
  - Expense count (total expenses using this category across all years)
  - Delete button (disabled if expenses exist, with tooltip)

**Add Category:**
- "Add New Category" button
- Opens form with:
  - Name input
  - Color picker (preset palette + custom hex input)
  - Save/Cancel buttons

**Color Picker Options:**
- Preset palette (16 common colors)
- Hex input field with validation
- Live preview of color
- Contrast check (ensures text readability)

## Technical Requirements

### Storage
- Categories file: `data/categories.json` - Global category definitions
- JSONL files per year: `data/YYYY.jsonl`
- Each line is a complete MonthData JSON object
- File-based storage (no database required)
- Auto-create categories.json with defaults if missing

### State Management
- In-memory state for current view
- Auto-save to JSONL/JSON on changes
- Load year data on navigation
- Load categories globally on app start

### Category Resolution
- Expenses reference categories by `categoryId`
- UI resolves `categoryId` → `{ name, color }` for display
- Deleting a category: blocked if any expense references it

### Sorting Logic
- By Day: Sort by day number (1-31)
- By Category: Alphabetical sort on category name (resolved from categoryId)

### Remainder Calculation
```
remainder = month.income - sum(expense.amount for expense in month.expenses)
```

## API Endpoints

### Categories
- `GET /api/categories` - List all categories
  - Returns: `{ categories: [Category] }`
- `POST /api/categories` - Create new category
  - Body: `{ name, color }`
  - Returns: created `Category` with `id`
- `PUT /api/categories/:id` - Update category
  - Body: `{ name?, color? }`
  - Returns: updated `Category`
- `DELETE /api/categories/:id` - Delete category (only if no expenses use it)
  - Returns: `{ success: true }` or `{ error: "Category in use" }`

### Years
- `GET /api/years` - List all years with data
  - Returns: `[{ year, totalIncome, totalExpenses, remainder }]`
- `POST /api/years` - Create new year (auto-creates 12 empty months)
  - Body: `{ year }`

### Months
- `GET /api/years/:year` - Get full year data (all 12 months)
  - Returns: `{ year, months: [MonthData] }`
- `GET /api/years/:year/months/:month` - Get single month
  - Returns: `MonthData`
- `PUT /api/years/:year/months/:month/income` - Set monthly income
  - Body: `{ income: number }`

### Expenses
- `POST /api/years/:year/months/:month/expenses` - Add expense
  - Body: `{ day, categoryId, description, amount }`
  - Returns: created `Expense` with `id`
- `PUT /api/years/:year/months/:month/expenses/:expenseId` - Update expense
  - Body: `{ day?, categoryId?, description?, amount? }`
  - Returns: updated `Expense`
- `DELETE /api/years/:year/months/:month/expenses/:expenseId` - Remove expense
- `GET /api/years/:year/months/:month/expenses/by-category` - Get expenses grouped by category
  - Returns: `{ breakdown: [{ categoryId, categoryName, color, total, count }] }`

### Health
- `GET /health` - Service health check

## Docker Configuration

### Development (docker-compose.yml)
- **Backend:** Node container with hot-reload (npm run dev)
- **Frontend:** Vite dev server with HMR
- **Volumes:** Source code mounted for live editing
- **Ports:** 3000 (API), 5173 (UI)

### Production (docker-compose.prod.yml)
- **Backend:** Node container (production mode)
- **Frontend:** Nginx serving static build
- **Volumes:** Data volume for JSONL persistence
- **Networks:** Isolated bridge network

## Future Enhancements (Out of Scope for v1)
- Data export (CSV, Excel)
- Charts/visualizations
- Recurring expenses
- Budget limits per category
- Multi-year comparisons
- Category spending analytics (trends, averages)

## File Structure
```
expense-tracker/
├── spec.md                      # This file
├── docker-compose.yml           # Local dev orchestration
├── docker-compose.prod.yml      # Production orchestration
├── Dockerfile.backend           # Backend container
├── Dockerfile.frontend          # Frontend container
├── .dockerignore                # Docker ignore rules
├── backend/                     # Node.js API server
│   ├── package.json
│   ├── server.js               # Express entry point
│   ├── routes/
│   │   ├── categories.js       # Category CRUD endpoints
│   │   ├── years.js            # Year list, year CRUD
│   │   └── months.js           # Month data, expenses
│   ├── storage/                # Storage layer
│   │   ├── categories.js       # Category storage operations
│   │   └── years.js            # Year/Month JSONL operations
│   └── data/                   # JSON/JSONL storage
│   │   ├── categories.json     # Global categories config
│   │   └── .gitkeep
├── frontend/                    # React SPA
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx             # Router setup
│   │   ├── components/
│   │   │   ├── CategoriesManager.jsx  # Category management page
│   │   │   ├── ColorPicker.jsx        # Color picker component
│   │   │   ├── CategoryBadge.jsx      # Category display with color
│   │   │   ├── YearsList.jsx          # Years list page
│   │   │   ├── YearView.jsx           # Year grid page
│   │   │   ├── MonthView.jsx          # Month detail page
│   │   │   ├── ExpenseForm.jsx        # Add/edit expense form
│   │   │   ├── ExpenseList.jsx        # Sortable expense table
│   │   │   └── CategoryBreakdown.jsx  # Category summary with colors
│   │   └── api.js              # Backend API client
│   └── nginx.conf              # Production nginx config
└── ansible/                     # Deployment automation
    ├── playbooks/
    │   └── deploy-expense-tracker.yml
    └── roles/
        └── expense-tracker/
            ├── handlers/
            ├── tasks/
            └── templates/
```

## Development Phases

### Phase 1: Project Setup & Docker
- [ ] Set up file structure (backend/, frontend/, ansible/)
- [ ] Create backend package.json, basic Express server
- [ ] Create frontend package.json, Vite + React setup
- [ ] Write Dockerfile.backend (Node:18-alpine)
- [ ] Write Dockerfile.frontend (multi-stage: build → nginx)
- [ ] Write docker-compose.yml (dev mode with hot-reload)
- [ ] Test local dev environment works

### Phase 2: Backend API & Storage (Categories + Years)
- [ ] Implement categories.json storage with default categories
- [ ] Build category API endpoints (CRUD)
- [ ] Implement JSONL storage layer (read/write year files)
- [ ] Build API endpoints: years list, year creation
- [ ] Build API endpoints: month data, income update
- [ ] Build API endpoints: add/delete/update expenses
- [ ] Build category grouping endpoint for analytics
- [ ] Test all endpoints with curl/httpie

### Phase 3: Frontend - Categories Management
- [ ] Build CategoriesManager component
- [ ] Color picker component (preset palette + custom hex)
- [ ] Category list with inline editing
- [ ] Add/Delete category forms
- [ ] Expense count display per category
- [ ] Protect delete when expenses exist

### Phase 4: Frontend - Month Page with Category Colors
- [ ] Set up React Router (Years → Year → Month → Categories)
- [ ] Build MonthView component
- [ ] Expense list with category color badges
- [ ] Category dropdown with color swatches
- [ ] Expense sorting (day/category) with resolved names
- [ ] Category breakdown summary with colors
- [ ] Income input & remainder calculation display
- [ ] Add/Edit/Delete expense functionality
- [ ] Connect to backend API

### Phase 5: Frontend - Year & Years Pages
- [ ] Build YearsList component (home page)
- [ ] Build YearView component (12-month grid)
- [ ] Monthly summary cards (income/expenses/remainder)
- [ ] Top category indicators on month cards
- [ ] Navigation between months
- [ ] "Add new year" functionality
- [ ] Styling and UX polish

### Phase 6: Production Docker & Ansible
- [ ] Write docker-compose.prod.yml
- [ ] Write frontend/nginx.conf for SPA routing
- [ ] Create Ansible role structure
- [ ] Write Ansible playbook for deployment
- [ ] Test deployment to cori_celesti

## Notes
- Keep it simple and functional
- Focus on data integrity (JSONL format)
- Mobile-friendly responsive design
- No external dependencies for core functionality (vanilla JS)
