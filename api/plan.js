// Vercel serverless function. The key lives in an environment variable, never in the site code.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'GROQ_API_KEY is not set' });

  const { stats, plan, phases } = req.body || {};
  const age = Number(stats && stats.age);
  if (!stats || !Array.isArray(plan) || plan.length > 7 || !(age >= 13 && age <= 18)) {
    return res.status(400).json({ error: 'Bad request' });
  }

  const system = [
    'You write a short, friendly coach note (max 120 words) for a teenager about a training plan that was already made.',
    'Explain why the week is structured this way and what to focus on in the first phase.',
    'Do NOT change the plan. Do NOT mention calories, dieting, fasting, supplements, weight loss, body weight numbers, or extra exercise.',
    'Do NOT give medical advice. If something hurts, tell them to stop and talk to a parent or doctor.',
    'Use plain text, no lists, no em dashes.'
  ].join(' ');

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: 0.4,
        max_tokens: 300,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify({ stats, plan, phases }).slice(0, 3000) }
        ]
      })
    });
    if (!r.ok) return res.status(502).json({ error: 'Upstream error' });
    const d = await r.json();
    let text = (d.choices && d.choices[0] && d.choices[0].message.content) || '';
    if (/calori|fasting|\bdiet|starv|pounds|\blbs\b|supplement|\bpill/i.test(text)) text = '';
    return res.status(200).json({ explanation: text.trim() });
  } catch (e) {
    return res.status(502).json({ error: 'Request failed' });
  }
};
