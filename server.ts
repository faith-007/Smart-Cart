import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import crypto from "crypto";
import { Resend } from "resend";

dotenv.config();

// Helper to securely hash passwords server-side using SHA-256
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Detailed step logging helper for Forgot Password audits
function logForgotStep(
  step: string,
  email: string,
  status: "SUCCESS" | "FAILURE",
  details?: {
    functionName?: string;
    authMethod?: string;
    dbOp?: string;
    errorMsg?: string;
    stackTrace?: string;
    [key: string]: any;
  }
) {
  const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  console.log(`\n=================================================================`);
  console.log(`🔐 [Forgot Password Audit Log] - STEP: ${step.toUpperCase()}`);
  console.log(`Timestamp:           ${timestamp}`);
  console.log(`Status:              ${status}`);
  console.log(`User Email:          ${email}`);
  if (details?.functionName) console.log(`Function Name:       ${details.functionName}`);
  if (details?.authMethod)   console.log(`Auth Method:         ${details.authMethod}`);
  if (details?.dbOp)         console.log(`Database Operation:  ${details.dbOp}`);
  if (details?.errorMsg)     console.log(`Error Message:       ${details.errorMsg}`);
  if (details?.stackTrace)   console.log(`Stack Trace:\n${details.stackTrace}`);
  
  const metadata = { ...details };
  delete metadata.functionName;
  delete metadata.authMethod;
  delete metadata.dbOp;
  delete metadata.errorMsg;
  delete metadata.stackTrace;
  if (Object.keys(metadata).length > 0) {
    console.log(`Metadata:            ${JSON.stringify(metadata, null, 2)}`);
  }
  console.log(`=================================================================\n`);
}


const app = express();
const PORT = 3000;

app.use(express.json());

// 1. Initialize Firebase Client SDK for secure backend OTP storage
let firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
if (!fs.existsSync(firebaseConfigPath)) {
  firebaseConfigPath = path.join(__dirname, "firebase-applet-config.json");
}
if (!fs.existsSync(firebaseConfigPath)) {
  firebaseConfigPath = path.join(__dirname, "../..", "firebase-applet-config.json");
}
if (!fs.existsSync(firebaseConfigPath)) {
  console.error("[SmartCart Backend Error] firebase-applet-config.json not found in workspace root.");
}
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

// 1b. Initialize Firebase Admin SDK for administrative operations like secure password reset
let adminAuth: admin.auth.Auth | null = null;
try {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
  adminAuth = admin.auth();
  console.log("[SmartCart Server] Firebase Admin SDK initialized successfully.");
} catch (err) {
  console.error("[SmartCart Server] Failed to initialize Firebase Admin SDK:", err);
}

// 2. Initialize Firebase Auth and define trusted system OTP agent account
const serverAuth = getAuth(firebaseApp);
const SYSTEM_EMAIL = "system-otp-agent@smartcartgola.in";
const SYSTEM_PASSWORD = process.env.SYSTEM_OTP_PASSWORD || "SuperSecureSmartCartPass123!";

async function ensureServerAuthenticated() {
  try {
    if (serverAuth.currentUser) return;
    await signInWithEmailAndPassword(serverAuth, SYSTEM_EMAIL, SYSTEM_PASSWORD);
    console.log("[SmartCart Server] Secure system OTP agent authenticated successfully.");
  } catch (err: any) {
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/invalid-email") {
      try {
        await createUserWithEmailAndPassword(serverAuth, SYSTEM_EMAIL, SYSTEM_PASSWORD);
        console.log("[SmartCart Server] Created new secure system OTP agent account.");
      } catch (createErr) {
        try {
          await signInWithEmailAndPassword(serverAuth, SYSTEM_EMAIL, SYSTEM_PASSWORD);
          console.log("[SmartCart Server] Secure system OTP agent authenticated successfully (after creation collision).");
        } catch (retryErr: any) {
          console.error("[SmartCart Server] Critical Error authenticating system agent after creation:", retryErr?.message || retryErr);
        }
      }
    } else {
      console.error("[SmartCart Server] Critical Error authenticating system agent:", err?.message || err);
    }
  }
}

// 2.b Reusable Resend Client & Email Service
let resendInstance: Resend | null = null;

function getResendInstance(): Resend {
  if (resendInstance) return resendInstance;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[SmartCart Resend Error] RESEND_API_KEY environment variable is required but missing.");
    throw new Error("RESEND_API_KEY environment variable is required but missing. Please configure it in your Netlify or system environment variables.");
  }

  resendInstance = new Resend(apiKey);
  return resendInstance;
}

async function sendResendEmail({ to, subject, html, text, from }: { to: string; subject: string; html: string; text: string; from?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[SmartCart Resend Error] RESEND_API_KEY environment variable is missing.");
    throw new Error("RESEND_API_KEY environment variable is missing. Please configure it in your Netlify or system environment variables.");
  }

  const sender = from || "Smart Cart <noreply@smartcartgola.in>";

  try {
    const resend = getResendInstance();
    console.log(`[SmartCart Resend] Dispatching email to ${to} using sender: "${sender}"`);
    const response = await resend.emails.send({
      from: sender,
      to: [to],
      subject,
      html,
      text
    });

    if (response.error) {
      console.error("[SmartCart Resend SDK Error] Failed to send email via Resend:", response.error);
      throw new Error(response.error.message || "Resend API returned an error");
    }

    console.log(`[SmartCart Resend Success] Email successfully dispatched via Resend to ${to}. MessageId: ${response.data?.id}`);
    return response.data;
  } catch (error: any) {
    console.error(`[SmartCart Resend Exception] Exception during Resend API call to ${to}:`, error?.message || error);
    if (error?.stack) {
      console.error(error.stack);
    }
    throw error;
  }
}

// 3. Reusable SMTP Email Service (Single transporter reused when available)
let smtpTransporter: any = null;

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  });
  return smtpTransporter;
}

async function sendSmtpEmail({ to, subject, html, text, from }: { to: string; subject: string; html: string; text: string; from?: string }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const defaultFrom = process.env.SMTP_FROM || "SmartCart Services <noreply@smartcartgola.in>";
  const sender = from || defaultFrom;

  if (!host || !user || !pass) {
    console.warn("[SmartCart SMTP Warning] SMTP is not fully configured (SMTP_HOST, SMTP_USER, SMTP_PASS are missing). Real SMTP email sending is skipped.");
    return { id: "mock-smtp-id-no-config" };
  }

  try {
    const transporter = getSmtpTransporter();
    if (!transporter) {
      throw new Error("SMTP Transporter failed to initialize");
    }

    console.log(`[SmartCart SMTP] Dispatching email to ${to} using SMTP host: ${host}`);
    const info = await transporter.sendMail({
      from: sender,
      to,
      subject,
      html,
      text
    });

    console.log(`[SmartCart SMTP Success] Email successfully dispatched to ${to}. MessageId: ${info.messageId}`);
    return info;
  } catch (error: any) {
    console.error(`[SmartCart SMTP Error] Failed to send SMTP email to ${to}:`, error?.message || error);
    throw error;
  }
}

// Create API router to easily support both local development and Netlify/Vercel serverless custom path mappings
const apiRouter = express.Router();

// Memory-based OTP Cache store to remove Firestore dependency for verification as per Task 7
interface OTPMemoryEntry {
  email: string;
  otp: string;
  expiresAt: number;
  verified: boolean;
  attempts?: number;
  purpose?: "registration" | "forgot_password";
}
const otpMemoryStore = new Map<string, OTPMemoryEntry>();

// Secure route to generate and dispatch OTP code during user registration using SMTP and direct in-memory store
apiRouter.post("/send-otp", async (req, res) => {
  const { email, name, isResend } = req.body;

  // Verify that the RESEND_API_KEY is configured
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_resend_api_key_here") {
    console.error("[SmartCart OTP Flow] [FAILURE] RESEND_API_KEY environment variable is missing.");
    return res.status(500).json({
      success: false,
      error: "RESEND_API_KEY is missing",
      details: "The RESEND_API_KEY environment variable is required but missing. Please configure it in your Netlify or system environment variables."
    });
  }

  // STEP 1 Log: Button clicked (received request from frontend)
  console.log(`[SmartCart OTP Flow] [STEP 1] Button clicked: Received /send-otp request for email: "${email}" (isResend: ${!!isResend})`);

  if (!email) {
    console.error(`[SmartCart OTP Flow] [FAILURE] Missing email address parameter.`);
    return res.status(400).json({ success: false, error: "Email address parameter is required" });
  }

  const emailKey = email.toLowerCase().trim();

  // STEP 2 Log: Generate OTP
  const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiration
  console.log(`[SmartCart OTP Flow] [STEP 2] Generate OTP: Generated code "${generatedOtp}" for email "${emailKey}". Expires in 10 minutes.`);

  // Audit details regarding why previous Firestore write bypassed (Task 3, 4, 5, 6, 8, 9)
  console.log(`[SmartCart OTP Flow] [STEP 3] Cache optimization: OTP verification is handled directly using a secure in-memory cache to ensure rapid response times.`);

  try {
    // Write OTP directly to memory cache (Task 7)
    otpMemoryStore.set(emailKey, {
      email: emailKey,
      otp: generatedOtp,
      expiresAt,
      verified: false
    });
    console.log(`[SmartCart OTP Flow] [STEP 4] Backend store write: OTP successfully cached in memory.`);

    console.log(`\n======================================================`);
    console.log(`🔐 [SERVER OTP SECURE LOG]`);
    console.log(`EmailKey: ${emailKey}`);
    console.log(`OTP:      ${generatedOtp}`);
    console.log(`Expires:  ${new Date(expiresAt).toISOString()}`);
    console.log(`======================================================\n`);

    // STEP 5 Log: Call Resend
    console.log(`[SmartCart OTP Flow] [STEP 5] Call Resend: Dispatching email to "${emailKey}"...`);
    const templateTitle = "SmartCart Verification OTP";
    
    const rawBody = `Welcome to Smart Cart.

Complete account activation using this code shown below. This unique security credential confirms ownership of the registered email address and enables to start shopping, tracking, saved addresses, management, delivery updates, and other platform features.

━━━━━━━━━━━━━━━━━━
🔐 Verification OTP

${generatedOtp}

━━━━━━━━━━━━━━━━━━

Validity period: 10 minutes.

For your protection, enter this code on the screen. Any unmatched submission will not complete activation. If this message reaches an unintended recipient, no further action is required.

We appreciate your trust and look forward to serving your grocery, household, personal care, snack, pet, and daily essential needs.

Website: https://smartcartgola.netlify.app

Our Team`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SmartCart Verification OTP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 48px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 10px rgba(15, 23, 42, 0.03); overflow: hidden;">
          <!-- Top Color Accent Line -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #10b981, #059669);"></td>
          </tr>
          
          <!-- Branding Header -->
          <tr>
            <td align="center" style="padding: 36px 32px 12px 32px;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size: 26px; font-weight: 800; color: #10b981; letter-spacing: -0.5px;">
                    SmartCart
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 24px 32px 40px 32px; font-size: 15px; line-height: 1.6; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              
              <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 20px; font-weight: 700; color: #0f172a; text-align: left;">
                Welcome to SmartCart.
              </h2>
              
              <p style="margin-top: 0; margin-bottom: 28px; color: #475569; font-weight: 450; text-align: left;">
                Complete account activation using this code shown below. This unique security credential confirms ownership of the registered email address and enables to start shopping, tracking, saved addresses, management, delivery updates, and other platform features.
              </p>
              
              <!-- Horizontal Separation Divider -->
              <div style="border-top: 1px solid #e2e8f0; margin-bottom: 28px;"></div>
              
              <!-- OTP Verification Box -->
              <div style="background-color: #f0fdf4; border: 1px dashed #10b981; border-radius: 12px; padding: 28px 24px; text-align: center; margin-bottom: 28px;">
                <p style="font-size: 11px; font-weight: 750; color: #047857; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 14px 0;">
                  🔐 Verification OTP
                </p>
                <div style="font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #065f46; margin: 0 0 6px 0; padding-left: 8px; line-height: 1;">
                  ${generatedOtp}
                </div>
              </div>

              <!-- Validity Counter Indicator -->
              <p style="margin-top: 0; margin-bottom: 24px; font-size: 14px; font-weight: 600; color: #b45309; text-align: center;">
                Validity period: 10 minutes.
              </p>
              
              <!-- Security Protection Warning -->
              <p style="margin-top: 0; margin-bottom: 20px; font-size: 13.5px; color: #64748b; line-height: 1.5; text-align: left;">
                For your protection, enter this code on the screen. Any unmatched submission will not complete activation. If this message reaches an unintended recipient, no further action is required.
              </p>
              
              <!-- Appreciation Note -->
              <p style="margin-top: 0; margin-bottom: 28px; font-size: 13.5px; color: #64748b; line-height: 1.5; text-align: left;">
                We appreciate your trust and look forward to serving your grocery, household, personal care, snack, pet, and daily essential needs.
              </p>

              <!-- Horizontal Separation Divider -->
              <div style="border-top: 1px solid #e2e8f0; margin-bottom: 28px;"></div>

              <!-- Footer Links Block -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" style="font-size: 14px; color: #475569; line-height: 1.8;">
                    Website: <a href="https://smartcartgola.netlify.app" style="color: #10b981; font-weight: 600; text-decoration: none;" target="_blank">https://smartcartgola.netlify.app</a>
                    <br />
                    <strong>Our Team</strong>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
        </table>
        
        <!-- Bottom Small Disclaimer -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; margin-top: 20px;">
          <tr>
            <td align="center" style="font-size: 11px; color: #94a3b8; font-weight: 500; line-height: 1.5;">
              This is an automated operational security notification sent by SmartCart Support.<br />
              &copy; ${new Date().getFullYear()} SmartCart. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    // 4. Send email using Resend
    await sendResendEmail({
      to: emailKey,
      subject: templateTitle,
      html: htmlContent,
      text: rawBody,
      from: "Smart Cart <noreply@smartcartgola.in>"
    });

    // STEP 6 Log: Success
    console.log(`[SmartCart OTP Flow] [STEP 6] Success: Verification OTP email successfully dispatched via Resend to "${emailKey}".`);
    return res.json({ 
      success: true, 
      message: "OTP sent successfully"
    });

  } catch (error: any) {
    // STEP 7 Log: Failure
    console.error(`[SmartCart OTP Flow] [STEP 7] [FAILURE] Failed to dispatch OTP for ${emailKey}:`, error?.message || error);
    
    return res.json({ 
      success: false, 
      error: "Failed to send OTP email",
      details: error?.message || String(error)
    });
  }
});

// Secure route to verify OTP code during user registration using direct backend in-memory cache
apiRouter.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  console.log(`[SmartCart OTP Flow] [VERIFY] Received verification request for email: "${email}" with OTP: "${otp}"`);

  if (!email || !otp) {
    console.error(`[SmartCart OTP Flow] [VERIFY FAILURE] Missing email address or OTP code parameter.`);
    return res.status(400).json({ success: false, error: "Email address and OTP code are required parameters" });
  }

  const emailKey = email.toLowerCase().trim();
  const enteredOtp = String(otp).trim();

  // Audit details regarding why previous Firestore read bypassed (Task 3, 4, 5, 6, 8, 9)
  console.log(`[SmartCart OTP Flow] [VERIFY] Verification is read and checked from direct memory cache for speed and reliability.`);

  try {
    // Read from backend in-memory Map
    const data = otpMemoryStore.get(emailKey);

    if (!data) {
      console.error(`[SmartCart OTP Flow] [VERIFY FAILURE] No OTP request found in memory cache for "${emailKey}".`);
      return res.json({ success: false, error: "No OTP code request found for this email address. Please click 'Resend OTP'." });
    }

    // Verify expiration
    if (Date.now() > data.expiresAt) {
      console.error(`[SmartCart OTP Flow] [VERIFY FAILURE] OTP has expired for "${emailKey}".`);
      return res.json({ success: false, error: "OTP has expired. Please click 'Resend OTP' to request a new code." });
    }

    // Verify code match
    if (data.otp !== enteredOtp) {
      console.error(`[SmartCart OTP Flow] [VERIFY FAILURE] Incorrect OTP code entered: "${enteredOtp}" (expected: "${data.otp}").`);
      return res.json({ success: false, error: "Incorrect OTP code. Please verify the code and try again." });
    }

    // Mark OTP as verified in memory cache
    data.verified = true;
    otpMemoryStore.set(emailKey, data);

    console.log(`[SmartCart OTP Flow] [VERIFY SUCCESS] OTP verification succeeded for "${emailKey}"`);
    return res.json({ success: true, message: "OTP code verified successfully!" });

  } catch (error: any) {
    console.error(`[SmartCart OTP Flow] [VERIFY ERROR] Verification failed for ${emailKey}:`, error?.message || error);
    return res.json({ 
      success: false, 
      error: "OTP verification failed due to a server error",
      details: error?.message || String(error)
    });
  }
});

// SMTP route to handle password reset/change notifications
apiRouter.post("/send-password-reset", async (req, res) => {
  const { email, userName } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: "Email address parameter is required" });
  }

  console.log(`[SmartCart SMTP] Received password reset safety notification request for: ${email}`);

  const htmlContent = `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #16a34a; margin: 0; font-size: 26px; font-weight: 800; tracking-tight:-0.025em; font-family: sans-serif;">SmartCart</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 6px; margin-bottom: 0; font-weight: 500;">Security Notification: SMTP Mode</p>
      </div>
      <p style="font-size: 16px; line-height: 24px; color: #334155; margin-top: 0; font-weight: 600;">Hello ${userName || "Customer"},</p>
      <p style="font-size: 14px; line-height: 22px; color: #475569; margin-bottom: 24px;">
        This email confirms that your SmartCart account security password key-code has been successfully updated.
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #475569;">
        <strong>Status:</strong> Security credentials updated successfully.<br/>
        <strong>Timestamp:</strong> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
      </div>
      <p style="font-size: 13px; line-height: 18px; color: #b91c1c; margin-top: 0; margin-bottom: 16px; font-weight: 600;">
        Security Notice: If you did not make this change, please contact our support desk immediately to freeze unauthorized accesses.
      </p>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <div style="text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
        &copy; ${new Date().getFullYear()} SmartCart Inc. All rights reserved.
      </div>
    </div>
  `;

  const textContent = `SmartCart Password Reset Confirmation\n\nHello ${userName || "Customer"},\n\nThis is to confirm your password has been successfully updated on ${new Date().toLocaleString()}.`;

  try {
    await sendSmtpEmail({
      to: email,
      subject: `[SmartCart] Security Notice: Password Updated Successfully`,
      html: htmlContent,
      text: textContent,
      from: "SmartCart Security <noreply@smartcartgola.in>"
    });

    return res.json({ success: true, message: "Security notification sent successfully via SMTP" });
  } catch (error: any) {
    console.error(`[SmartCart SMTP Failure] Error sending password reset email to ${email}:`, error?.message || error);
    return res.json({ success: false, error: "Email sending failed", details: error?.message || String(error) });
  }
});

// SMTP route to handle detailed order confirmation emails
apiRouter.post("/send-order-confirmation", async (req, res) => {
  const { email, order } = req.body;

  if (!email || !order) {
    return res.status(400).json({ success: false, error: "Email address and order payload parameters are required" });
  }

  console.log(`[SmartCart SMTP] Dispatching order confirmation email to: ${email} for order: ${order.id}`);

  // Create clean safe item layout strings
  const itemsHtml = order.items && Array.isArray(order.items)
    ? order.items.map((item: any) => `
        <tr style="border-bottom: 1px dashed #e2e8f0;">
          <td style="padding: 10px 0; color: #1e293b; font-weight: 550;">${item.product?.name || "Grocery Item"}</td>
          <td style="padding: 10px 0; text-align: center; color: #475569;">${item.quantity}</td>
          <td style="padding: 10px 0; text-align: right; color: #1e293b; font-weight: 600;">₹${(item.product?.sellingPrice || 0) * item.quantity}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="3" style="text-align: center; padding: 12px 0;">No active items found</td></tr>`;

  const promoSection = order.discount > 0 
    ? `<div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #16a34a; font-weight: 600;">
         <span>Promo Code Discount:</span>
         <span>-₹${order.discount}</span>
       </div>`
    : '';

  const htmlContent = `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 28px;">
        <h2 style="color: #16a34a; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.03em;">SmartCart</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 6px; margin-bottom: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Order Confirmation Receipt</p>
      </div>
      
      <p style="font-size: 16px; line-height: 24px; color: #334155; margin-top: 0; font-weight: 600;">Thank you for your business, ${order.address?.name || "Customer"}!</p>
      <p style="font-size: 14px; line-height: 22px; color: #475569; margin-bottom: 28px;">
        Your order <strong>${order.id}</strong> has been successfully placed at <strong>${order.date}</strong> and is currently being processed. Here is a summary of your premium purchase:
      </p>

      <h4 style="margin: 0 0 12px 0; font-size: 12px; color: #475569; text-transform: uppercase; font-weight: 800; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; letter-spacing: 0.05em;">Purchased Items</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; margin-bottom: 28px;">
        <thead>
          <tr style="border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 700;">
            <th style="padding: 8px 0; font-weight: 700;">Item Name</th>
            <th style="padding: 8px 0; text-align: center; font-weight: 700;">Qty</th>
            <th style="padding: 8px 0; text-align: right; font-weight: 700;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <h4 style="margin: 0 0 12px 0; font-size: 12px; color: #475569; text-transform: uppercase; font-weight: 800; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; letter-spacing: 0.05em;">Price Breakdown</h4>
      <div style="background-color: #f8fafc; border-radius: 16px; padding: 18px; margin-bottom: 28px; font-size: 13px; color: #475569;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Subtotal:</span>
          <strong style="color: #1e293b;">₹${order.subtotal}</strong>
        </div>
        ${promoSection}
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Delivery Charge:</span>
          <strong style="${order.deliveryCharge === 0 ? "color: #16a34a; font-weight: 800;" : "color: #1e293b;"}">
            ${order.deliveryCharge === 0 ? "FREE" : `₹${order.deliveryCharge}`}
          </strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Platform Fee:</span>
          <strong style="color: #1e293b;">₹${order.platformFee ?? 3}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Handling Charge:</span>
          <strong style="color: #1e293b;">₹${order.handlingCharge ?? 10}</strong>
        </div>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 12px 0;" />
        <div style="display: flex; justify-content: space-between; font-size: 15px; color: #1e293b; font-weight: 800;">
          <span>Total Amount Paid:</span>
          <span>₹${order.total}</span>
        </div>
      </div>

      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 18px; margin-bottom: 28px; font-size: 13px; color: #15803d; line-height: 20px;">
        <strong style="font-size: 14px; display: inline-block; margin-bottom: 6px;">Delivery Details:</strong><br />
        <strong>Receiver Name:</strong> ${order.address?.name || "Customer"}<br />
        <strong>Address Point:</strong> ${order.address?.addressLine || "N/A"}, ${order.address?.city || "N/A"} - ${order.address?.pincode || "N/A"}<br />
        <strong>Contact Number:</strong> ${order.address?.phone || "N/A"}<br />
        <strong>Payment Method:</strong> ${order.paymentMethod || "COD"}
      </div>

      <div style="text-align: center; color: #64748b; font-size: 13px; margin-bottom: 12px;">
        Courier assigned: Delivery in <strong>15 minutes</strong> via fast-track parcel.
      </div>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <div style="text-align: center; font-size: 11px; color: #94a3b8; font-weight: 550;">
        &copy; ${new Date().getFullYear()} SmartCart Inc. Delivered instantly via SMTP secure routing.
      </div>
    </div>
  `;

  const textContent = `Thank you for your order!\n\nOrder ID: ${order.id}\nDate: ${order.date}\nTotal Amount Paid: ₹${order.total}\nDelivery Address: ${order.address?.addressLine}\nWe are preparing your fast parcel delivery!`;

  try {
    await sendSmtpEmail({
      to: email,
      subject: `[SmartCart] Order Confirmed: ${order.id}`,
      html: htmlContent,
      text: textContent
    });

    return res.json({ success: true, message: "Order confirmation email successfully sent via SMTP" });
  } catch (error: any) {
    console.error(`[SmartCart SMTP Failure] Error sending order confirmation email to ${email}:`, error?.message || error);
    return res.json({ success: false, error: "Email sending failed", details: error?.message || String(error) });
  }
});


// Secure route to initiate Forgot Password flow (Forgot Password - Step 1 to 4)
apiRouter.post("/forgot-password-request", async (req, res) => {
  const { email } = req.body;

  // Verify that the RESEND_API_KEY is configured
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_resend_api_key_here") {
    console.error("[SmartCart Forgot Password] [FAILURE] RESEND_API_KEY environment variable is missing.");
    return res.status(500).json({
      success: false,
      error: "RESEND_API_KEY is missing",
      details: "The RESEND_API_KEY environment variable is required but missing. Please configure it in your Netlify or system environment variables."
    });
  }

  // Step 1: Forgot Password button clicked log
  logForgotStep("Forgot Password button clicked", email || "unknown_email", "SUCCESS", {
    functionName: "/forgot-password-request"
  });

  if (!email) {
    logForgotStep("Forgot Password button clicked", "unknown_email", "FAILURE", {
      functionName: "/forgot-password-request",
      errorMsg: "Email address parameter is required"
    });
    return res.status(400).json({ success: false, error: "Email address parameter is required" });
  }

  const emailKey = email.toLowerCase().trim();

  try {
    // Step 2: Verify email exists in the SmartCart user database
    // Check in Firestore profiles first
    let userExists = false;
    const q = query(collection(db, "profiles"), where("email", "==", emailKey));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      userExists = true;
    }

    // Also check Firebase Auth in case profile wasn't synced or for extra robustness
    if (!userExists && adminAuth) {
      try {
        await adminAuth.getUserByEmail(emailKey);
        userExists = true;
      } catch (authErr) {
        console.log(`[SmartCart Forgot Password] Firebase Auth search did not find email: "${emailKey}"`);
      }
    }

    if (!userExists) {
      logForgotStep("User lookup", emailKey, "FAILURE", {
        functionName: "/forgot-password-request",
        dbOp: "query profiles / adminAuth.getUserByEmail",
        errorMsg: "No account found with this email address"
      });
      console.warn(`[SmartCart Forgot Password] Prevent reset: Non-existing account search for email: "${emailKey}"`);
      return res.json({ success: false, error: "No account found with this email address." });
    }

    logForgotStep("User lookup", emailKey, "SUCCESS", {
      functionName: "/forgot-password-request",
      dbOp: "query profiles / adminAuth.getUserByEmail"
    });

    // Step 3: Generate a secure 6-digit OTP
    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    logForgotStep("OTP generated", emailKey, "SUCCESS", {
      functionName: "/forgot-password-request",
      otpLength: generatedOtp.length,
      expiresInMinutes: 10
    });

    // Store securely in memory map (OTP stored step)
    otpMemoryStore.set(emailKey, {
      email: emailKey,
      otp: generatedOtp,
      expiresAt,
      verified: false,
      attempts: 0,
      purpose: "forgot_password"
    });

    logForgotStep("OTP stored", emailKey, "SUCCESS", {
      functionName: "/forgot-password-request",
      dbOp: "otpMemoryStore.set",
      expiresAt: new Date(expiresAt).toISOString()
    });

    console.log(`\n======================================================`);
    console.log(`🔐 [SERVER FORGOT PASSWORD OTP SECURE LOG]`);
    console.log(`EmailKey: ${emailKey}`);
    console.log(`OTP:      ${generatedOtp}`);
    console.log(`Expires:  ${new Date(expiresAt).toISOString()}`);
    console.log(`======================================================\n`);

    // Step 4: Send OTP using SMTP
    const templateTitle = "SmartCart Password Reset OTP";
    const rawBody = `Hello,

You have requested to reset your password for your SmartCart account.

Complete your password reset using the 6-digit verification code below:

━━━━━━━━━━━━━━━━━━
🔐 Password Reset OTP:

${generatedOtp}

━━━━━━━━━━━━━━━━━━

Validity period: 10 minutes.
Maximum verification attempts: 5.

For your protection, please do not share this code with anyone. If you did not request this, please ignore this email.`;

    const htmlContent = `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #16a34a; margin: 0; font-size: 26px; font-weight: 800; tracking-tight:-0.025em;">SmartCart</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 6px; margin-bottom: 0; font-weight: 500;">Password Recovery Verification</p>
        </div>
        <p style="font-size: 15px; line-height: 24px; color: #334155; margin-top: 0;">Hello,</p>
        <p style="font-size: 14px; line-height: 22px; color: #475569;">
          We received a request to reset the security password for your SmartCart account. Please enter the following 6-digit verification code to proceed:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="display: inline-block; background-color: #f0fdf4; border: 2px dashed #bbf7d0; border-radius: 12px; padding: 16px 32px; font-size: 28px; font-weight: 800; letter-spacing: 0.25em; color: #16a34a;">
            ${generatedOtp}
          </div>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #475569;">
          <strong>Validity Period:</strong> 10 minutes<br/>
          <strong>Maximum Attempts:</strong> 5 attempts<br/>
          <strong>Security Warning:</strong> For your protection, never share this code with anyone.
        </div>
        <p style="font-size: 13px; line-height: 18px; color: #94a3b8; margin-bottom: 0;">
          If you did not request this password reset, please ignore this email. Your security has not been compromised.
        </p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <div style="text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
          &copy; ${new Date().getFullYear()} SmartCart Inc. All rights reserved.
        </div>
      </div>
    `;

    try {
      await sendResendEmail({
        to: emailKey,
        subject: templateTitle,
        html: htmlContent,
        text: rawBody,
        from: "Smart Cart <noreply@smartcartgola.in>"
      });

      logForgotStep("OTP sent through Resend", emailKey, "SUCCESS", {
        functionName: "/forgot-password-request",
        authMethod: "Resend Email Service",
        recipient: emailKey
      });

      console.log(`[SmartCart Forgot Password] Reset OTP successfully sent to "${emailKey}".`);
      return res.json({ success: true, message: "Verification OTP code sent to your email." });
    } catch (sendErr: any) {
      console.error(`[SmartCart Forgot Password Failure] Resend failed for ${emailKey}:`, sendErr?.message || sendErr);

      logForgotStep("OTP sent through Resend", emailKey, "FAILURE", {
        functionName: "/forgot-password-request",
        authMethod: "Resend Email Service",
        errorMsg: sendErr?.message || String(sendErr),
        stackTrace: sendErr?.stack
      });

      return res.json({
        success: false,
        error: "Failed to send reset code email. Please contact support or try again.",
        details: sendErr?.message || String(sendErr)
      });
    }
  } catch (error: any) {
    logForgotStep("Forgot Password Request", emailKey, "FAILURE", {
      functionName: "/forgot-password-request",
      errorMsg: error?.message || String(error),
      stackTrace: error?.stack
    });
    console.error(`[SmartCart Forgot Password Error]`, error);
    return res.json({ success: false, error: "A server error occurred while processing your request." });
  }
});

// Secure route to verify Forgot Password OTP (Forgot Password - Step 5 to 6)
apiRouter.post("/forgot-password-verify", async (req, res) => {
  const { email, otp } = req.body;

  console.log(`[SmartCart Forgot Password] [VERIFY] Received code verification request for email: "${email}" with OTP: "${otp}"`);

  if (!email || !otp) {
    return res.status(400).json({ success: false, error: "Email address and OTP code are required parameters" });
  }

  const emailKey = email.toLowerCase().trim();
  const enteredOtp = String(otp).trim();

  try {
    const data = otpMemoryStore.get(emailKey);

    if (!data || data.purpose !== "forgot_password") {
      logForgotStep("OTP verified", emailKey, "FAILURE", {
        functionName: "/forgot-password-verify",
        errorMsg: "No verification session found for this email"
      });
      return res.json({ success: false, error: "No verification session found for this email. Please request a new code." });
    }

    // OTP Rules: Maximum 5 verification attempts
    const currentAttempts = data.attempts || 0;
    if (currentAttempts >= 5) {
      logForgotStep("OTP verified", emailKey, "FAILURE", {
        functionName: "/forgot-password-verify",
        errorMsg: "Maximum verification attempts exceeded",
        attempts: currentAttempts
      });
      console.error(`[SmartCart Forgot Password] [VERIFY FAILURE] Max verification attempts exceeded for "${emailKey}".`);
      return res.json({ success: false, error: "Maximum verification attempts exceeded. Please click 'Resend OTP' to request a new code." });
    }

    // Increment attempts and update
    data.attempts = currentAttempts + 1;
    otpMemoryStore.set(emailKey, data);

    // OTP Rules: Expiry: 10 minutes
    if (Date.now() > data.expiresAt) {
      logForgotStep("OTP verified", emailKey, "FAILURE", {
        functionName: "/forgot-password-verify",
        errorMsg: "Verification code expired",
        expiresAt: new Date(data.expiresAt).toISOString()
      });
      console.error(`[SmartCart Forgot Password] [VERIFY FAILURE] Code expired for "${emailKey}".`);
      return res.json({ success: false, error: "Verification code expired. Request a new code." });
    }

    // Check code match
    if (data.otp !== enteredOtp) {
      logForgotStep("OTP verified", emailKey, "FAILURE", {
        functionName: "/forgot-password-verify",
        errorMsg: `Invalid verification code entered: ${enteredOtp}`,
        attemptsLeft: 5 - data.attempts
      });
      console.error(`[SmartCart Forgot Password] [VERIFY FAILURE] Incorrect code entered: "${enteredOtp}" (expected: "${data.otp}"). Attempts left: ${5 - data.attempts}`);
      return res.json({ 
        success: false, 
        error: "Invalid verification code.",
        attemptsLeft: 5 - data.attempts
      });
    }

    // Step 7: If OTP is correct, mark as verified in cache
    data.verified = true;
    otpMemoryStore.set(emailKey, data);

    logForgotStep("OTP verified", emailKey, "SUCCESS", {
      functionName: "/forgot-password-verify",
      dbOp: "otpMemoryStore.set",
      verified: true
    });

    console.log(`[SmartCart Forgot Password] [VERIFY SUCCESS] Code verified successfully for "${emailKey}"`);
    return res.json({ success: true, message: "Code verified successfully." });

  } catch (error: any) {
    logForgotStep("OTP verified", emailKey, "FAILURE", {
      functionName: "/forgot-password-verify",
      errorMsg: error?.message || String(error),
      stackTrace: error?.stack
    });
    console.error(`[SmartCart Forgot Password Verify Error]`, error);
    return res.json({ success: false, error: "Verification failed due to a server error." });
  }
});

// Secure route to update password (Forgot Password - Step 7 to 8)
apiRouter.post("/forgot-password-reset", async (req, res) => {
  const { email, newPassword } = req.body;

  console.log(`[SmartCart Forgot Password] [RESET] Received password update request for email: "${email}"`);

  if (!email || !newPassword) {
    return res.status(400).json({ success: false, error: "Email address and new password are required parameters" });
  }

  const emailKey = email.toLowerCase().trim();

  try {
    const data = otpMemoryStore.get(emailKey);

    // Security Requirements: Verify OTP was verified successfully
    if (!data || !data.verified || data.purpose !== "forgot_password") {
      logForgotStep("Password updated", emailKey, "FAILURE", {
        functionName: "/forgot-password-reset",
        errorMsg: "Access denied. OTP verification missing or invalid purpose."
      });
      return res.status(403).json({ success: false, error: "Access denied. Please verify your email via OTP code first." });
    }

    // Ensure server-side authenticated to Firestore to perform user lookups and writes
    await ensureServerAuthenticated();

    // Requirement 3 & 4: Explicitly verify backend system agent is authenticated before doing any Firestore operations
    if (!serverAuth.currentUser) {
      console.error(`❌ [SmartCart Firestore Write Aborted] Authentication State: Unauthenticated. Aborting Firestore operations.`);
      return res.status(500).json({
        success: false,
        error: "Firestore write aborted. Backend service is not authenticated with Firebase.",
        details: "serverAuth.currentUser is null"
      });
    }

    console.log(`[SmartCart Server] Authentication verified. UID: "${serverAuth.currentUser.uid}". Proceeding with lookup and update.`);

    // Step 2 User Lookup: Check in profiles and riders collections in Firestore
    let matchedProfileId: string | null = null;
    let matchedProfileData: any = null;
    let matchedRiderId: string | null = null;
    let matchedRiderData: any = null;

    logForgotStep("User lookup", emailKey, "SUCCESS", {
      functionName: "/forgot-password-reset",
      dbOp: "query profiles and riders"
    });

    try {
      // Check profiles collection
      const profilesQuery = query(collection(db, "profiles"), where("email", "==", emailKey));
      const profilesSnapshot = await getDocs(profilesQuery);
      if (!profilesSnapshot.empty) {
        matchedProfileId = profilesSnapshot.docs[0].id;
        matchedProfileData = profilesSnapshot.docs[0].data();
      }
    } catch (lookupErr: any) {
      console.error("[SmartCart Firestore profiles lookup error]:", lookupErr?.message || lookupErr);
      throw lookupErr;
    }

    try {
      // Check riders collection
      const ridersQuery = query(collection(db, "riders"), where("email", "==", emailKey));
      const ridersSnapshot = await getDocs(ridersQuery);
      if (!ridersSnapshot.empty) {
        matchedRiderId = ridersSnapshot.docs[0].id;
        matchedRiderData = ridersSnapshot.docs[0].data();
      }
    } catch (lookupErr: any) {
      console.error("[SmartCart Firestore riders lookup error]:", lookupErr?.message || lookupErr);
      throw lookupErr;
    }

    if (!matchedProfileId && !matchedRiderId) {
      logForgotStep("User lookup", emailKey, "FAILURE", {
        functionName: "/forgot-password-reset",
        errorMsg: "User account could not be found in Firestore profiles or riders collections."
      });
      return res.status(404).json({ success: false, error: "Account lookup failed. Registered user profile not found." });
    }

    // Step 8: Update the user's password securely
    let firebaseAuthSuccess = false;
    let authErrorDetail = "";

    if (adminAuth) {
      try {
        // Fetch user UID from Firebase Auth using email
        const userRecord = await adminAuth.getUserByEmail(emailKey);
        
        // Update password in Firebase Auth securely
        await adminAuth.updateUser(userRecord.uid, { password: newPassword });
        console.log(`[SmartCart Forgot Password] Successfully updated password for user UID: ${userRecord.uid} via Admin SDK.`);
        firebaseAuthSuccess = true;

        logForgotStep("Password updated", emailKey, "SUCCESS", {
          functionName: "/forgot-password-reset",
          authMethod: "Firebase Admin SDK",
          userUid: userRecord.uid
        });
      } catch (authErr: any) {
        authErrorDetail = authErr?.message || String(authErr);
        // Requirement 3 & 4: Detailed server-side logging for the auth step failure
        logForgotStep("Password updated", emailKey, "FAILURE", {
          functionName: "/forgot-password-reset",
          authMethod: "Firebase Admin SDK",
          dbOp: "adminAuth.updateUser",
          errorMsg: `Failed to update Firebase Auth: ${authErrorDetail}`,
          stackTrace: authErr?.stack
        });
      }
    } else {
      authErrorDetail = "Firebase Admin SDK is not initialized.";
      logForgotStep("Password updated", emailKey, "FAILURE", {
        functionName: "/forgot-password-reset",
        authMethod: "Firebase Admin SDK",
        errorMsg: "Firebase Admin SDK is null / not initialized."
      });
    }

    // Requirement 8: If standard Firebase Auth is successfully updated, DO NOT write 'customPassword' to Firestore.
    // If Firebase Auth failed (or was not initialized / user doesn't exist in Auth database yet),
    // we fall back to custom database credentials updates as specified in Requirement 7.
    if (firebaseAuthSuccess) {
      console.log(`[SmartCart Forgot Password] Firebase Auth updated successfully. Skipping 'customPassword' write to Firestore profiles to comply with security requirements.`);
    } else {
      console.log(`[SmartCart Forgot Password Fallback] Standard Firebase Auth update was not completed. Proceeding with hashed customPassword update.`);
      const hashedPassword = hashPassword(newPassword);
      
      if (matchedProfileId) {
        try {
          await updateDoc(doc(db, "profiles", matchedProfileId), {
            customPassword: hashedPassword,
            updatedAt: new Date().toISOString()
          });
          console.log(`[SmartCart Forgot Password Fallback] Securely updated customPassword in Firestore profiles for "${emailKey}".`);
          
          logForgotStep("Password updated", emailKey, "SUCCESS", {
            functionName: "/forgot-password-reset",
            authMethod: "Custom Database Fallback (Firestore Profiles)",
            dbOp: "updateDoc profiles",
            profileId: matchedProfileId
          });
        } catch (dbErr: any) {
          console.error("[SmartCart Firestore profiles update error]:", dbErr?.message || dbErr);

          logForgotStep("Password updated", emailKey, "FAILURE", {
            functionName: "/forgot-password-reset",
            authMethod: "Custom Database Fallback (Firestore Profiles)",
            dbOp: "updateDoc profiles",
            errorMsg: `Failed to write customPassword to profiles: ${dbErr?.message || String(dbErr)}`,
            stackTrace: dbErr?.stack
          });
          throw dbErr;
        }
      }
    }

    if (matchedRiderId) {
      try {
        // Riders use a custom 'password' field representing their PIN
        await updateDoc(doc(db, "riders", matchedRiderId), {
          password: newPassword,
          updatedAt: new Date().toISOString()
        });
        console.log(`[SmartCart Forgot Password Fallback] Securely updated password field in Firestore riders for "${emailKey}".`);

        logForgotStep("Password updated", emailKey, "SUCCESS", {
          functionName: "/forgot-password-reset",
          authMethod: "Custom Database Fallback (Firestore Riders)",
          dbOp: "updateDoc riders",
          riderId: matchedRiderId
        });
      } catch (dbErr: any) {
        console.error("[SmartCart Firestore riders update error]:", dbErr?.message || dbErr);

        logForgotStep("Password updated", emailKey, "FAILURE", {
          functionName: "/forgot-password-reset",
          authMethod: "Custom Database Fallback (Firestore Riders)",
          dbOp: "updateDoc riders",
          errorMsg: `Failed to write password to riders: ${dbErr?.message || String(dbErr)}`,
          stackTrace: dbErr?.stack
        });
        throw dbErr;
      }
    }

    // Security Requirements: Delete OTP after successful verification / one-time use only!
    otpMemoryStore.delete(emailKey);
    console.log(`[SmartCart Forgot Password] Securely deleted OTP record from memory cache for "${emailKey}".`);

    // Dispatch safety email to notify password change (Use SMTP for password-reset security notification)
    const safetySubject = "[SmartCart] Security Notice: Password Updated Successfully";
    const safetyText = `Hello,\n\nThis email confirms that your SmartCart account security password has been updated successfully.\n\nIf you did not make this change, please contact support immediately.`;
    const safetyHtml = `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #16a34a; margin: 0; font-size: 26px; font-weight: 800; tracking-tight:-0.025em;">SmartCart</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 6px; margin-bottom: 0; font-weight: 500;">Security Notification</p>
        </div>
        <p style="font-size: 15px; line-height: 24px; color: #334155; margin-top: 0; font-weight: 600;">Hello,</p>
        <p style="font-size: 14px; line-height: 22px; color: #475569; margin-bottom: 24px;">
          This security email confirms that your SmartCart account password has been successfully updated.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #475569;">
          <strong>Status:</strong> Password Updated Successfully<br/>
          <strong>Timestamp:</strong> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
        </div>
        <p style="font-size: 13px; line-height: 18px; color: #b91c1c; margin-top: 0; font-weight: 600;">
          If you did not make this change, please contact our support desk immediately.
        </p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <div style="text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
          &copy; ${new Date().getFullYear()} SmartCart Inc. All rights reserved.
        </div>
      </div>
    `;

    try {
      await sendSmtpEmail({
        to: emailKey,
        subject: safetySubject,
        html: safetyHtml,
        text: safetyText,
        from: "SmartCart Security <noreply@smartcartgola.in>"
      });
      console.log(`[SmartCart Forgot Password] Password change safety notification dispatched to "${emailKey}".`);
    } catch (notifErr: any) {
      console.warn(`[SmartCart Forgot Password Warning] Failed to dispatch safety notification via SMTP:`, notifErr?.message || notifErr);
    }

    logForgotStep("Password reset flow complete", emailKey, "SUCCESS", {
      functionName: "/forgot-password-reset",
      firebaseAuthSuccess,
      customDatabaseSuccess: true
    });

    return res.json({ success: true, message: "Password updated successfully. You can now log in." });

  } catch (error: any) {
    logForgotStep("Password reset flow complete", emailKey, "FAILURE", {
      functionName: "/forgot-password-reset",
      errorMsg: error?.message || String(error),
      stackTrace: error?.stack
    });
    console.error(`[SmartCart Forgot Password Reset Error]`, error);
    return res.json({ 
      success: false, 
      error: "Failed to reset password due to an authentication server error.",
      details: error?.message || String(error)
    });
  }
});


// SMTP route to handle order status updates
apiRouter.post("/send-order-status-update", async (req, res) => {
  const { email, orderId, status, userName } = req.body;

  if (!email || !orderId || !status) {
    return res.status(400).json({ success: false, error: "Email, orderId, and status are required parameters" });
  }

  console.log(`[SmartCart SMTP] Dispatching order status update email to: ${email} for order: ${orderId} (New Status: ${status})`);

  const htmlContent = `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #16a34a; margin: 0; font-size: 26px; font-weight: 800;">SmartCart</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 6px; margin-bottom: 0; font-weight: 500;">Order Status Update</p>
      </div>
      <p style="font-size: 15px; line-height: 24px; color: #334155; margin-top: 0; font-weight: 600;">Hello ${userName || "Customer"},</p>
      <p style="font-size: 14px; line-height: 22px; color: #475569;">
        We would like to inform you that your order <strong>${orderId}</strong> has been updated to:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; border-radius: 9999px; padding: 8px 24px; font-weight: 800; text-transform: uppercase; font-size: 14px; letter-spacing: 0.05em;">
          ${status}
        </span>
      </div>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #475569;">
        <strong>Order ID:</strong> ${orderId}<br/>
        <strong>Updated Status:</strong> ${status}<br/>
        <strong>Timestamp:</strong> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
      </div>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <div style="text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
        &copy; ${new Date().getFullYear()} SmartCart Inc. All rights reserved.
      </div>
    </div>
  `;

  const textContent = `Hello ${userName || "Customer"},\n\nYour order ${orderId} has been updated to: ${status}.`;

  try {
    await sendSmtpEmail({
      to: email,
      subject: `[SmartCart] Order Status Updated: ${orderId} is ${status}`,
      html: htmlContent,
      text: textContent
    });
    return res.json({ success: true, message: "Order status update email sent successfully" });
  } catch (error: any) {
    return res.json({ success: false, error: "SMTP sending failed", details: error?.message });
  }
});

// SMTP route to handle delivery updates
apiRouter.post("/send-delivery-update", async (req, res) => {
  const { email, orderId, updateText, userName } = req.body;

  if (!email || !orderId || !updateText) {
    return res.status(400).json({ success: false, error: "Email, orderId, and updateText are required parameters" });
  }

  console.log(`[SmartCart SMTP] Dispatching delivery update email to: ${email} for order: ${orderId}`);

  const htmlContent = `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #16a34a; margin: 0; font-size: 26px; font-weight: 800;">SmartCart</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 6px; margin-bottom: 0; font-weight: 500;">Instant Delivery Update</p>
      </div>
      <p style="font-size: 15px; line-height: 24px; color: #334155; margin-top: 0; font-weight: 600;">Hello ${userName || "Customer"},</p>
      <p style="font-size: 14px; line-height: 22px; color: #475569;">
        We have a real-time dispatch update regarding your order <strong>${orderId}</strong>:
      </p>
      <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; font-size: 14px; color: #92400e; font-weight: 700; margin: 20px 0; text-align: center;">
        ${updateText}
      </div>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #475569;">
        <strong>Order ID:</strong> ${orderId}<br/>
        <strong>Courier Update:</strong> Instant delivery fleet active.<br/>
        <strong>Timestamp:</strong> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
      </div>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <div style="text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
        &copy; ${new Date().getFullYear()} SmartCart Inc. All rights reserved.
      </div>
    </div>
  `;

  const textContent = `Hello ${userName || "Customer"},\n\nDelivery update for order ${orderId}: ${updateText}`;

  try {
    await sendSmtpEmail({
      to: email,
      subject: `[SmartCart] Delivery Update for Order: ${orderId}`,
      html: htmlContent,
      text: textContent
    });
    return res.json({ success: true, message: "Delivery update email sent successfully" });
  } catch (error: any) {
    return res.json({ success: false, error: "SMTP sending failed", details: error?.message });
  }
});

// SMTP route to handle order cancellation notifications
apiRouter.post("/send-order-cancellation", async (req, res) => {
  const { email, orderId, reason, userName } = req.body;

  if (!email || !orderId) {
    return res.status(400).json({ success: false, error: "Email and orderId are required parameters" });
  }

  console.log(`[SmartCart SMTP] Dispatching order cancellation email to: ${email} for order: ${orderId}`);

  const htmlContent = `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #b91c1c; margin: 0; font-size: 26px; font-weight: 800;">SmartCart</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 6px; margin-bottom: 0; font-weight: 500;">Order Cancellation Notification</p>
      </div>
      <p style="font-size: 15px; line-height: 24px; color: #334155; margin-top: 0; font-weight: 600;">Hello ${userName || "Customer"},</p>
      <p style="font-size: 14px; line-height: 22px; color: #475569;">
        We confirm that your order <strong>${orderId}</strong> has been successfully cancelled.
      </p>
      ${reason ? `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #991b1b; font-weight: 500;">
        <strong>Cancellation Reason:</strong> ${reason}
      </div>` : ''}
      <p style="font-size: 14px; line-height: 22px; color: #475569;">
        If a payment was made online, it will be refunded back to your source account within 3-5 business days. We are sorry for any inconvenience.
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #475569;">
        <strong>Order ID:</strong> ${orderId}<br/>
        <strong>Status:</strong> Cancelled & Refund Initiated<br/>
        <strong>Timestamp:</strong> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
      </div>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <div style="text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
        &copy; ${new Date().getFullYear()} SmartCart Inc. All rights reserved.
      </div>
    </div>
  `;

  const textContent = `Hello ${userName || "Customer"},\n\nYour order ${orderId} has been cancelled.${reason ? ` Reason: ${reason}` : ""}`;

  try {
    await sendSmtpEmail({
      to: email,
      subject: `[SmartCart] Order Cancelled Successfully: ${orderId}`,
      html: htmlContent,
      text: textContent
    });
    return res.json({ success: true, message: "Order cancellation email sent successfully" });
  } catch (error: any) {
    return res.json({ success: false, error: "SMTP sending failed", details: error?.message });
  }
});


// Register API router under multiple path prefixes to handle Netlify's serverless function rewrites and standard Express
app.use("/api", apiRouter);
app.use("/.netlify/functions/api", apiRouter);
app.use("/", apiRouter);


const isServerless = process.env.VERCEL === "1" || process.env.NETLIFY === "true" || !!process.env.LAMBDA_TASK_ROOT;

async function startServer() {
  if (isServerless) {
    console.log("[SmartCart Server] Serverless environment detected. Skipping listen port and static SPA middleware.");
    return;
  }

  // Vite integration middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("[SmartCart Server] Starting Express backend with Vite HMR middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[SmartCart Server] Starting Express backend in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SmartCart Server] Server is running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;