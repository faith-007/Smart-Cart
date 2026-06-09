const nodemailer = require("nodemailer");

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

async function sendSmtpEmail({ to, subject, html, text }) {
  const config = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    tls: { rejectUnauthorized: false }
  });
  await transporter.sendMail({ from: config.from, to, subject, text, html });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { email, otp, name, isResend } = JSON.parse(event.body);

  if (!email || !otp) return { statusCode: 400, body: JSON.stringify({ success: false, error: "Email and OTP required" }) };

  const templateDescription = isResend
    ? "A fresh OTP has been generated. Valid for <strong>5 minutes</strong>."
    : "Use the code below to verify your email. Valid for <strong>5 minutes</strong>.";

  const htmlContent = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px 24px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;">
      <h2 style="color:#16a34a;text-align:center;">SmartCart</h2>
      <p>Hello ${name || "Customer"},</p>
      <p>${templateDescription}</p>
      <div style="background:#f0fdf4;border:1px dashed #16a34a;border-radius:12px;padding:20px;text-align:center;">
        <span style="font-family:monospace;font-size:34px;font-weight:800;letter-spacing:8px;color:#15803d;">${otp}</span>
      </div>
      <p style="color:#64748b;font-size:13px;margin-top:16px;">If you didn't request this, ignore this email.</p>
    </div>`;

  try {
    await sendSmtpEmail({
      to: email,
      subject: isResend ? `[SmartCart] Resent Code: ${otp}` : `[SmartCart] Verification Code: ${otp}`,
      html: htmlContent,
      text: `Your OTP is: ${otp}. Valid for 5 minutes.`
    });
    return { statusCode: 200, body: JSON.stringify({ success: true, message: "OTP sent successfully" }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
