export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const AUDIENCE_ID = 'e0baa68f-f679-42b7-93c0-9fd89dcbc98a';

  try {
    // Add contact to Resend audience
    await fetch(`https://api.resend.com/audiences/${AUDIENCE_ID}/contacts`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, unsubscribed: false })
    });

    // Send welcome email
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Terroir HUB WHISKY <noreply@fomus.jp>',
        to: [email],
        subject: 'Welcome to Terroir HUB WHISKY',
        html: `
<div style="max-width:560px;margin:0 auto;font-family:'Georgia',serif;color:#1A1510;padding:40px 24px;">
  <h1 style="font-size:28px;font-weight:400;color:#6B4423;margin:0 0 16px;letter-spacing:-0.01em;">Terroir HUB WHISKY</h1>
  <p style="font-size:15px;line-height:1.8;margin:0 0 20px;">Thank you for joining. You'll be the first to know when we add new distillery profiles, English guide articles, and exclusive whisky content.</p>
  <p style="font-size:15px;line-height:1.8;margin:0 0 28px;">In the meantime, explore all 67 Japanese whisky distilleries — from Yamazaki (est. 1923) to craft pioneers like Chichibu and Akkeshi.</p>
  <a href="https://whisky.terroirhub.com/whisky/guide/en/" style="display:inline-block;background:#6B4423;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:14px;font-family:sans-serif;font-weight:600;letter-spacing:0.04em;">Explore the Whisky Guide →</a>
  <p style="font-size:12px;color:#999;margin-top:36px;font-family:sans-serif;">Terroir HUB WHISKY &mdash; FOMUS LLC, Japan<br>You can unsubscribe at any time.</p>
</div>`
      })
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ error: 'Failed to subscribe' });
  }
}
