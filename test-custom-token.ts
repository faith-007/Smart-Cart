import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

async function test() {
  console.log("Starting Firebase Admin Custom Token test...");
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(firebaseConfigPath)) {
    console.error("firebase-applet-config.json not found!");
    return;
  }
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));

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
    console.log("Generating custom token...");
    const token = await adminAuth.createCustomToken("test-uid-123");
    console.log("Custom token generated successfully:", token.substring(0, 50) + "...");
  } catch (err: any) {
    console.error("Test Error:");
    console.error("Message:", err?.message);
    console.error("Stack:", err?.stack);
  }
}

test();
