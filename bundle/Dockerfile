# syntax=docker/dockerfile:1.4
# octiron-bundle: all 6 personal apps in one container

# ── Shared Rust builder base ─────────────────────────────────────────────────
FROM rust:1.94-slim AS rust-base
RUN apt-get update && apt-get install -y pkg-config libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# ── Calendar backend ─────────────────────────────────────────────────────────
FROM rust-base AS build-calendar-backend
WORKDIR /app
COPY calendar-site/backend-rust/Cargo.toml ./
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    mkdir src && echo "fn main() {}" > src/main.rs && echo "" > src/lib.rs && \
    cargo build --release && rm -rf src
COPY calendar-site/backend-rust/src ./src
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    touch src/main.rs src/lib.rs && cargo build --release

# ── Expense-tracker backend ──────────────────────────────────────────────────
FROM rust-base AS build-expense-backend
WORKDIR /app
COPY expense-tracker/backend-rust/Cargo.toml ./
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    mkdir src && echo "fn main() {}" > src/main.rs && \
    cargo build --release && rm -rf src
COPY expense-tracker/backend-rust/src ./src
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    touch src/main.rs && cargo build --release

# ── Inventory backend ────────────────────────────────────────────────────────
FROM rust-base AS build-inventory-backend
WORKDIR /app
COPY inventory/backend-rust/Cargo.toml ./
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    mkdir src && echo "fn main() {}" > src/main.rs && echo "" > src/lib.rs && \
    cargo build --release && rm -rf src
COPY inventory/backend-rust/src ./src
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    touch src/main.rs src/lib.rs && cargo build --release

# ── Habits backend ───────────────────────────────────────────────────────────
FROM rust-base AS build-habits-backend
WORKDIR /app
COPY habits/backend-rust/Cargo.toml ./
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    mkdir src && echo "fn main() {}" > src/main.rs && \
    cargo build --release && rm -rf src
COPY habits/backend-rust/src ./src
COPY habits/backend-rust/items.json ./items.json
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    touch src/main.rs && cargo build --release

# ── Mood-tracker backend (Node.js) ───────────────────────────────────────────
FROM node:20-slim AS build-mood-backend
WORKDIR /app
COPY mood-tracker/backend/package*.json ./
RUN npm ci --omit=dev
COPY mood-tracker/backend/ ./

# ── Task-board backend (Node.js) ─────────────────────────────────────────────
FROM node:20-slim AS build-task-backend
WORKDIR /app
COPY task-board/backend/package*.json ./
RUN npm install --omit=dev
COPY task-board/backend/ ./

# ── Calendar frontend ────────────────────────────────────────────────────────
FROM node:20 AS build-calendar-frontend
WORKDIR /app
COPY calendar-site/frontend/package*.json ./
RUN npm ci
COPY calendar-site/frontend/ ./
RUN npm run build

# ── Expense-tracker frontend ─────────────────────────────────────────────────
FROM node:20 AS build-expense-frontend
WORKDIR /app
COPY expense-tracker/frontend/package*.json ./
RUN npm install
COPY expense-tracker/frontend/ ./
RUN npm run build

# ── Inventory frontend ───────────────────────────────────────────────────────
FROM node:20 AS build-inventory-frontend
WORKDIR /app
COPY inventory/frontend/package*.json ./
RUN npm ci
COPY inventory/frontend/ ./
RUN npm run build

# ── Habits frontend ──────────────────────────────────────────────────────────
FROM node:20 AS build-habits-frontend
WORKDIR /app
COPY habits/frontend/package*.json ./
RUN npm ci
COPY habits/frontend/ ./
RUN npm run build

# ── Task-board frontend ──────────────────────────────────────────────────────
FROM node:20 AS build-task-frontend
WORKDIR /app
COPY task-board/frontend/package*.json ./
RUN npm install
COPY task-board/frontend/ ./
RUN npm run build

# ── Mood-tracker frontend ────────────────────────────────────────────────────
FROM node:20 AS build-mood-frontend
WORKDIR /app
COPY mood-tracker/frontend/package*.json ./
RUN npm ci
COPY mood-tracker/frontend/ ./
RUN npm run build

# ── Dashboard backend (Node.js) ──────────────────────────────────────────────
FROM node:20-slim AS build-dashboard-backend
WORKDIR /app
COPY bundle/dashboard-backend/package.json ./
RUN npm install --omit=dev
COPY bundle/dashboard-backend/ ./

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    nodejs \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Rust backends
COPY --from=build-calendar-backend  /app/target/release/calendar-backend       /usr/local/bin/
COPY --from=build-expense-backend   /app/target/release/expense-tracker-backend /usr/local/bin/
COPY --from=build-inventory-backend /app/target/release/inventory-backend       /usr/local/bin/
COPY --from=build-habits-backend    /app/target/release/habits-backend          /usr/local/bin/

# Node.js backends
COPY --from=build-mood-backend      /app /opt/mood-backend
COPY --from=build-task-backend      /app /opt/task-backend
COPY --from=build-dashboard-backend /app /opt/dashboard-backend

# Frontend static files
COPY --from=build-calendar-frontend  /app/dist /usr/share/nginx/html/calendar
COPY --from=build-expense-frontend   /app/dist /usr/share/nginx/html/expenses
COPY --from=build-inventory-frontend /app/dist /usr/share/nginx/html/inventory
COPY --from=build-habits-frontend    /app/dist /usr/share/nginx/html/habits
COPY --from=build-task-frontend      /app/dist /usr/share/nginx/html/todo
COPY --from=build-mood-frontend      /app/dist /usr/share/nginx/html/mood

# Config
COPY bundle/nginx.conf       /etc/nginx/nginx.conf
COPY bundle/supervisord.conf /etc/supervisor/conf.d/octiron.conf
COPY bundle/entrypoint.sh    /entrypoint.sh
COPY bundle/run-backend.sh   /usr/local/bin/run-backend.sh
RUN chmod +x /entrypoint.sh /usr/local/bin/run-backend.sh

VOLUME ["/data"]
EXPOSE 80

CMD ["/entrypoint.sh"]
