import { kv } from '@vercel/kv';
export default async function handler(req, res){
  try{
    if(!process.env.KV_REST_API_URL){ return res.status(503).json({error:'no-db'}); }
    let body = req.body; if(typeof body === 'string'){ try{ body = JSON.parse(body); }catch(e){ body = {}; } } body = body || {};
    const cfg = await kv.get('config');
    if(req.method === 'POST' && body.setup){
      if(cfg) return res.status(403).json({error:'already-setup'});
      await kv.set('config', { owner: String(body.setup.owner||''), viewer: String(body.setup.viewer||'') });
      return res.status(200).json({ok:true});
    }
    if(!cfg) return res.status(409).json({error:'not-setup'});
    const pass = String(req.headers['x-pass'] || '');
    const role = pass && pass === cfg.owner ? 'Propriétaire' : (pass && pass === cfg.viewer ? 'Entrepreneur' : null);
    if(!role) return res.status(401).json({error:'bad-pass'});
    if(req.method === 'GET'){
      const state = await kv.get('state'); const log = (await kv.get('log')) || []; const meta = (await kv.get('meta')) || {updatedAt:0};
      return res.status(200).json({ role, state: state || null, log, updatedAt: meta.updatedAt || 0 });
    }
    if(req.method === 'POST'){
      if(body.state !== undefined){ await kv.set('state', body.state); await kv.set('meta', {updatedAt: Date.now()}); }
      if(body.action){ let log = (await kv.get('log')) || []; log.push({ t: Date.now(), who: role, msg: String(body.action).slice(0,300) }); if(log.length>3000) log = log.slice(-3000); await kv.set('log', log); }
      return res.status(200).json({ok:true});
    }
    return res.status(405).end();
  }catch(e){ return res.status(500).json({error: String((e&&e.message)||e)}); }
}
