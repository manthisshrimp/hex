# Task Board — Specification

## Overview

A family task management application where an admin creates user accounts and assigns tasks. Each user sees only their own tasks by default. Admins can view and manage any user's tasks, and can grant regular users access to manage other users' task lists.

---

## Users & Roles

### Admin

- Can see and edit tasks for **all** users
- Can create and delete user accounts
- Can generate or reset a user's password
- Can grant any user access to any other user's task list
- Has a dedicated admin password file: `/root/.tasks-admin.pwd`

### Regular User

- Sees only their own tasks by default
- Can be granted access to other users' task lists by an admin
- If granted access to user B's list, can see and edit user B's tasks
- Cannot see the Admin panel

### Access Summary

| Who | Own tasks | Other user's tasks | Admin panel |
|-----|-----------|-------------------|-------------|
| Admin | Yes | Yes (all) | Yes |
| User (no grant) | Yes | No | No |
| User (granted for user B) | Yes | Yes (user B only) | No |

---

## Authentication

### Login

- Login screen collects `username` + `password`
- `POST /api/auth` with `{ username, password }` returns `{ token, username, isAdmin }`
- Token = `sha256("username:password")` — unique per user
- Token is stored in `localStorage` as `tasksAuthToken`
- All protected requests send `X-Auth-Token: <token>` and `X-Username: <username>` headers

### Password Files

- One file per user: `/root/.tasks-<username>.pwd`
- Admin file: `/root/.tasks-admin.pwd`
- Files contain the plaintext password (chmod 600)
- Backend reads all password files on startup, caches `username → sha256(username:password)` map
- Backend watches the password directory for changes and reloads on file changes

### Auth Middleware

- Exempt: `GET /health`, `POST /api/auth`
- All other routes: validate `X-Auth-Token` header, attach resolved `req.user = { username, isAdmin }`
- Return 401 if token missing, 403 if token invalid

---

## Data Model

### Task

```typescript
interface Task {
  id: string;            // UUID
  ownerUsername: string; // username of the task's owner
  title: string;         // required
  description?: string;  // optional markdown-ish text
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;      // YYYY-MM-DD
  createdAt: string;     // ISO timestamp
  updatedAt: string;     // ISO timestamp
  completedAt?: string;  // ISO timestamp, set when status → done
}
```

### User Registry

`data/users.json` — list of known usernames and their admin flag:

```json
{
  "users": [
    { "username": "admin", "isAdmin": true },
    { "username": "alice", "isAdmin": false },
    { "username": "bob", "isAdmin": false }
  ]
}
```

Admin can only set/clear `isAdmin` for non-admin usernames. The `admin` account cannot lose its admin flag.

### Permissions

`data/permissions.json` — which users can access which other users' task lists:

```json
{
  "grants": [
    { "grantee": "alice", "owner": "bob" }
  ]
}
```

This means alice can see/edit bob's task list. Admins always have implicit access to all lists — no grants needed.

---

## Storage

- `data/tasks.jsonl` — one task JSON object per line; append on create, rewrite on update/delete
- `data/users.json` — user registry (JSON)
- `data/permissions.json` — access grants (JSON)

---

## API

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth` | None | Login → `{ token, username, isAdmin }` |
| `GET` | `/api/auth/me` | Yes | Current session info → `{ username, isAdmin, canAccess: string[] }` |

### Tasks

All task routes are scoped by a `username` path segment. The backend enforces that the caller has access to that username's tasks.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/tasks/:username` | Yes | All tasks for a user → `{ tasks: Task[] }` |
| `POST` | `/api/tasks/:username` | Yes | Create task → `Task` |
| `PUT` | `/api/tasks/:username/:id` | Yes | Update task → `Task` |
| `DELETE` | `/api/tasks/:username/:id` | Yes | Delete task → `{ success: true }` |

Access check for task routes: caller must be admin OR caller.username === `:username` OR a grant exists for `{ grantee: caller.username, owner: :username }`.

### Users (Admin only)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/users` | Admin | All users → `{ users: User[] }` |
| `POST` | `/api/admin/users` | Admin | Create user → `{ username, password }` (auto-generates password if not provided) |
| `DELETE` | `/api/admin/users/:username` | Admin | Delete user + their tasks |
| `POST` | `/api/admin/users/:username/reset-password` | Admin | Generate new password → `{ password }` |

### Permissions (Admin only)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/permissions` | Admin | All grants → `{ grants }` |
| `POST` | `/api/admin/permissions` | Admin | Add grant → `{ grantee, owner }` |
| `DELETE` | `/api/admin/permissions` | Admin | Remove grant → `{ grantee, owner }` |

### Health

`GET /health` → `{ status: "ok" }`

---

## Frontend Pages

### Login Page (`/login`)

- Username + Password fields
- On success: redirects to `/`
- On failure: shows "Invalid username or password"

### My Tasks (`/`)

- Default landing after login
- Shows the logged-in user's own task list
- TaskList + TaskForm

### User Tasks (`/tasks/:username`)

- Shows another user's task list (only accessible if the viewer has access)
- Same TaskList + TaskForm UI
- Title shows "Tasks — [username]"
- Sidebar/nav shows the logged-in user + links to accessible users

### Admin Panel (`/admin`)

- Only accessible if `isAdmin === true`
- Tabs:
  1. **Users** — list users, create user, delete user, reset password (shows generated password in a modal)
  2. **Access** — list grants, add grant (select grantee + owner), remove grant

---

## Layout

### Desktop (>768px)

```
┌────────────────────────────────────────────────────────┐
│  Task Board                          [username] [logout] │
├──────────────┬─────────────────────────────────────────┤
│              │                                          │
│  SIDEBAR     │  TASK LIST                               │
│              │                                          │
│  My Tasks    │  ┌──────────────────────────────────┐   │
│  ─────────── │  │ [+ Add Task]                     │   │
│  alice       │  ├──────────────────────────────────┤   │
│  bob         │  │ ● Do the laundry          HIGH   │   │
│              │  │   due 2026-04-20          todo   │   │
│  [Admin ▸]  │  ├──────────────────────────────────┤   │
│              │  │ ● Fix the gate            MED    │   │
│              │  │   due 2026-04-22          todo   │   │
│              │  └──────────────────────────────────┘   │
└──────────────┴─────────────────────────────────────────┘
```

Sidebar items:
- "My Tasks" → `/` (always visible)
- Each username the current user can access → `/tasks/:username`
- "Admin" → `/admin` (only if isAdmin)

### Mobile (≤768px)

- Hamburger menu replaces sidebar
- Task list takes full width
- Task form is a modal overlay

---

## Task List UI

### Task Item

Displays:
- Status indicator (circle: empty = todo, half = in_progress, check = done)
- Title
- Priority badge (LOW / MED / HIGH) with color (gray / amber / red)
- Due date (red if overdue)
- Description (collapsed, click to expand)
- Edit button (pencil icon)
- Delete button (trash icon)

### Filters & Sorting

- Filter by status: All / Todo / In Progress / Done
- Sort by: Due Date (default, ascending, nulls last) / Priority / Created

### Task Form (modal)

Fields:
- Title (required)
- Description (optional textarea)
- Status (select: todo / in_progress / done)
- Priority (select: low / medium / high)
- Due Date (date picker, optional)

Behaviour:
- ESC cancels
- Enter submits when focus not in textarea
- Opens in "create" mode from "+ Add Task" button
- Opens in "edit" mode from pencil icon

---

## Tech Stack

- **Backend:** Node.js + Express, JSONL/JSON storage, `uuid`, `crypto`
- **Frontend:** React 18, Vite, React Router v6, `vite-plugin-pwa` (Workbox)
- **Deployment:** Docker Compose (dev + prod), Ansible (rsync + rebuild)
- **Host:** `vault_108` (same host as calendar-site and expense-tracker)
- **Backend port (host):** 3009
- **Frontend port (host):** 5179

---

## PWA

The app is installable as a Progressive Web App for mobile home-screen use.

- `vite-plugin-pwa` generates the service worker at build time
- Strategy: `autoUpdate` — new versions activate on next load without a prompt
- **App shell** (JS, CSS, HTML, icons) is precached by Workbox
- **API calls** use `NetworkFirst` with a 5-second timeout and a 24-hour fallback cache — tasks load from cache when offline
- nginx serves `sw.js` with `Cache-Control: no-cache, no-store, must-revalidate` so clients always fetch the latest service worker
- Manifest:
  - `name`: "Task Board"
  - `short_name`: "Tasks"
  - `display`: `standalone`
  - `orientation`: `portrait`
  - `start_url`: `/`
  - `theme_color` / `background_color`: dark neutral (e.g. `#111827`)
  - Icons: `icon-192.png` and `icon-512.png` (maskable) placed in `frontend/public/`
- `apple-touch-icon.png` in `frontend/public/` for iOS "Add to Home Screen"

---

## Ports

| Service | Container port | Host port |
|---------|---------------|-----------|
| backend | 3000 | 3009 |
| frontend (dev) | 5178 | 5179 |
| frontend (prod) | 80 | 5179 |

---

## Deployment

- App directory on host: `/opt/task-board`
- Data directory on host: `/home/aldus/app_data/tasks`
- Password files on host: `/root/.tasks-<username>.pwd`
- Admin password file: `/root/.tasks-admin.pwd`
- Public URL: `todo.dijibringabeeralong.co.za`

---

## Out of Scope (v2)

- Offline task creation (currently read-only when offline)
- Push notifications
- Task comments / activity log
- File attachments
- Recurring tasks
- Email/push notifications
- Dark mode
- Task categories/labels
- Drag-and-drop reordering
