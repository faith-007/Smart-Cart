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

  const { email, order } = JSON.parse(event.body);
  if (!email || !order) return { statusCode: 400, body: JSON.stringify({ success: false, error: "Email and order required" }) };

  const itemsHtml = order.items?.map(item => `
    <tr>
      <td style="padding:8px 0;">${item.product?.name || "Item"}</td>
      <td style="text-align:center;">${item.quantity}</td>
      <td style="text-align:right;">₹${(item.product?.sellingPrice || 0) * item.quantity}</td>
    </tr>`).join("") || "";

  const htmlContent = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;">
      <h2 style="color:#16a34a;text-align:center;">SmartCart</h2>
      <p>Thank you, ${order.address?.name || "Customer"}! Your order <strong>${order.id}</strong> is confirmed.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="border-bottom:1px solid #e2e8f0;">
          <th style="text-align:left;padding:8px 0;">Item</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Price</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <p style="text-align:right;font-weight:800;margin-top:16px;">Total: ₹${order.total}</p>
      <p style="color:#15803d;">Delivery to: ${order.address?.addressLine}, ${order.address?.city}</p>
    </div>`;

  try {
    await sendSmtpEmail({
      to: email,
      subject: `[SmartCart] Order Confirmed: ${order.id}`,
      html: htmlContent,
      text: `Order ${order.id} confirmed. Total: ₹${order.total}`
    });
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
