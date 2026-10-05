# Compiler Server — Integration Guide

A self-contained code execution server that compiles and judges code submissions against test cases stored in Firestore. This guide walks you through running the server and calling its API from any app.

---

## Prerequisites

Ensure the following are installed on the machine that runs the server:

| Requirement | Notes |
|-------------|-------|
| **Node.js** ≥ 18 | `node -v` to verify |
| **g++ / gcc** | C++ and C compilation |
| **javac + java** | Java compilation and execution |
| **python3** | Python execution |
| **Redis** | Required for the BullMQ job queue. Use a local instance or [Upstash](https://upstash.com) (free tier available) |

---

## Step 1 — Clone and install dependencies

```bash
git clone <repo-url>
cd Compiler_Server
npm install
```

---

## Step 2 — Set up Firebase

The server verifies **Firebase ID tokens** from your app. You must use the **same Firebase project** in both the server and your app.

1. Open [Firebase Console](https://console.firebase.google.com) → your project → **Project Settings → Service Accounts**
2. Click **"Generate new private key"** and download the JSON file
3. Save it as `firebase-service-account.json` in the root of `Compiler_Server/`

> **Never commit this file.** It is already in `.gitignore`.

---

## Step 3 — Configure `.env`

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Then open `.env` and set:

### Firebase
```env
# For local development — path to the JSON key you downloaded in Step 2
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# For production (Render, Railway, etc.) — paste the entire JSON as one line
# This takes priority over the path above when set.
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

### Redis
```env
# Local Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# OR Upstash (recommended for cloud deployments)
REDIS_URL=rediss://default:<your-token>@<your-host>.upstash.io:6380
REDIS_HOST=<your-host>.upstash.io
REDIS_PORT=6380
```

### CORS — allow your app's origin
```env
# Add your frontend URL here (comma-separated for multiple)
CORS_ORIGINS=https://your-app.com,http://localhost:3000
```

### Compiler paths (usually no change needed)
```env
GXX_PATH=g++
GCC_PATH=gcc
JAVA_PATH=java
JAVAC_PATH=javac
PYTHON_PATH=python3
```

---

## Step 4 — Add test cases to Firestore

The server fetches test cases from two Firestore collections. You must populate these for each problem in your app.

### `problem_testcases/{problemId}`
```json
{
  "sampleTestCases": [
    { "input": "5\n1 2 3 4 5", "output": "15" }
  ],
  "hiddenTestCases": [
    { "input": "3\n10 20 30", "output": "60" },
    { "input": "1\n0",        "output": "0" }
  ]
}
```

### `problems/{problemId}`
```json
{
  "timeLimit": 2
}
```

> `timeLimit` is in **seconds** (e.g. `2` = 2 000 ms). If omitted, the server defaults to 2 seconds.

---

## Step 5 — Start the server

```bash
npm start
# → 🚀 Compiler server running on port 3000
```

---

## Step 6 — Call the API from your app

### Getting a Firebase ID token (client-side)

Your app must sign the user in with Firebase Auth and then request a token:

```js
import { getAuth } from "firebase/auth";

async function getToken() {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Not signed in");
  return user.getIdToken(); // auto-refreshed by Firebase SDK
}
```

---

### `POST /run` — Run against sample test cases

Does **not** save anything to the database.

```js
const COMPILER_URL = "https://your-compiler-server.com"; // or http://localhost:3000

const idToken = await getToken();

const res = await fetch(`${COMPILER_URL}/run`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${idToken}`,
  },
  body: JSON.stringify({
    problemId: "two-sum",          // must match a doc in `problem_testcases`
    code: `#include<bits/stdc++.h>\nusing namespace std;\n...`,
    language: "cpp",               // "cpp" | "c" | "java" | "python"
    // customInput: "3\n1 2 3",   // optional: skip sample cases, use this input instead
  }),
});

const data = await res.json();
console.log(data.verdict); // "All Samples Passed" | "Wrong Answer" | "TLE" | ...
console.log(data.results); // per-test-case breakdown
```

**Response shape:**
```json
{
  "success": true,
  "verdict": "All Samples Passed",
  "results": [
    {
      "index": 1,
      "input": "5\n1 2 3 4 5",
      "expected": "15",
      "got": "15",
      "passed": true,
      "verdict": "Accepted",
      "time": "42ms"
    }
  ]
}
```

---

### `POST /submit` — Judge against all hidden test cases

Runs hidden test cases **and** saves the result to Firestore under the authenticated user's account.

```js
const res = await fetch(`${COMPILER_URL}/submit`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${idToken}`,
  },
  body: JSON.stringify({
    problemId: "two-sum",
    code: `#include<bits/stdc++.h>\nusing namespace std;\n...`,
    language: "cpp",
  }),
});

const data = await res.json();
console.log(data.verdict); // "Accepted" | "Wrong Answer" | "TLE" | ...
console.log(`${data.passed} / ${data.total} test cases passed`);
```

**Response shape:**
```json
{
  "success": true,
  "verdict": "Accepted",
  "passed": 10,
  "total": 10
}
```

---

### `GET /health` — Server health check

No auth required. Useful for uptime monitoring.

```js
const res = await fetch(`${COMPILER_URL}/health`);
const data = await res.json();
// data.status → "UP" | "DEGRADED" | "DOWN"
// data.services.redis    → "CONNECTED" | "ERROR"
// data.services.firebase → "CONNECTED" | "ERROR"
```

---

## Supported Languages

| `language` value | Compiler / Runtime |
|------------------|--------------------|
| `cpp`            | `g++`              |
| `c`              | `gcc`              |
| `java`           | `javac` + `java`   |
| `python`         | `python3`          |

---

## Verdict Reference

| Verdict | Meaning |
|---------|---------|
| `Accepted` | All test cases passed |
| `Wrong Answer` | Output didn't match expected |
| `TLE` | Exceeded the time limit |
| `Runtime Error` | Program crashed |
| `Compile Error` | Code failed to compile |
| `All Samples Passed` | `/run` — all sample cases passed |
| `Finished` | `/run` with `customInput` — execution completed |
| `Skipped` | Test cases after a failed one (not executed) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `401 Unauthorized` | Make sure the Firebase project in your app matches the service account in the server |
| `CORS error` | Add your app's origin to `CORS_ORIGINS` in `.env` |
| `Redis connection refused` | Start Redis locally (`redis-server`) or set `REDIS_URL` to an Upstash URL |
| `404 — No test cases found` | Add a `problem_testcases/{problemId}` document to Firestore |
| Compile error on `g++` not found | Set `GXX_PATH` in `.env` to the full path of your `g++` binary |
