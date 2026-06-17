const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const RES = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: CORS });

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const key = env.REPLICATE_API_KEY;
  if (!key) return RES({ error: 'REPLICATE_API_KEY not configured in CF environment.' }, 500);

  let body;
  try { body = await request.json(); } catch { return RES({ error: 'Invalid JSON body' }, 400); }

  const { model, version, input, schema } = body;
  const auth = { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };

  // Introspection: POST {model, schema:true} -> resolved latest version + input field schema.
  if (schema) {
    if (!model) return RES({ error: 'Missing model' }, 400);
    try {
      const m = await fetch(`https://api.replicate.com/v1/models/${model}`, { headers: auth });
      const md = await m.json();
      if (!m.ok) return RES(md, m.status);
      const inputSchema = md.latest_version?.openapi_schema?.components?.schemas?.Input || {};
      return RES({
        model,
        latest_version: md.latest_version?.id || null,
        required: inputSchema.required || null,
        properties: inputSchema.properties || null,
      });
    } catch (e) { return RES({ error: e.message }, 500); }
  }

  if (!input) return RES({ error: 'Missing input' }, 400);

  try {
    let res;
    if (version) {
      // Explicit version-pinned run (community models like PuLID).
      res = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST', headers: auth, body: JSON.stringify({ version, input }),
      });
    } else {
      if (!model) return RES({ error: 'Missing model or version' }, 400);
      // Try the official/universal endpoint first.
      res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
        method: 'POST', headers: auth, body: JSON.stringify({ input }),
      });
      // Community model not runnable that way -> resolve its latest version and run version-pinned.
      if (res.status === 404) {
        const m = await fetch(`https://api.replicate.com/v1/models/${model}`, { headers: auth });
        const md = await m.json();
        const vid = md.latest_version?.id;
        if (!vid) return RES({ error: `Could not resolve a version for model "${model}".` }, 502);
        res = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'POST', headers: auth, body: JSON.stringify({ version: vid, input }),
        });
      }
    }
    const data = await res.json();
    return RES(data, res.status);
  } catch (e) {
    return RES({ error: e.message }, 500);
  }
}
