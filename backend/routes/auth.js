const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const db = require('../config/database');

// Allowed email for OTP reset - set RESET_EMAIL in .env or uses default below
const ALLOWED_EMAIL = (process.env.RESET_EMAIL || 'oliyaruviprinters@gmail.com').toLowerCase();

function getAuthSmtpFromSettings() {
  try {
    const row = db.prepare('SELECT auth_smtp_host, auth_smtp_port, auth_smtp_user, auth_smtp_password, shop_name FROM shop_settings WHERE id = 1').get();
    if (!row) return null;
    const user = String(row.auth_smtp_user || '').trim();
    const pass = String(row.auth_smtp_password || '').replace(/\s+/g, '');
    if (!user || !pass) return null;
    return {
      host: String(row.auth_smtp_host || 'smtp.gmail.com').trim() || 'smtp.gmail.com',
      port: Number(row.auth_smtp_port || 587) || 587,
      user,
      pass,
      fromName: String(row.shop_name || 'Billing System').trim() || 'Billing System',
    };
  } catch {
    return null;
  }
}

function getResendKey() {
  const raw = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.resend_key || process.env.resend_api_key;
  return raw ? String(raw).trim() : '';
}

// In-memory OTP store: { email: { otp, expires } }
const otpStore = new Map();

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanupExpired() {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (data.expires < now) otpStore.delete(email);
  }
}

function isConnectionError(err) {
  const msg = (err && err.message) || '';
  return /ECONNRESET|ETIMEDOUT|ECONNREFUSED|Greeting never received|Connection timeout/i.test(msg);
}

async function sendViaGmail(to, subject, html) {
  const fromSettings = getAuthSmtpFromSettings();
  const gmailUser = fromSettings?.user || process.env.GMAIL_USER;
  const gmailPass = fromSettings?.pass || process.env.GMAIL_APP_PWD || process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) return null;
  const host = fromSettings?.host || 'smtp.gmail.com';
  const port = fromSettings?.port || 587;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: gmailUser, pass: gmailPass },
    connectionTimeout: 15000,
  });
  const fromName = fromSettings?.fromName || process.env.GMAIL_FROM_NAME || 'Billing System';
  await transporter.sendMail({
    from: `"${fromName}" <${gmailUser}>`,
    to,
    subject,
    html,
  });
  return true;
}

async function sendViaResend(to, subject, html) {
  const apiKey = getResendKey();
  if (!apiKey) return null;
  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM || 'onboarding@resend.dev';
  const fromName = process.env.RESEND_FROM_NAME || 'Oliyaruvi Printers';
  const { error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject,
    html,
  });
  if (error) throw new Error(error.message);
}

// POST /api/auth/request-otp - Send OTP via Gmail or Resend (Resend fallback when Gmail blocked)
// appUser: true = allow any email (for app login forgot password); otherwise restrict to RESET_EMAIL
router.post('/request-otp', async (req, res) => {
  try {
    const { email, appUser } = req.body;
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed) {
      return res.status(400).json({ error: 'Email required' });
    }
    if (!appUser && trimmed !== ALLOWED_EMAIL) {
      return res.status(400).json({ error: `Only ${ALLOWED_EMAIL} can reset password` });
    }

    const otp = generateOTP();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(trimmed, { otp, expires });
    cleanupExpired();

    const subject = 'Your OTP for Password Reset';
    const html = `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset OTP</h2>
        <p>Your OTP for resetting the admin password is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #dc2626;">${otp}</p>
        <p style="color: #666; font-size: 14px;">This OTP expires in 10 minutes. Do not share it with anyone.</p>
        <p style="color: #666; font-size: 14px;">If you did not request this, please ignore this email.</p>
      </div>
    `;

    const resendKey = getResendKey();
    const settingsSmtp = getAuthSmtpFromSettings();
    const hasEnvGmail = process.env.GMAIL_USER && (process.env.GMAIL_APP_PWD || process.env.GMAIL_APP_PASSWORD);
    const hasGmail = !!(settingsSmtp || hasEnvGmail);
    let sent = false;
    let lastError = null;
    let resendError = null;
    let method = null;

    // Prefer Settings → System email (forgot password) Gmail first.
    if (hasGmail) {
      try {
        await sendViaGmail(trimmed, subject, html);
        sent = true;
        method = 'gmail';
      } catch (err) {
        lastError = err;
        if (isConnectionError(err)) {
          console.warn('[OTP] Gmail failed:', err.message);
        } else {
          throw err;
        }
      }
    }

    // Fallback to Resend when Gmail failed or not configured
    if (!sent && resendKey) {
      try {
        await sendViaResend(trimmed, subject, html);
        sent = true;
        method = 'resend';
      } catch (err) {
        resendError = err;
        lastError = err;
        console.warn('[OTP] Resend failed:', err.message);
      }
    }

    if (!sent) {
      if (resendKey && resendError) {
        throw new Error(resendError.message || String(resendError));
      }
      throw new Error(
        lastError && isConnectionError(lastError)
          ? 'Gmail blocked. Set System email (forgot password) in Settings, or add RESEND_API_KEY to backend/.env.'
          : 'Set System email (forgot password) Gmail + app password in Settings, or add RESEND_API_KEY to backend/.env.'
      );
    }

    res.json({ success: true, message: 'OTP sent to your email', method });
  } catch (err) {
    console.error('OTP send error:', err.message);
    let msg = err.message || 'Failed to send email';
    if (/ECONNRESET|ETIMEDOUT|ECONNREFUSED|Greeting never received/i.test(msg)) {
      msg = 'Gmail blocked. Add RESEND_API_KEY or RESEND_KEY to backend/.env (resend.com/api-keys).';
    }
    res.status(500).json({ error: msg });
  }
});

// POST /api/auth/verify-otp - Verify OTP
router.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed || !otp) {
      return res.status(400).json({ error: 'Email and OTP required' });
    }

    const stored = otpStore.get(trimmed);
    if (!stored) {
      return res.status(400).json({ error: 'OTP expired or not found. Request a new one.' });
    }
    if (Date.now() > stored.expires) {
      otpStore.delete(trimmed);
      return res.status(400).json({ error: 'OTP expired. Request a new one.' });
    }
    if (String(otp).trim() !== stored.otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    otpStore.delete(trimmed);
    res.json({ success: true, valid: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
