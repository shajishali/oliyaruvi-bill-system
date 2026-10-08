#!/usr/bin/env node
/**
 * Test Resend API key - run from backend folder: node scripts/test-resend.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Resend } = require('resend');

const key = (process.env.RESEND_KEY || process.env.RESEND_API_KEY || '').trim();
const testEmail = process.env.RESET_EMAIL || '';

if (!key) {
  console.error('❌ No RESEND_KEY or RESEND_API_KEY in .env');
  process.exit(1);
}

console.log('Testing Resend API key...');
console.log('Key prefix:', key.substring(0, 15) + '...');
console.log('Sending test to:', testEmail);

const resend = new Resend(key);
resend.emails
  .send({
    from: 'Oliyaruvi Printers <onboarding@resend.dev>',
    to: [testEmail],
    subject: 'OTP Test - Oliyaruvi Printers',
    html: '<p>If you received this, your Resend API key works!</p>',
  })
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Resend error:', error.message);
      process.exit(1);
    }
    console.log('✅ Success! Email sent. Check', testEmail);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
