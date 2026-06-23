import express from "express";
import path from "path";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Reusable SMTP configuration resolver
function getSmtpConfig() {
  let fromDefault = "SmartCart Support <noreply@smartcart.local>";
  if (process.env.SMTP_FROM) {
    const rawFrom = process.env.SMTP_FROM.trim();
    if (rawFrom.includes("<")) {
      fromDefault = rawFrom.replace(/^[^<]+/, "SmartCart Support ");
    } else {
      fromDefault = `"SmartCart Support" <${rawFrom}>`;
    }
  }

  return {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: fromDefault
  };
}

// 8. Reusable SMTP email service
async function sendSmtpEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const config = getSmtpConfig();
  
  if (!config.host || !config.user || !config.pass) {
    console.error("[SmartCart SMTP Error] Missing workspace SMTP environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS).");
    throw new Error("SMTP credentials are not fully configured in your environment variables. Please provide SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM inside your environment settings.");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false // Prevents failure on self-signed certificates
    }
  });

  console.log(`[SmartCart SMTP] Dispatching email to: ${to} | Subject: "${subject}"`);
  await transporter.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html,
    headers: {
      "X-Priority": "3", // Normal
      "Importance": "normal",
      "X-Entity-Ref-ID": `${Date.now()}-${to}`,
    }
  });
}

// Create API router to easily support both local development and Netlify/Vercel serverless custom path mappings
const apiRouter = express.Router();

// SMTP route to dispatch OTP code during user registration
apiRouter.post("/send-otp", async (req, res) => {
  const { email, otp, name, isResend } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, error: "Email address and OTP code parameters are required" });
  }

  console.log(`[SmartCart SMTP] Received OTP request for code: ${email} -> ${otp} (isResend: ${!!isResend})`);

  const templateTitle = "Smart Cart Verification OTP";
  
  const rawBody = `Welcome to Smart Cart.

Complete account activation using this code shown below. This unique security credential confirms ownership of the registered email address and enables to start shopping, tracking, saved addresses, management, delivery updates, and other platform features.

━━━━━━━━━━━━━━━━━━
🔐 Verification OTP

{{OTP}}

━━━━━━━━━━━━━━━━━━

Validity period: 10 minutes.

For your protection, enter this code on the screen. Any unmatched submission will not complete activation. If this message reaches an unintended recipient, no further action is required.

We appreciate your trust and look forward to serving your grocery, household, personal care, snack, pet, and daily essential needs.

Website: https://smartcartgola.netlify.app

Our Team`;

  const finalBody = rawBody.replace("{{OTP}}", otp);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Smart Cart Verification OTP</title>
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
                    Smart Cart
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 24px 32px 40px 32px; font-size: 15px; line-height: 1.6; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              
              <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 20px; font-weight: 700; color: #0f172a; text-align: left;">
                Welcome to Smart Cart.
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
                  ${otp}
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
              This is an automated operational security notification sent by Smart Cart Support.<br />
              &copy; ${new Date().getFullYear()} Smart Cart. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textContent = finalBody;

  try {
    await sendSmtpEmail({
      to: email,
      subject: templateTitle,
      html: htmlContent,
      text: textContent
    });

    console.log(`[SmartCart SMTP] Verification email delivery succeeded to mail: ${email}`);
    return res.json({ 
      success: true, 
      message: "OTP sent successfully"
    });

  } catch (error: any) {
    console.error(`[SmartCart SMTP Failure] Error sending OTP email to ${email}:`, error?.message || error);
    
    return res.json({ 
      success: false, 
      error: "Email sending failed",
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
        <p style="color: #64748b; font-size: 14px; margin-top: 6px; margin-bottom: 0; font-weight: 500;">Security Notification: SMTP Active Mode</p>
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
      text: textContent
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
        &copy; ${new Date().getFullYear()} SmartCart Inc. Delivered instantly via reusable SMTP service.
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

    return res.json({ success: true, message: "Order confirmation email successfully sent" });
  } catch (error: any) {
    console.error(`[SmartCart SMTP Failure] Error sending order confirmation email to ${email}:`, error?.message || error);
    return res.json({ success: false, error: "Email sending failed", details: error?.message || String(error) });
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