import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

async function test() {
  console.log("Starting Firebase Admin Quota Project test...");
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(firebaseConfigPath)) {
    console.error("firebase-applet-config.json not found!");
    return;
  }
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));

  // Set various quota and project environment variables
  process.env.GOOGLE_CLOUD_QUOTA_PROJECT = firebaseConfig.projectId;
  process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
  process.env.GCLOUD_PROJECT = firebaseConfig.projectId;

  try {
    const apps = getApps();
    let app;
    if (apps.length === 0) {
      app = initializeApp({
        projectId: firebaseConfig.projectId,
      });
    } else {
      app = getApp();
    }

    const adminAuth = getAuth(app);
    console.log("Fetching user...");
    const user = await adminAuth.getUserByEmail("himanshu712007@gmail.com");
    console.log("User retrieved successfully:", user.uid, user.email);
  } catch (err: any) {
    console.error("Test Error:");
    console.error("Message:", err?.message);
    console.error("Code:", err?.code);
  }
}

test();
