const https = require("https");
const fs = require("fs");
const path = require("path");

// Try to read .env or .env.local if present
function loadEnv() {
  const envFiles = [".env", ".env.local", ".env.production"];
  for (const file of envFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  }
}

loadEnv();

const apiKey = (process.env.BREVO_API_KEY || process.env.BREVO_KEY || "").trim();
const senderName = (process.env.BREVO_SENDER_NAME || process.env.BREVO_FROM_NAME || "LMX8 IMPORTS").trim();
const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.BREVO_FROM_EMAIL || "lexmedia8gh@gmail.com").trim();
const testRecipient = process.argv[2] || "natlexmediah@gmail.com";

console.log("=== BREVO TEST DISPATCH ===");
console.log(`API Key configured: ${apiKey ? `Yes (starts with ${apiKey.substring(0, 8)}...)` : "No"}`);
console.log(`Sender: "${senderName}" <${senderEmail}>`);
console.log(`Recipient: ${testRecipient}`);

if (!apiKey) {
  console.error("FAIL: No Brevo API Key found in environment variables (BREVO_API_KEY or BREVO_KEY).");
  process.exit(1);
}

const payload = JSON.stringify({
  sender: { name: senderName, email: senderEmail },
  to: [{ email: testRecipient, name: "Test Customer" }],
  subject: `LMX8 IMPORTS — Brevo Live Verification (${new Date().toLocaleTimeString()})`,
  htmlContent: `
    <div style="font-family: Arial, sans-serif; padding: 24px; background: #0A0D1D; color: #FFFFFF; border-radius: 12px;">
      <h1 style="color: #FFB800; margin-top: 0;">LMX8 IMPORTS</h1>
      <p style="font-size: 16px; color: #E2E8F0;">Brevo Transactional Email Live Test</p>
      <p style="font-size: 14px; color: #94A3B8;">This email confirms that the Brevo API integration is operational and capable of delivering transactional shipment timeline emails.</p>
      <div style="background: #141B47; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #1E295F;">
        <p style="margin: 4px 0; color: #CBD5E1;"><strong>Status:</strong> VERIFIED</p>
        <p style="margin: 4px 0; color: #CBD5E1;"><strong>Sender:</strong> ${senderName} &lt;${senderEmail}&gt;</p>
        <p style="margin: 4px 0; color: #CBD5E1;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      </div>
      <p style="font-size: 12px; color: #64748B;">LMX8 IMPORTS CTRL ROOM — Automated Diagnostics</p>
    </div>
  `,
  textContent: `LMX8 IMPORTS - Brevo Live Test\nStatus: VERIFIED\nTimestamp: ${new Date().toISOString()}`
});

const options = {
  hostname: "api.brevo.com",
  port: 443,
  path: "/v3/smtp/email",
  method: "POST",
  headers: {
    "api-key": apiKey,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  },
};

const req = https.request(options, (res) => {
  let responseData = "";
  res.on("data", (chunk) => {
    responseData += chunk;
  });
  res.on("end", () => {
    console.log(`\nBrevo HTTP Response Status: ${res.statusCode} ${res.statusMessage}`);
    console.log(`Brevo Response Body: ${responseData}`);
    
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log("\n>>> SUCCESS: Brevo accepted the email dispatch request! <<<");
      try {
        const parsed = JSON.parse(responseData);
        if (parsed.messageId) {
          console.log(`Brevo messageId: ${parsed.messageId}`);
        }
      } catch (e) {}
    } else {
      console.error(`\n>>> FAILURE: Brevo returned an error: ${responseData} <<<`);
    }
  });
});

req.on("error", (error) => {
  console.error(`\n>>> NETWORK ERROR: ${error.message} <<<`);
});

req.write(payload);
req.end();
