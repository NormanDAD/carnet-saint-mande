module.exports = async (req, res) => {
  try {
    const base = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!base || !token) { res.status(503).json({ error: 'no-db' }); return; }
    const H = { Authorization: 'Bearer ' + token };
    const kvGet = async (key) => {
      const r = await fetch(base + '/get/' + encodeURIComponent(key), { headers: H });
      const j = await r.json();
      return j && j.result != null ? JSON.parse(j.result) : null;
    };
    const kvSet = async (key, val) => {
      await fetch(base + '/set/' + encodeURIComponent(key), {
        method: 'POST', headers: H, body: JSON.stringify(val)
      });
    };
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    const cfg = await kvGet('config');
    if (req.method === 'POST' && body.setup) {
      if (cfg) { res.status(403).json({ error: 'already-setup' }); return; }
      await kvSet('config', { owner: String(body.setup.owner || ''), viewer: String(body.setup.viewer || '') });
      res.status(200).json({ ok: true }); return;
    }
    if (!cfg) { res.status(409).json({ error: 'not-setup' }); return; }
    const pass = String(req.headers['x-pass'] || '');
    const role = pass && pass === cfg.owner ? 'Propriétaire' : (pass && pass === cfg.viewer ? 'Entrepreneur' : null);
    if (!role) { res.status(401).json({ error: 'bad-pass' }); return; }
    if (req.method === 'GET') {
      const state = await kvGet('state');
      const log = (await kvGet('log')) || [];
      const meta = (await kvGet('meta')) || { updatedAt: 0 };
      res.status(200).json({ role, state: state || null, log, updatedAt: meta.updatedAt || 0 }); return;
    }
    if (req.method === 'POST') {
      if (body.state !== undefined) { await kvSet('state', body.state); await kvSet('meta', { updatedAt: Date.now() }); }
      if (body.action) {
        let log = (await kvGet('log')) || [];
        log.push({ t: Date.now(), who: role, msg: String(body.action).slice(0, 300) });
        if (log.length > 3000) log = log.slice(-3000);
        await kvSet('log', log);
      }
      res.status(200).json({ ok: true }); return;
    }
    res.status(405).end();
  } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
};
