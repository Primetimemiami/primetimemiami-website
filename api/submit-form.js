const { Resend } = require("resend");
const { render } = require("@react-email/render");
const React = require("react");
const { WelcomeEmail } = require("./emails/welcome.js");
const { InquiryEmail } = require("./emails/inquiry.js");

// Supabase REST API — Prime Time Miami project
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseInsert(table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Supabase ${res.status}`);
  }
  const data = await res.json();
  return data[0];
}

// Lazy-init Resend
let resend;
function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Styled notification wrapper
function wrapNotification(bodyHtml) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a; background: #fafafa;">
      <div style="border-bottom: 2px solid #1a1a1a; padding-bottom: 14px; margin-bottom: 28px;">
        <strong style="font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #1a1a1a;">PRIME TIME MIAMI</strong>
      </div>
      ${bodyHtml}
      <div style="border-top: 1px solid #e5e5e5; margin-top: 32px; padding-top: 14px; font-size: 11px; color: #aaa;">
        Sent automatically from primetimemiami.com
      </div>
    </div>
  `;
}

function fieldRow(label, value) {
  if (!value) return "";
  return `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #888; width: 100px; vertical-align: top;">${label}</td>
      <td style="padding: 10px 0 10px 16px; border-bottom: 1px solid #eee; font-size: 15px; color: #1a1a1a; vertical-align: top;">${value}</td>
    </tr>
  `;
}

function fieldTable(fields) {
  const rows = fields.map(f => fieldRow(f.label, f.value)).filter(Boolean).join("");
  if (!rows) return "";
  return `<table style="width: 100%; border-collapse: collapse; margin-top: 8px;">${rows}</table>`;
}

// Email templates per submission type
function buildEmail(type, data) {
  const name = data.full_name || "Not provided";
  const email = data.email;
  const watch = data.watch_name || null;
  const ref = data.watch_ref || null;
  const details = data.watch_details || null;

  const templates = {
    JOIN_LIST: {
      subject: `\u{1F7E2} New Signup: ${name}`,
      body: wrapNotification(`
        <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 20px; color: #1a1a1a;">New Private List Signup</h2>
        ${fieldTable([
          { label: "Name", value: name },
          { label: "Email", value: email },
          { label: "Details", value: details },
        ])}
      `),
    },
    BUY: {
      subject: `\u{1F535} Sourcing: ${watch || "New Request"}`,
      body: wrapNotification(`
        <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 20px; color: #1a1a1a;">New Sourcing Request</h2>
        ${fieldTable([
          { label: "Name", value: name },
          { label: "Email", value: email },
          { label: "Watch", value: watch },
          { label: "Reference", value: ref },
          { label: "Details", value: details },
        ])}
      `),
    },
    SELL: {
      subject: `\u{1F7E1} Sell: ${watch || "New Request"}`,
      body: wrapNotification(`
        <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 20px; color: #1a1a1a;">New Sell Request</h2>
        ${fieldTable([
          { label: "Name", value: name },
          { label: "Email", value: email },
          { label: "Watch", value: watch },
          { label: "Reference", value: ref },
          { label: "Details", value: details },
        ])}
      `),
    },
    TRADE: {
      subject: `\u{1F504} Trade: ${watch || "New Request"}`,
      body: wrapNotification(`
        <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 20px; color: #1a1a1a;">New Trade Request</h2>
        ${fieldTable([
          { label: "Name", value: name },
          { label: "Email", value: email },
          { label: "Watch", value: watch },
          { label: "Reference", value: ref },
          { label: "Details", value: details },
        ])}
      `),
    },
    WATCH_DETAIL: {
      subject: `\u{1F441} Inquiry: ${watch || "Unknown"}`,
      body: wrapNotification(`
        <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 20px; color: #1a1a1a;">New Watch Inquiry</h2>
        ${fieldTable([
          { label: "Name", value: name },
          { label: "Email", value: email },
          { label: "Watch", value: watch },
          { label: "Reference", value: ref },
          { label: "Details", value: details },
        ])}
      `),
    },
  };
  return templates[type];
}

module.exports = async (req, res) => {
  console.log("[submit-form] Function invoked, method:", req.method);

  const allowedOrigins = ["https://primetimemiami.com", "https://www.primetimemiami.com"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (process.env.VERCEL_ENV !== "production") {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("[submit-form] Using SUPABASE_URL:", SUPABASE_URL);

  try {
    const { type, fullName, email, watchDetails, watchName, watchRef, watchImage, watchBrand, intent, budget, lookingFor } = req.body;

    console.log("[submit-form] Parsed payload -type:", type, "email:", email, "watchName:", watchName || "(none)");

    // Validate
    if (!type || !email) {
      console.error("[submit-form] VALIDATION FAIL -missing type or email");
      return res.status(400).json({ error: "Missing required fields" });
    }

    const validTypes = ["JOIN_LIST", "BUY", "SELL", "TRADE", "WATCH_DETAIL"];
    if (!validTypes.includes(type)) {
      console.error("[submit-form] VALIDATION FAIL -invalid type:", type);
      return res.status(400).json({ error: "Invalid submission type" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error("[submit-form] VALIDATION FAIL -invalid email:", email);
      return res.status(400).json({ error: "Invalid email" });
    }

    // For JOIN_LIST from footer form, pack intent/budget/lookingFor into watch_details
    // so the team actually sees the qualifying info in his inbox + Supabase
    let detailsForRow = watchDetails?.trim() || null;
    if (type === "JOIN_LIST") {
      const parts = [];
      if (intent) parts.push(`Intent: ${intent}`);
      if (budget) parts.push(`Budget: ${budget}`);
      if (lookingFor && String(lookingFor).trim()) parts.push(`Looking for: ${String(lookingFor).trim()}`);
      if (parts.length) detailsForRow = parts.join(" | ");
    }

    // Insert into Supabase
    const row = {
      submission_type: type,
      email: email.toLowerCase().trim(),
      full_name: fullName?.trim() || null,
      watch_details: detailsForRow,
      watch_name: watchName?.trim() || null,
      watch_ref: watchRef?.trim() || null,
      status: "new",
    };

    console.log("[submit-form] Inserting into Supabase...");
    const data = await supabaseInsert("pt_submissions", row);
    console.log("[submit-form] Supabase insert SUCCESS -id:", data.id);

    // ── EMAIL SENDING (non-critical — never fails the request) ──
    let emailSent = false;
    let welcomeSent = false;
    let inquirySent = false;
    let emailDebug = null;

    try {
      const template = buildEmail(type, data);
      const emailPromises = [];

      // 1. Notification email to the team
      if (template) {
        const toEmail = process.env.NOTIFICATION_EMAIL || "info@primetimemiami.com";
        console.log("[submit-form] Queuing notification email to:", toEmail);

        emailPromises.push(
          getResend().emails.send({
            from: "Prime Time Miami <inquiries@mail.primetimemiami.com>",
            to: toEmail,
            subject: template.subject,
            html: template.body,
          }).then(result => {
            if (result.error) { console.error("[submit-form] NOTIFICATION EMAIL ERROR:", JSON.stringify(result.error)); emailDebug = result.error.message || JSON.stringify(result.error); }
            else { console.log("[submit-form] Notification sent -ID:", result.data?.id); emailSent = true; }
            return result;
          }).catch(err => {
            console.error("[submit-form] NOTIFICATION EMAIL THREW:", err.message);
            emailDebug = err.message;
          })
        );
      }

      // 2. Welcome email to subscriber (JOIN_LIST only)
      if (type === "JOIN_LIST") {
        const firstName = data.full_name ? data.full_name.split(" ")[0] : null;
        console.log("[submit-form] Queuing welcome email to:", data.email);

        emailPromises.push(
          render(React.createElement(WelcomeEmail, { firstName }))
            .then(welcomeHtml =>
              getResend().emails.send({
                from: "Prime Time Miami <inquiries@mail.primetimemiami.com>",
                to: data.email,
                subject: "Welcome to the Private List",
                html: welcomeHtml,
              })
            )
            .then(result => {
              if (result.error) console.error("[submit-form] WELCOME EMAIL ERROR:", JSON.stringify(result.error));
              else { console.log("[submit-form] Welcome email sent -ID:", result.data?.id); welcomeSent = true; }
              return result;
            })
            .catch(err => {
              console.error("[submit-form] WELCOME EMAIL THREW:", err.message);
            })
        );
      }

      // 3. Inquiry confirmation email to user (WATCH_DETAIL or BUY)
      if (type === "WATCH_DETAIL" || type === "BUY") {
        const firstName = data.full_name ? data.full_name.split(" ")[0] : null;
        console.log("[submit-form] Queuing inquiry confirmation to:", data.email);

        emailPromises.push(
          render(React.createElement(InquiryEmail, {
            firstName,
            watchName: data.watch_name || null,
            watchRef: data.watch_ref || null,
            watchBrand: watchBrand || null,
            watchImage: watchImage || null,
          }))
            .then(inquiryHtml =>
              getResend().emails.send({
                from: "Prime Time Miami <inquiries@mail.primetimemiami.com>",
                to: data.email,
                subject: `Your Inquiry: ${data.watch_name || "Watch Inquiry"}`,
                html: inquiryHtml,
              })
            )
            .then(result => {
              if (result.error) console.error("[submit-form] INQUIRY EMAIL ERROR:", JSON.stringify(result.error));
              else { console.log("[submit-form] Inquiry email sent -ID:", result.data?.id); inquirySent = true; }
              return result;
            })
            .catch(err => {
              console.error("[submit-form] INQUIRY EMAIL THREW:", err.message);
            })
        );
      }

      await Promise.all(emailPromises);
    } catch (emailErr) {
      emailDebug = emailErr.message;
      console.error("[submit-form] EMAIL BLOCK ERROR (non-fatal):", emailErr.message);
    }

    return res.status(200).json({
      success: true,
      id: data.id,
      emailSent,
      welcomeSent,
      inquirySent,
      _debug: emailDebug || null,
    });
  } catch (err) {
    console.error("[submit-form] UNHANDLED ERROR:", err.message);
    console.error("[submit-form] STACK:", err.stack);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
};
