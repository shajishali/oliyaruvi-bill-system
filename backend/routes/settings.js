const express = require('express');
const fs = require('fs');
const dns = require('dns');
const path = require('path');
const nodemailer = require('nodemailer');

if (typeof dns.setDefaultResultOrder === 'function') dns.setDefaultResultOrder('ipv4first');
const router = express.Router();
const db = require('../config/database');
const { log } = require('../lib/activityLog');

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function logoFile(ext) {
  return path.join(db.dbDir, `shop-logo.${ext}`);
}

function currentLogo() {
  const png = logoFile('png');
  const jpg = logoFile('jpg');
  if (fs.existsSync(png)) return { file: png, type: 'image/png' };
  if (fs.existsSync(jpg)) return { file: jpg, type: 'image/jpeg' };
  return null;
}

function imageKind(buffer, mime) {
  const isPng = buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isPng && (mime === 'image/png' || mime === '')) return 'png';
  if (isJpeg && (mime === 'image/jpeg' || mime === 'image/jpg' || mime === '')) return 'jpg';
  return null;
}

router.get('/logo', (req, res) => {
  try {
    const logo = currentLogo();
    if (!logo) return res.status(404).json({ error: 'No logo uploaded' });
    res.setHeader('Content-Type', logo.type);
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(logo.file);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logo', (req, res) => {
  try {
    const mime = String(req.body?.mime || '').toLowerCase();
    const raw = String(req.body?.data || '').replace(/^data:image\/[a-z+]+;base64,/, '');
    if (!raw) return res.status(400).json({ error: 'Choose a JPEG or PNG image.' });
    const buffer = Buffer.from(raw, 'base64');
    if (!buffer.length || buffer.length > MAX_LOGO_BYTES) {
      return res.status(400).json({ error: 'Logo must be a JPEG or PNG under 2 MB.' });
    }
    const kind = imageKind(buffer, mime);
    if (!kind) return res.status(400).json({ error: 'Only JPEG and PNG images can be used as the logo.' });

    for (const ext of ['png', 'jpg']) {
      const file = logoFile(ext);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.writeFileSync(logoFile(kind), buffer);
    log('settings_updated', 'settings', 1, { logo: kind });
    res.json({ ok: true, type: kind === 'png' ? 'image/png' : 'image/jpeg' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM shop_settings WHERE id = 1').get();
    if (settings) return res.json(settings);

    // If this is a fresh DB (no seed), create an empty row so the UI can work.
    // We intentionally store blanks so users enter real values manually.
    db.prepare(`
      INSERT INTO shop_settings (id, shop_name, address, contact, gstin, updated_at)
      VALUES (1, '', '', '', NULL, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO NOTHING
    `).run();
    const created = db.prepare('SELECT * FROM shop_settings WHERE id = 1').get();
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/branch-name', (req, res) => {
  try {
    const name = String(req.body?.branch_name || '').trim();
    if (!name) return res.status(400).json({ error: 'Branch name is required.' });
    db.prepare(`
      INSERT INTO shop_settings (id, shop_name, address, contact, gstin, updated_at)
      VALUES (1, '', '', '', NULL, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO NOTHING
    `).run();
    db.prepare('UPDATE shop_settings SET branch_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(name);
    const updated = db.prepare('SELECT * FROM shop_settings WHERE id = 1').get();
    log('settings_updated', 'settings', 1, { branch_name: name });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', (req, res) => {
  try {
    const { shop_name, address, contact, gstin, smtp_host, smtp_port, smtp_user, smtp_password, report_receiver_email } = req.body;

    // Upsert so it works on a brand-new/empty DB.
    db.prepare(`
      INSERT INTO shop_settings (
        id, shop_name, address, contact, gstin,
        smtp_host, smtp_port, smtp_user, smtp_password, report_receiver_email,
        updated_at
      )
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        shop_name = COALESCE(excluded.shop_name, shop_settings.shop_name),
        address = COALESCE(excluded.address, shop_settings.address),
        contact = COALESCE(excluded.contact, shop_settings.contact),
        gstin = COALESCE(excluded.gstin, shop_settings.gstin),
        smtp_host = COALESCE(excluded.smtp_host, shop_settings.smtp_host),
        smtp_port = COALESCE(excluded.smtp_port, shop_settings.smtp_port),
        smtp_user = COALESCE(excluded.smtp_user, shop_settings.smtp_user),
        smtp_password = COALESCE(excluded.smtp_password, shop_settings.smtp_password),
        report_receiver_email = COALESCE(excluded.report_receiver_email, shop_settings.report_receiver_email),
        updated_at = CURRENT_TIMESTAMP
    `).run(
      shop_name ?? '',
      address ?? '',
      contact ?? '',
      gstin ?? null,
      smtp_host ?? '',
      smtp_port ?? '587',
      smtp_user ?? '',
      smtp_password ?? '',
      report_receiver_email ?? ''
    );

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'branch_name')) {
      db.prepare('UPDATE shop_settings SET branch_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1')
        .run(String(req.body.branch_name || '').trim());
    }

    const updated = db.prepare('SELECT * FROM shop_settings WHERE id = 1').get();
    log('settings_updated', 'settings', 1, { shop_name: updated.shop_name, branch_name: updated.branch_name });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

router.post('/send-report', async (req, res) => {
  try {
    const saved = db.prepare('SELECT * FROM shop_settings WHERE id = 1').get() || {};
    const host = String(req.body?.smtp_host || saved.smtp_host || 'smtp.gmail.com').trim();
    const port = Number(req.body?.smtp_port || saved.smtp_port || 587);
    const user = String(req.body?.smtp_user || saved.smtp_user || '').trim();
    const password = String(req.body?.smtp_password || saved.smtp_password || '').replace(/\s+/g, '');
    const to = String(req.body?.report_receiver_email || saved.report_receiver_email || '').trim();
    const pdf = String(req.body?.pdf_base64 || '').replace(/^data:application\/pdf;base64,/, '');
    const fromDate = String(req.body?.from || '').slice(0, 10);
    const toDate = String(req.body?.to || '').slice(0, 10);
    const filename = `weekly-report-${fromDate || 'report'}-to-${toDate || 'report'}.pdf`;

    if (!looksLikeEmail(user)) return res.status(400).json({ error: 'Enter the Gmail address that sends the report.' });
    if (!password) return res.status(400).json({ error: 'Enter the Gmail app password.' });
    if (!looksLikeEmail(to)) return res.status(400).json({ error: 'Enter the email address that should receive the report.' });
    if (!pdf) return res.status(400).json({ error: 'The report could not be prepared.' });
    const buffer = Buffer.from(pdf, 'base64');
    if (!buffer.length || buffer.length > 4 * 1024 * 1024) {
      return res.status(400).json({ error: 'The report file is too large to send.' });
    }
    if (Number.isNaN(port) || port <= 0) return res.status(400).json({ error: 'Enter a valid SMTP port. Gmail uses 587.' });

    const shop = String(saved.shop_name || 'OLIYARUVI PRINTERS').trim() || 'OLIYARUVI PRINTERS';
    const period = fromDate && toDate ? `${fromDate} to ${toDate}` : 'this week';
    const message = {
      from: `"${shop}" <${user}>`,
      to,
      subject: `${shop} weekly report ${period}`,
      text: `The weekly report for ${period} is attached. It includes stock, sales, and profit.`,
      attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
    };
    const attempts = [port === 465 ? 465 : 587, port === 465 ? 587 : 465];
    let sent = false;
    let lastError = null;
    for (const attemptPort of attempts) {
      const transporter = nodemailer.createTransport({
        host,
        port: attemptPort,
        secure: attemptPort === 465,
        requireTLS: attemptPort === 587,
        family: 4,
        auth: { user, pass: password },
        connectionTimeout: 60000,
        greetingTimeout: 60000,
        socketTimeout: 120000,
        tls: { servername: host, minVersion: 'TLSv1.2' },
      });
      try {
        await transporter.sendMail(message);
        sent = true;
        break;
      } catch (err) {
        lastError = err;
        const detail = String(err && err.message ? err.message : err);
        console.error('[weekly-report]', attemptPort, err && err.code, detail.slice(0, 180));
        if (!/ECONNRESET|ETIMEDOUT|ECONNREFUSED|ESOCKET|Greeting never received|Connection timeout|Unexpected socket close|socket hang up/i.test(detail)) break;
      }
    }
    if (!sent) throw lastError || new Error('Could not send the email.');
    log('settings_updated', 'settings', 1, { weekly_report_sent: to, from: fromDate, to: toDate });
    res.json({ ok: true, message: `Report sent to ${to}` });
  } catch (err) {
    const raw = String(err && (err.response || err.message) ? (err.response || err.message) : '');
    const rejected = /Invalid login|Username and Password not accepted|BadCredentials|535/i.test(raw);
    const blocked = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|ESOCKET|Greeting never received|Connection timeout|Unexpected socket close|socket hang up/i.test(raw);
    const message = rejected
      ? 'Gmail rejected the email or app password. Use a Gmail app password, not the normal Gmail password.'
      : blocked
        ? 'Gmail was too slow to answer. The internet is connected. Click Send to mail again.'
        : 'Could not send the email.';
    res.status(500).json({ error: message });
  }
});

module.exports = router;
