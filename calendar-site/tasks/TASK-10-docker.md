# Task 10: Docker Configuration

## Objective
Create Docker and docker-compose configurations for both development and production.

## Output Location
`octiron/calendar-site/`

## Deliverables

### 1. Dockerfile.backend
```dockerfile
# Multi-stage or simple Node image
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy source
COPY backend/ ./

# Data volume mount point
VOLUME /data

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_PATH=/data

EXPOSE 3000

CMD ["node", "server.js"]
```

### 2. Dockerfile.frontend
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Production stage - nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 3. docker-compose.yml (Development)
```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: calendar-backend
    ports:
      - "3000:3000"
    volumes:
      - ./backend/data:/data
      - ./backend:/app  # Mount for hot-reload
    environment:
      - NODE_ENV=development
      - DATA_PATH=/data
    command: npm run dev  # Use nodemon

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.dev.frontend  # Separate dev Dockerfile or override
    container_name: calendar-frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:3000/api
    command: npm run dev
```

### 4. docker-compose.prod.yml (Production)
```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: calendar-backend
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATA_PATH=/data
    volumes:
      - /data/calendar:/data
    networks:
      - calendar-network
    expose:
      - "3000"

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: calendar-frontend
    restart: always
    ports:
      - "8080:80"  # Map to 8080 on host
    networks:
      - calendar-network
    depends_on:
      - backend

networks:
  calendar-network:
    driver: bridge
```

### 5. frontend/nginx.conf
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to backend (if serving from same domain, optional)
    location /api/ {
        proxy_pass http://backend:3000/api/;
        proxy_http_version 1.1;
    }
}
```

### 6. .dockerignore
```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
```

## Success Criteria
- [ ] `docker-compose up` (dev) starts both services
- [ ] Dev: Backend hot-reloads on file changes
- [ ] Dev: Frontend HMR works (Vite)
- [ ] Dev: Frontend can reach backend API
- [ ] `docker-compose -f docker-compose.prod.yml up` (prod) works
- [ ] Prod: Frontend serves static build via nginx
- [ ] Prod: Backend persists data to volume
- [ ] No build errors in Docker

## Testing Commands
```bash
# Development
docker-compose up --build
# Test: http://localhost:3000/health (backend)
# Test: http://localhost:5173 (frontend)

# Production
docker-compose -f docker-compose.prod.yml up --build
# Test: http://localhost:8080 (frontend)
# Test: http://localhost:8080/api/health (backend via nginx proxy)
```

## Context from Spec
- Same Docker pattern as Expense Tracker
- Production uses nginx for frontend
- Data persistence via volume mount
- Dev uses volume mounts for hot reload

## Dependencies
- Task 1 (Backend Foundation) - needs server.js
- Task 4 (Frontend Setup) - needs frontend build

## Independent From
- API implementation details
- Components (Docker just serves files)
- Ansible deployment

## Blocks
- Task 11 (Ansible Deployment) - needs Docker setup
- Task 12 (Integration Testing) - needs working containers
