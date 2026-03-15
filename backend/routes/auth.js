const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// Allowed email for OTP reset - change in .env as RESET_EMAIL
const ALLOWED_EMAIL = (process.env.RESET_EMAIL || 'shakiththiyanpirabakaran20000@gmail.com').toLowerCase();

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
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PWD || process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) return null;
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: gmailUser, pass: gmailPass },
    connectionTimeout: 15000,
  });
  const fromName = process.env.GMAIL_FROM_NAME || 'Oliyaruvi Printers';
  await transporter.sendMail({
    from: `"${fromName}" <${gmailUser}>`,
    to,
    subject,
    html,
  });
}

async function sendViaResend(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
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
router.post('/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed) {
      return res.status(400).json({ error: 'Email required' });
    }
    if (trimmed !== ALLOWED_EMAIL) {
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

    const resendKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
    const hasGmail = process.env.GMAIL_USER && (process.env.GMAIL_APP_PWD || process.env.GMAIL_APP_PASSWORD);
    let sent = false;
    let lastError = null;
    let method = null;

    // Try Resend first when configured (HTTPS, works when Gmail SMTP is blocked)
    if (resendKey) {
      try {
        await sendViaResend(trimmed, subject, html);
        sent = true;
        method = 'resend';
      } catch (err) {
        lastError = err;
        console.warn('[OTP] Resend failed:', err.message);
      }
    }

    // Fallback to Gmail if Resend failed or not configured
    if (!sent && hasGmail) {
      try {
        await sendViaGmail(trimmed, subject, html);
        sent = true;
        method = 'gmail';
      } catch (err) {
        lastError = err;
        if (isConnectionError(err)) {
          console.warn('[OTP] Gmail blocked, Resend not configured:', err.message);
        } else {
          throw err;
        }
      }
    }

    if (!sent) {
      throw new Error(
        lastError && isConnectionError(lastError)
          ? 'Gmail blocked. Add RESEND_KEY to .env (resend.com/api-keys) as fallback.'
          : 'GMAIL_APP_PWD or RESEND_KEY required in .env. See OTP_EMAIL_SETUP.md'
      );
    }

    res.json({ success: true, message: 'OTP sent to your email', method });
  } catch (err) {
    console.error('OTP send error:', err.message);
    let msg = err.message || 'Failed to send email';
    if (/ECONNRESET|ETIMEDOUT|ECONNREFUSED|Greeting never received/i.test(msg)) {
      msg = 'Gmail blocked. Add RESEND_KEY to .env (resend.com/api-keys) as fallback.';
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
