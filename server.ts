import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Reusable SMTP configuration resolver
function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "SmartCart <noreply@smartcart.local>"
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
  });
}

// SMTP route to dispatch OTP code during user registration
app.post("/api/send-otp", async (req, res) => {
  const { email, otp, name, isResend } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, error: "Email address and OTP code parameters are required" });
  }

  console.log(`[SmartCart SMTP] Received OTP request for code: ${email} -> ${otp} (isResend: ${!!isResend})`);

  const templateTitle = isResend ? "Resent Security Verification Code" : "Welcome to SmartCart! Verify Your Email";
  const templateDescription = isResend 
    ? "As requested, a fresh, secure OTP has been generated for your registration. This code is valid for <strong>5 minutes</strong>."
    : "Use the secure verification code below to verify your email address and authorize your account registration. This code is valid for <strong>5 minutes</strong>.";

  const htmlContent = `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #16a34a; margin: 0; font-size: 26px; font-weight: 800; tracking-tight: -0.025em; font-family: sans-serif;">SmartCart</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 6px; margin-bottom: 0; font-weight: 500;">SMTP Transactional Dispatcher</p>
      </div>
      <p style="font-size: 16px; line-height: 24px; color: #334155; margin-top: 0; font-weight: 600;">Hello ${name || "Customer"},</p>
      <p style="font-size: 14px; line-height: 22px; color: #475569; margin-bottom: 24px;">
        ${templateDescription}
      </p>
      <div style="background-color: #f0fdf4; border: 1px dashed #16a34a; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-family: monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #15803d; display: inline-block;">${otp}</span>
      </div>
      <p style="font-size: 13px; line-height: 18px; color: #64748b; margin-top: 0; margin-bottom: 16px;">
        This transmitter serves as the designated email verification gateway. If you did not initiate this request, you can safely ignore this correspondence.
      </p>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <div style="text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
        &copy; ${new Date().getFullYear()} SmartCart Inc. Powered by high-durability SMTP service.
      </div>
    </div>
  `;

  const textContent = `${templateTitle}\n\nHello ${name || "Customer"},\n\nYour security OTP verification code is: ${otp}\n\nThis OTP is valid for 5 minutes.`;

  try {
    await sendSmtpEmail({
      to: email,
      subject: isResend ? `[SmartCart] Resent Code: ${otp}` : `[SmartCart] Verification Code: ${otp}`,
      html: htmlContent,
      text: textContent
    });

    console.log(`[SmartCart SMTP] Verification email delivery succeeded to mail: ${email}`);
    return res.json({ 
      success: true, 
      message: "OTP sent successfully" // Requirement 5
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
app.post("/api/send-password-reset", async (req, res) => {
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
app.post("/api/send-order-confirmation", async (req, res) => {
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


async function startServer() {
  // Vite integration middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("[SmartCart Server] Starting Express backend with Vite HMR middleware...");
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

  if (process.env.VERCEL !== "1") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[SmartCart Server] Server is running on http://localhost:${PORT}`);
    });
  } else {
    console.log("[SmartCart Server] Vercel environment detected. Serverless routing active.");
  }
}

startServer();

export default app;
