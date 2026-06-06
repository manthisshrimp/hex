# Task Board — Implementation Plan

Follows the standard octiron dev process: plan → implement → test API → test UI.

## Prerequisites

```bash
git pull
```

---

## Step 1 — Scaffold Directory Structure

Create the following layout (mirrors calendar-site):

```
task-board/
├── SPEC.md
├── PLAN.md
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── tasks.js
│   │   ├── admin.js
│   │   └── permissions.js
│   └── storage.js
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── nginx.conf
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js
│       ├── index.css
│       ├── components/
│       │   ├── AdminAuth.jsx      (login screen)
│       │   ├── Sidebar.jsx
│       │   ├── TaskList.jsx
│       │   ├── TaskItem.jsx
│       │   └── TaskForm.jsx       (modal)
│       └── pages/
│           ├── MyTasksPage.jsx
│           ├── UserTasksPage.jsx
│           └── AdminPage.jsx
├── data/                          (gitignored, Docker volume)
├── Dockerfile.backend
├── Dockerfile.dev.frontend
├── Dockerfile.frontend
├── docker-compose.yml             (dev)
├── docker-compose.prod.yml        (prod)
└── ansible/
    ├── ansible.cfg
    ├── inventory
    └── playbooks/
        └── deploy-task-board.yml
```

---

## Step 2 — Backend

### 2a. `backend/package.json`

```json
{
  "name": "task-board-backend",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

### 2b. `backend/middleware/auth.js`

Multi-user auth middleware:

- On startup: scan `/root/` for `.tasks-*.pwd` files, build `username → token` map
- Token = `sha256(username + ":" + password)`
- `initPasswords()` — reads all pwd files, builds token map; also reads `data/users.json` to sync known users
- `authMiddleware(req, res, next)` — validates `X-Auth-Token` header, attaches `req.user = { username, isAdmin }`
- `reloadPasswords()` — re-reads all pwd files (call after creating/resetting a user)
- `createUserPassword(username, password)` — writes `/root/.tasks-<username>.pwd`, calls `reloadPasswords()`
- `deleteUserPassword(username)` — removes `/root/.tasks-<username>.pwd`, calls `reloadPasswords()`
- `generatePassword()` — returns a random 12-char alphanumeric string

Exported: `{ initPasswords, authMiddleware, reloadPasswords, createUserPassword, deleteUserPassword, generatePassword }`

### 2c. `backend/storage.js`

JSONL + JSON helpers:

```js
// Tasks — JSONL
readTasks()          → Task[]          // reads data/tasks.jsonl
writeTasks(tasks)    → void            // rewrites data/tasks.jsonl
appendTask(task)     → void            // appends one line

// Users — JSON
readUsers()          → { users: User[] }
writeUsers(data)     → void

// Permissions — JSON
readPermissions()    → { grants: Grant[] }
writePermissions(data) → void
```

Data directory: `process.env.DATA_PATH || path.join(__dirname, '../data')`

### 2d. `backend/routes/tasks.js`

All routes mounted at `/api/tasks`.

Access check helper:
```js
function canAccess(caller, targetUsername, permissions) {
  if (caller.isAdmin) return true;
  if (caller.username === targetUsername) return true;
  return permissions.grants.some(
    g => g.grantee === caller.username && g.owner === targetUsername
  );
}
```

Routes:
- `GET /:username` — return tasks filtered by `ownerUsername === username`; 403 if no access
- `POST /:username` — create task with `ownerUsername = username`; 403 if no access
- `PUT /:username/:id` — update task; 403 if no access; 404 if not found
- `DELETE /:username/:id` — delete task; 403 if no access; 404 if not found

### 2e. `backend/routes/admin.js`

Mounted at `/api/admin`. All routes require `req.user.isAdmin` (403 otherwise).

Users sub-routes:
- `GET /users` — return `readUsers().users` with `hasPasswordFile` flag (check if `/root/.tasks-<username>.pwd` exists)
- `POST /users` — validate unique username, call `createUserPassword(username, password || generatePassword())`, append to `users.json` → return `{ username, password }`
- `DELETE /users/:username` — cannot delete `admin`; remove from `users.json`, delete pwd file, delete their tasks from JSONL; return `{ success: true }`
- `POST /users/:username/reset-password` — generate new password, call `createUserPassword()` → return `{ password }`

### 2f. `backend/routes/permissions.js`

Mounted at `/api/admin`. All routes require `req.user.isAdmin`.

- `GET /permissions` — return `readPermissions()`
- `POST /permissions` — add grant `{ grantee, owner }`; no-op if already exists; validate both usernames exist
- `DELETE /permissions` — remove grant `{ grantee, owner }` from body

### 2g. `backend/server.js`

```js
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { initPasswords, authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

initPasswords();

app.use(cors({ origin: ['http://localhost:5178', 'http://localhost:8080'], credentials: true }));
app.use(express.json());
app.use(authMiddleware);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/auth', (req, res) => {
  // validate username+password, return { token, username, isAdmin }
});

app.get('/api/auth/me', (req, res) => {
  // return { username, isAdmin, canAccess: string[] }
});

app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/admin', require('./routes/admin'));
// permissions routes are also under /api/admin

app.use((err, req, res, next) => res.status(500).json({ error: 'Something went wrong' }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

---

## Step 3 — Frontend

### 3a. `frontend/package.json`

```json
{
  "name": "task-board-frontend",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.1.0",
    "vite-plugin-pwa": "^0.19.0"
  }
}
```

### 3b. `frontend/vite.config.js`

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Task Board',
        short_name: 'Tasks',
        description: 'Family task management',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/[^/]+\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5178,
    proxy: { '/api': 'http://backend:3000' },
  },
});
```

Place placeholder icon files in `frontend/public/`: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.svg`. These can be simple solid-colour squares until real assets are designed.

### 3c. `frontend/src/api.js`

```js
let _token = null;
let _username = null;
let _onAuthFailure = null;

export function setAuthToken(token, username) { _token = token; _username = username; }
export function setAuthFailureHandler(fn) { _onAuthFailure = fn; }

async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (_token) { headers['X-Auth-Token'] = _token; headers['X-Username'] = _username; }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    if (res.status === 401 && _onAuthFailure) _onAuthFailure();
    throw new Error('Unauthorized');
  }
  return res;
}

// Auth
export async function login(username, password) { ... }
export async function fetchMe() { ... }

// Tasks
export async function fetchTasks(username) { ... }
export async function createTask(username, data) { ... }
export async function updateTask(username, id, data) { ... }
export async function deleteTask(username, id) { ... }

// Admin — users
export async function fetchAdminUsers() { ... }
export async function createUser(username, password) { ... }
export async function deleteUser(username) { ... }
export async function resetPassword(username) { ... }

// Admin — permissions
export async function fetchPermissions() { ... }
export async function addGrant(grantee, owner) { ... }
export async function removeGrant(grantee, owner) { ... }
```

### 3d. `frontend/src/App.jsx`

State: `{ token, username, isAdmin, canAccess, loading }`

- On mount: read `localStorage.tasksAuthToken` and `localStorage.tasksUsername`, call `fetchMe()` to validate + hydrate `canAccess`
- If not authenticated: render `<LoginPage />`
- If authenticated: render router with sidebar layout

Routes:
```
/          → <MyTasksPage />
/tasks/:username  → <UserTasksPage />
/admin     → <AdminPage />  (redirect to / if !isAdmin)
```

### 3e. `frontend/src/components/AdminAuth.jsx` (Login Page)

- Username input + Password input
- On submit: call `login()`, store token + username in localStorage, update App state
- Show error message on 403

### 3f. `frontend/src/components/Sidebar.jsx`

- "My Tasks" link → `/`
- For each username in `canAccess`: link → `/tasks/:username`
- "Admin" link → `/admin` (only if isAdmin)
- Current user display + Logout button (clears localStorage, resets state)

### 3g. `frontend/src/components/TaskList.jsx`

Props: `{ username, tasks, onAdd, onEdit, onDelete, onStatusChange }`

- Filter bar: All / Todo / In Progress / Done
- Sort control: Due Date / Priority / Created
- "+ Add Task" button → opens TaskForm in create mode
- Maps tasks through filter/sort → renders `<TaskItem />`
- Empty state: "No tasks yet — add one above"

### 3h. `frontend/src/components/TaskItem.jsx`

Props: `{ task, onEdit, onDelete, onStatusChange }`

- Status toggle: clicking the circle cycles todo → in_progress → done
- Priority badge: LOW (gray) / MED (amber) / HIGH (red)
- Due date: shown in red if past due and status !== done
- Expandable description
- Edit (pencil) + Delete (trash) icon buttons

### 3i. `frontend/src/components/TaskForm.jsx`

Modal overlay. Props: `{ task (null = create), onSave, onClose }`

Fields: title (text), description (textarea), status (select), priority (select), dueDate (date)

- Validates title is non-empty
- ESC closes
- Submit button disabled while saving

### 3j. Pages

**`MyTasksPage.jsx`**
- Calls `fetchTasks(currentUsername)` on mount
- Renders `<TaskList username={currentUsername} ... />`

**`UserTasksPage.jsx`**
- Reads `:username` from params; redirects to `/` if not in `canAccess && !isAdmin`
- Calls `fetchTasks(username)` on mount
- Renders `<TaskList username={username} ... />` with "Tasks — [username]" heading

**`AdminPage.jsx`**
- Two tabs: Users | Access
- Users tab: table of users (username, isAdmin flag, hasPasswordFile), Create User form, Reset Password button (shows generated password in a copy-able modal), Delete User button
- Access tab: table of grants (grantee → owner), Add Grant form (two selects), Remove button per row

---

## Step 4 — Docker

### `Dockerfile.backend`

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
EXPOSE 3000
CMD ["node", "server.js"]
```

### `Dockerfile.dev.frontend`

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
EXPOSE 5178
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5178"]
```

### `Dockerfile.frontend` (prod)

```dockerfile
FROM node:18 AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### `frontend/nginx.conf`

```nginx
server {
  listen 80;
  server_name localhost;
  root /usr/share/nginx/html;
  index index.html;

  # Service worker must never be cached by nginx or the browser
  location = /sw.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    try_files $uri =404;
  }

  location /api/ {
    proxy_pass http://backend:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### `docker-compose.yml` (dev)

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: task-board-backend
    ports:
      - "3008:3000"
    volumes:
      - ./data:/data
      - ./backend:/app
    environment:
      - PORT=3000
      - DATA_PATH=/data
    command: npm run dev

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.dev.frontend
    container_name: task-board-frontend
    ports:
      - "5178:5178"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:3000/api
    command: npm run dev
```

### `docker-compose.prod.yml`

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: task-board-backend
    restart: always
    environment:
      - PORT=3000
      - DATA_PATH=/data
    volumes:
      - /home/aldus/app_data/tasks:/data
      - /root/.tasks-admin.pwd:/root/.tasks-admin.pwd:ro
    networks:
      - task-network
    ports:
      - "3008:3000"

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: task-board-frontend
    restart: always
    ports:
      - "5178:80"
    networks:
      - task-network
    depends_on:
      - backend

networks:
  task-network:
    driver: bridge
```

Note: password files for regular users are NOT bind-mounted in prod compose — the backend reads them directly from `/root/` which is available because the container runs as root and `/root` is the same on the host. If running rootless Docker, adjust accordingly.

Actually, to keep it simple and consistent with how the calendar app handles this: mount `/root` as a directory is not practical. Instead, the admin panel's "create user" API endpoint writes the password file inside the container (to `/root/.tasks-<username>.pwd`) and since `/root` is not a Docker volume, these files will be lost on container restart. 

**Revised approach:** Mount the entire `/root/` tasks password directory as a Docker volume or use a dedicated subdirectory.

**Final decision:** Store all task password files in `/data/passwords/` (inside the data volume, which IS persisted):
- Admin pwd: `/data/passwords/admin.pwd`
- User pwds: `/data/passwords/<username>.pwd`

Update `middleware/auth.js` to read from `DATA_PATH/passwords/`.

Update `docker-compose.prod.yml` to NOT need individual bind mounts for pwd files (they live inside the data volume).

The Ansible playbook seeds the admin password file into `/home/aldus/app_data/tasks/passwords/admin.pwd` if absent.

---

## Step 5 — Ansible

### `ansible/inventory`

```ini
[vault_108]
vault_108 ansible_python_interpreter=/usr/bin/python3

[vault_108:vars]
app_dir=/opt/task-board
data_dir=/home/aldus/app_data/tasks
passwords_dir=/home/aldus/app_data/tasks/passwords
app_user=root
app_group=root
```

### `ansible/playbooks/deploy-task-board.yml`

Tasks:
1. Ensure Docker service running
2. Create `app_dir`
3. Create `data_dir`
4. Create `passwords_dir`
5. Check if `passwords_dir/admin.pwd` is a directory (Docker artefact) → remove if so
6. Create `passwords_dir/admin.pwd` with content `changeme123` and `force: no` (do not overwrite existing)
7. Set mode 0600 on admin.pwd
8. Sync code via `synchronize` (rsync), excluding node_modules, .git, ansible, data
9. Stop existing containers
10. Build and start containers
11. Health check: `GET http://localhost:3008/health` (retry 15×, delay 3s)
12. Verify frontend: `GET http://localhost:5178`
13. Display success message with URLs

---

## Step 6 — nginx / cori_celesti

Add a new server block (or Ansible task) on `cori_celesti` to proxy `tasks.dijibringabeeralong.co.za` to `vault_108:5178`.

If the existing `cori_celesti` playbook manages nginx via a template, add a new vhost entry. If managed via individual files, add `tasks.dijibringabeeralong.co.za.conf`.

Backend API calls go through the nginx frontend container (see `nginx.conf` above which proxies `/api/` to the backend container).

---

## Step 7 — Verification Checklist

### API tests (curl)

```bash
# Health
curl -s http://localhost:3008/health

# Login as admin
TOKEN=$(curl -s -X POST http://localhost:3008/api/auth \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"changeme123"}' | jq -r .token)

echo "Token: $TOKEN"

# Get current user
curl -s http://localhost:3008/api/auth/me \
  -H "X-Auth-Token: $TOKEN" -H "X-Username: admin"

# Create a user
curl -s -X POST http://localhost:3008/api/admin/users \
  -H 'Content-Type: application/json' \
  -H "X-Auth-Token: $TOKEN" -H "X-Username: admin" \
  -d '{"username":"alice"}'

# List users
curl -s http://localhost:3008/api/admin/users \
  -H "X-Auth-Token: $TOKEN" -H "X-Username: admin"

# Create a task for alice (as admin)
curl -s -X POST http://localhost:3008/api/tasks/alice \
  -H 'Content-Type: application/json' \
  -H "X-Auth-Token: $TOKEN" -H "X-Username: admin" \
  -d '{"title":"Do the laundry","priority":"high","status":"todo"}'

# List alice's tasks
curl -s http://localhost:3008/api/tasks/alice \
  -H "X-Auth-Token: $TOKEN" -H "X-Username: admin"

# Login as alice (use password from create response)
ALICE_TOKEN=$(curl -s -X POST http://localhost:3008/api/auth \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"<generated>"}' | jq -r .token)

# Alice tries to access admin's tasks — should 403
curl -s http://localhost:3008/api/tasks/admin \
  -H "X-Auth-Token: $ALICE_TOKEN" -H "X-Username: alice"

# Grant alice access to bob's tasks
curl -s -X POST http://localhost:3008/api/admin/permissions \
  -H 'Content-Type: application/json' \
  -H "X-Auth-Token: $TOKEN" -H "X-Username: admin" \
  -d '{"grantee":"alice","owner":"bob"}'
```

### UI tests (dev-browser)

```bash
dev-browser --headless <<'EOF'
const page = browser.getPage("main");
page.goto("http://localhost:5178");
saveScreenshot(await page.screenshot(), "01-login.png");

// Login as admin
page.locator('input[name="username"]').fill("admin");
page.locator('input[name="password"]').fill("changeme123");
page.locator('button[type="submit"]').click();
await page.waitForNavigation();
saveScreenshot(await page.screenshot(), "02-my-tasks.png");

// Go to admin panel
page.locator('a[href="/admin"]').click();
saveScreenshot(await page.screenshot(), "03-admin.png");
EOF
```

---

## Implementation Order

Execute steps in this order, testing after each backend and frontend section:

1. `[ ]` Scaffold directory (mkdir, empty files)
2. `[ ]` Backend: package.json, storage.js, auth middleware
3. `[ ]` Backend: server.js + /api/auth + /api/auth/me
4. `[ ]` Backend: tasks routes
5. `[ ]` Backend: admin routes (users + permissions)
6. `[ ]` Docker: Dockerfile.backend, docker-compose.yml
7. `[ ]` Test: `docker compose up --build` + curl API tests
8. `[ ]` Frontend: package.json, vite.config.js (with VitePWA), index.html
9. `[ ]` Frontend: PWA assets — icon-192.png, icon-512.png, apple-touch-icon.png, favicon.svg in `frontend/public/`
10. `[ ]` Frontend: api.js, App.jsx, AdminAuth.jsx (login)
11. `[ ]` Frontend: Sidebar, TaskList, TaskItem, TaskForm components
12. `[ ]` Frontend: MyTasksPage, UserTasksPage, AdminPage
13. `[ ]` Docker: Dockerfile.dev.frontend — add to docker-compose.yml
14. `[ ]` Test: full stack UI with dev-browser
15. `[ ]` Docker: Dockerfile.frontend (prod) with nginx.conf (sw.js no-cache header), docker-compose.prod.yml
16. `[ ]` Verify PWA: `npm run build` → check `dist/sw.js` generated; open in browser → check "Install" prompt in address bar
17. `[ ]` Ansible: inventory, deploy-task-board.yml
18. `[ ]` (Optional) cori_celesti nginx vhost for tasks.dijibringabeeralong.co.za
