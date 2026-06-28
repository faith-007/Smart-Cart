import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

async function test() {
  console.log("Starting Firebase Admin test v4 (project override)...");
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(firebaseConfigPath)) {
    console.error("firebase-applet-config.json not found!");
    return;
  }
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
  console.log("Project ID:", firebaseConfig.projectId);

  // Force project overrides in environment
  process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
  process.env.GCLOUD_PROJECT = firebaseConfig.projectId;

  try {
    // 1. Initialize App modularly
    const apps = getApps();
    let app;
    if (apps.length === 0) {
      app = initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log("App initialized successfully via modular SDK.");
    } else {
      app = getApp();
      console.log("App already initialized.");
    }

    // 2. Initialize Auth modularly
    console.log("Initializing Auth...");
    const adminAuth = getAuth(app);
    console.log("getAuth succeeded!");

    // 3. Test getUserByEmail
    console.log("Fetching user...");
    const user = await adminAuth.getUserByEmail("himanshu712007@gmail.com");
    console.log("User retrieved successfully:", user.uid, user.email);

  } catch (err: any) {
    console.error("Test Error:");
    console.error("Message:", err?.message);
    console.error("Code:", err?.code);
    console.error("Stack:", err?.stack);
  }
}

test();