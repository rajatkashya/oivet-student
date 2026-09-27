const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
});

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function unb64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}
async function makeSession(secret) {
  const payload = JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 });
  const p = b64url(new TextEncoder().encode(payload));
  return p + '.' + await sign(p, secret);
}
async function validSession(request, secret) {
  const m = request.headers.get('Cookie')?.match(/(?:^|; )admin_session=([^;]+)/);
  if (!m) return false;
  const [p, sig] = m[1].split('.');
  if (!p || !sig) return false;
  if (sig !== await sign(p, secret)) return false;
  try { return JSON.parse(new TextDecoder().decode(unb64url(p))).exp > Date.now(); } catch { return false; }
}
function requireDB(env) {
  if (!env.DB) throw new Error('D1 binding DB is not configured.');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await api(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (e) {
      console.error(e);
      if (url.pathname.startsWith('/api/')) return json({ error: e.message || 'Server error' }, 500);
      return new Response('Server error', { status: 500 });
    }
  }
};

async function api(request, env, url) {
  const method = request.method;
  if (url.pathname === '/api/verify' && method === 'GET') {
    requireDB(env);
    const regno = (url.searchParams.get('regno') || '').trim().toUpperCase();
    const dob = (url.searchParams.get('dob') || '').trim();
    if (!regno || !dob) return json({ verified:false });
    const row = await env.DB.prepare('SELECT regno,dob,name,father,mother,course,courseCode,period,duration,marks,grade,center,photo FROM students WHERE regno=?1 AND dob=?2').bind(regno,dob).first();
    if (!row) return json({ verified:false });
    return json({ verified:true, student:row, verificationImage:row.photo || '' });
  }

  if (url.pathname === '/api/admin/login' && method === 'POST') {
    if (!env.ADMIN_PASSWORD) return json({ error:'ADMIN_PASSWORD secret is not configured.' }, 500);
    const body = await request.json().catch(() => ({}));
    if (typeof body.password !== 'string' || body.password !== env.ADMIN_PASSWORD) return json({ error:'Wrong password.' }, 401);
    const token = await makeSession(env.ADMIN_PASSWORD);
    return json({ ok:true }, 200, { 'Set-Cookie': `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800` });
  }
  if (url.pathname === '/api/admin/logout' && method === 'POST') {
    return json({ ok:true }, 200, { 'Set-Cookie':'admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
  }
  if (url.pathname === '/api/admin/me' && method === 'GET') {
    return json({ authenticated: !!env.ADMIN_PASSWORD && await validSession(request, env.ADMIN_PASSWORD) });
  }

  // Public website settings are needed by the public page. Editing them remains protected below.
  if (url.pathname === '/api/settings' && method === 'GET') {
    requireDB(env);
    const row = await env.DB.prepare('SELECT title,images_json,social_json FROM settings WHERE id=1').first();
    return json({ settings: row || { title:'', images_json:'{}', social_json:'{}' } });
  }

  if (!env.ADMIN_PASSWORD || !(await validSession(request, env.ADMIN_PASSWORD))) return json({ error:'Unauthorized' }, 401);
  requireDB(env);

  if (url.pathname === '/api/students' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT regno,dob,name,father,mother,course,courseCode,period,duration,marks,grade,center,photo FROM students ORDER BY regno').all();
    return json({ students: results });
  }
  if (url.pathname === '/api/students' && method === 'POST') {
    const s = await request.json();
    const required = ['regno','dob'];
    if (required.some(k => !String(s[k] ?? '').trim())) return json({ error:'Registration number and DOB are required.' }, 400);
    const regno = String(s.regno).trim().toUpperCase();
    const photo = String(s.photo || '');
    if (photo.length > 500000) return json({ error:'Photo is too large. Please use a smaller image.' }, 400);
    await env.DB.prepare(`INSERT INTO students(regno,dob,name,father,mother,course,courseCode,period,duration,marks,grade,center,photo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(regno,String(s.dob),String(s.name||''),String(s.father||''),String(s.mother||''),String(s.course||''),String(s.courseCode||''),String(s.period||''),String(s.duration||''),String(s.marks||''),String(s.grade||''),String(s.center||''),photo).run();
    return json({ ok:true, regno });
  }
  const sm = url.pathname.match(/^\/api\/students\/([^/]+)$/);
  if (sm && (method === 'PUT' || method === 'DELETE')) {
    const regno = decodeURIComponent(sm[1]).trim().toUpperCase();
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM students WHERE regno=?').bind(regno).run();
      return json({ ok:true });
    }
    const s = await request.json();
    const photo = String(s.photo || '');
    if (photo.length > 500000) return json({ error:'Photo is too large.' }, 400);
    await env.DB.prepare(`UPDATE students SET dob=?,name=?,father=?,mother=?,course=?,courseCode=?,period=?,duration=?,marks=?,grade=?,center=?,photo=? WHERE regno=?`)
      .bind(String(s.dob||''),String(s.name||''),String(s.father||''),String(s.mother||''),String(s.course||''),String(s.courseCode||''),String(s.period||''),String(s.duration||''),String(s.marks||''),String(s.grade||''),String(s.center||''),photo,regno).run();
    return json({ ok:true });
  }
  if (url.pathname === '/api/settings' && method === 'PUT') {
    const s = await request.json();
    await env.DB.prepare('INSERT INTO settings(id,title,images_json,social_json) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,images_json=excluded.images_json,social_json=excluded.social_json')
      .bind(String(s.title||''),String(s.images_json||'{}'),String(s.social_json||'{}')).run();
    return json({ ok:true });
  }
  return json({ error:'Not found' }, 404);
}
