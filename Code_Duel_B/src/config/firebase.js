const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

let serviceAccount;

// Prefer inline JSON env var (required on Railway/Render/cloud platforms)
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log("[Firebase Init]: Loaded credentials from FIREBASE_SERVICE_ACCOUNT_JSON env var");
  } catch (e) {
    console.error("[Firebase Init Error]: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
    process.exit(1);
  }
} else {
  // Fall back to file path (used locally)
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./firebase-service-account.json";
  const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`[Firebase Init Error]: Service account JSON not found at ${resolvedPath}`);
    process.exit(1);
  }

  try {
    serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
    console.log(`[Firebase Init]: Loaded credentials from file: ${resolvedPath}`);
  } catch (e) {
    console.error("[Firebase Init Error]: Failed to read service account file:", e.message);
    process.exit(1);
  }
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  console.log(`🔥 Firebase Admin SDK initialized for project: ${serviceAccount.project_id}`);
} catch (error) {
  console.error("❌ Failed to initialize Firebase Admin SDK:", error);
  process.exit(1);
}

const db = admin.firestore();
// Explicitly target the default database to avoid NOT_FOUND on multi-db projects
db.settings({ databaseId: 'default' });
const auth = admin.auth();

console.log("📦 Firestore connected to database: default");

module.exports = {
  admin,
  db,
  auth
};
