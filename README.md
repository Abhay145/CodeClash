<h1 align="center">
  <br>
  ⚔️ CodeDuel
  <br>
</h1>

<p align="center">
  <strong>A real-time competitive coding platform where developers battle head-to-head, solving algorithmic challenges under time pressure with live ELO ranking.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Socket.IO-4.x-010101?style=for-the-badge&logo=socket.io&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" />
  <img src="https://img.shields.io/badge/Redis-BullMQ-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
</p>

---

## 📸 Screenshots & Demo

> 🚧 **Screenshots and demo videos coming soon!**

<!-- 
  Add screenshots here like this:
  ![Landing Page](./assets/screenshots/landing.png)
  ![Duel Arena](./assets/screenshots/duel.png)
  ![Results Screen](./assets/screenshots/results.png)

  Add a demo video like this:
  [![Demo Video](./assets/screenshots/thumbnail.png)](./assets/demo.mp4)
-->

---

## 🎯 What is CodeDuel?

CodeDuel is a **full-stack, distributed competitive programming platform** inspired by LeetCode but built for real-time 1v1 duels. Two developers are matched by ELO rating, given the same algorithmic problem, and race to solve it correctly — faster than their opponent. Submissions are compiled and judged server-side, and the winner earns ELO.

### Core User Flows

- **Casual Duel** → Create a private room with a 6-char code, share it with a friend, and fight.
- **Ranked Match** → Enter the matchmaking queue and get paired with a player within ±200 ELO.
- **Practice Mode** → Solve problems solo at your own pace without pressure.
- **Match History** → Review all past duels, scores, and code submissions.

---

## 🏗️ Architecture

CodeDuel is built as **4 independent microservices** that communicate via REST APIs, WebSockets, and a Redis message queue.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                           │
│                    React 19 + Monaco Editor                     │
└────────────────────┬────────────────────┬───────────────────────┘
                     │  REST (HTTP)        │  WebSocket
          ┌──────────▼──────────┐  ┌──────▼──────────────┐
          │   Code_Duel_B       │  │   Realtime_Server    │
          │   (Backend API)     │  │   (Socket.IO)        │
          │   Express + Firebase│  │   Matchmaking        │
          │   Auth, Rooms,      │  │   Live game events   │
          │   Problems, Users   │  │   ELO Queue Worker   │
          └──────────┬──────────┘  └──────┬───────────────┘
                     │                    │
          ┌──────────▼────────────────────▼───────────────┐
          │               Firebase Firestore               │
          │   users · rooms · problems · submissions       │
          └───────────────────────────────────────────────┘
                     │                    │
          ┌──────────▼──────────┐  ┌──────▼───────────────┐
          │  Compiler_Server    │  │       Redis           │
          │  BullMQ Job Queue   │  │  Matchmaking Queue   │
          │  Sandbox Execution  │  │  Online Users Map    │
          │  Python·C·C++·Java  │  │  BullMQ Queues       │
          └─────────────────────┘  └──────────────────────┘
```

---

## 📁 Repository Structure

```
CodeDuel/
├── Code_Duel_F/          # React 19 Frontend (Vite)
├── Code_Duel_B/          # Backend REST API (Express 5)
├── Realtime_Server/      # WebSocket + Matchmaking Server (Socket.IO)
├── Compiler_Server/      # Sandboxed Code Execution Service
└── firestore.rules       # Firebase Security Rules
```

---

## ✨ Features

### 🎮 Gameplay
- **1v1 Real-time Duels** — both players code in their own Monaco editor instances, synced by live progress updates via WebSocket
- **Private Rooms** — create a room with a unique 6-character alphanumeric code to challenge a specific friend
- **Ranked Matchmaking** — ELO-based queue that pairs players within a ±200 rating window; uses a Redis Sorted Set for O(log n) operations

### ⚙️ Code Execution
- **Multi-language Support** — Python, C, C++, and Java
- **Async Job Queue** — submissions are processed via BullMQ workers so the HTTP response is never blocked
- **Sandboxed Judging** — each submission compiles in a temporary directory, runs against hidden test cases, and the directory is cleaned up after evaluation
- **Verdicts** — Accepted, Wrong Answer, Time Limit Exceeded, Compilation Error, Runtime Error

### 🏆 Ranking & History
- **ELO Rating System** — after every match, the winner gains ELO and the loser loses ELO, processed asynchronously via a BullMQ result worker
- **Match History** — full archive of every duel with scores, test cases passed, and best submitted code
- **Submission Viewer** — browse all submissions per problem with verdicts and timestamps

### 🔐 Security
- **Firebase Auth** — JWT-based authentication on every protected API route
- **Internal Service Auth** — inter-service calls (e.g. Realtime Server → Backend) are protected by a shared secret header (`x-internal-secret`)
- **Firestore Security Rules** — database access enforced at the platform level

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, TailwindCSS 4, Monaco Editor, React Router 7 |
| **Backend API** | Express 5, Firebase Admin SDK, Zod (validation) |
| **Realtime Server** | Socket.IO 4, Redis (ioredis), BullMQ |
| **Compiler Server** | Node.js, BullMQ, child_process (spawn), Firebase Admin |
| **Database** | Firebase Firestore |
| **Cache / Queue** | Redis, BullMQ |
| **Auth** | Firebase Authentication (JWT) |
| **Container** | Docker, Docker Compose |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- Redis (local or Docker)
- Firebase project with Firestore enabled
- Compilers installed on the Compiler Server host: `g++`, `gcc`, `python3`, `javac`/`java`

### 1. Clone the Repo

```bash
git clone https://github.com/ShubhamY90/CodeDuel.git
cd CodeDuel
```

### 2. Environment Variables

Each service needs its own `.env` file. Copy the provided examples:

```bash
cp Code_Duel_B/.env.example    Code_Duel_B/.env
cp Compiler_Server/.env.example Compiler_Server/.env
```

> ⚠️ You will need your own Firebase service account JSON and project credentials.

#### `Code_Duel_B/.env`
```env
PORT=5001
FIREBASE_SERVICE_ACCOUNT=<base64 encoded service account JSON>
INTERNAL_SECRET=<shared secret for inter-service auth>
COMPILER_SERVER_URL=http://localhost:5002
REALTIME_SERVER_URL=http://localhost:5003
```

#### `Compiler_Server/.env`
```env
PORT=5002
REDIS_URL=redis://localhost:6379
FIREBASE_SERVICE_ACCOUNT=<base64 encoded service account JSON>
INTERNAL_SECRET=<shared secret>
BACKEND_URL=http://localhost:5001
GPP_PATH=/usr/bin/g++
```

#### `Realtime_Server/.env`
```env
PORT=5003
REDIS_URL=redis://localhost:6379
BACKEND_URL=http://localhost:5001
INTERNAL_SECRET=<shared secret>
```

### 3. Install & Run Each Service

```bash
# Backend API
cd Code_Duel_B && npm install && npm run dev

# Realtime Server
cd Realtime_Server && npm install && npm run dev

# Compiler Server
cd Compiler_Server && npm install && npm start

# Frontend
cd Code_Duel_F && npm install && npm run dev
```

### 4. Redis via Docker (quickest)

```bash
cd Realtime_Server
docker-compose up -d   # spins up Redis
```

---

## 🔌 API Overview

### Backend (`Code_Duel_B`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/rooms/create` | Create a private room |
| `POST` | `/api/rooms/join` | Join a room by code |
| `GET` | `/api/problems/:id` | Get problem statement |
| `POST` | `/api/submissions` | Submit code for judging |
| `GET` | `/api/submissions/:userId` | Get user submission history |
| `GET` | `/api/users/:uid` | Get user profile + ELO |
| `GET` | `/api/matches/:userId` | Get match history |

### Realtime Server (`Realtime_Server`) — Socket.IO Events

| Event | Direction | Description |
|---|---|---|
| `join-queue` | Client → Server | Enter ranked matchmaking |
| `leave-queue` | Client → Server | Leave the queue |
| `match-found` | Server → Client | Matched! Includes `roomId` + `opponentId` |
| `join-room` | Client → Server | Join a duel room channel |
| `opponent-progress` | Server → Client | Live opponent progress update |
| `duel-complete` | Server → Client | Match ended, results available |

---

## 🧠 How Matchmaking Works

1. Player emits `join-queue` with their ELO rating → stored in Redis Sorted Set (ZSET) keyed by rating
2. Every **2 seconds**, the matchmaker ticks and reads the ZSET sorted by rating
3. It finds the first adjacent pair within a **±200 ELO window**
4. An **atomic Lua script** removes both players from the queue in a single Redis round-trip (prevents race conditions in multi-instance deployments)
5. A room is created in Firestore via an internal API call, and both players receive a `match-found` WebSocket event with the `roomId`
6. If a player disconnects between match and notification, the surviving player is **automatically re-queued**

---

## ⚖️ How Code Judging Works

1. User submits code → backend enqueues a BullMQ job
2. Compiler Server worker picks up the job
3. Code is written to a **temporary sandbox directory**
4. Compiler runs (`g++`, `python3`, `javac`, etc.) — compilation errors are caught and returned immediately
5. The binary/script is run against each **hidden test case** with a configurable **time limit**
6. Verdict is determined: `Accepted`, `Wrong Answer`, `TLE`, `Runtime Error`
7. Sandbox directory is **deleted** after all test cases complete
8. Result is saved to Firestore and ELO is updated via the result worker queue

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **ISC License**.

---

<p align="center">
  Built with ☕ and competitive spirit by <a href="https://github.com/ShubhamY90">Shubham Yadav</a>
</p>
