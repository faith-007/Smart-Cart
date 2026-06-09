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
    host: config.host, port: config.port, secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    tls: { rejectUnauthorized: false }
  });
  await transporter.sendMail({ from: config.from, to, subject, text, html });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { email, userName } = JSON.parse(event.body);
  if (!email) return { statusCode: 400, body: JSON.stringify({ success: false, error: "Email required" }) };

  const htmlContent = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px 24px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;">
      <h2 style="color:#16a34a;text-align:center;">SmartCart</h2>
      <p>Hello ${userName || "Customer"},</p>
      <p>Your SmartCart password has been successfully updated.</p>
      <p style="color:#b91c1c;font-weight:600;">If you didn't make this change, contact support immediately.</p>
    </div>`;

  try {
    await sendSmtpEmail({
      to: email,
      subject: `[SmartCart] Security Notice: Password Updated Successfully`,
      html: htmlContent,
      text: `Hello ${userName || "Customer"}, your password was updated. If not you, contact support immediately.`
    });
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
