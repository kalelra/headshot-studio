const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const key = env.REPLICATE_API_KEY;

  if (!key) {
    return new Response(JSON.stringify({ error: 'REPLICATE_API_KEY not configured in CF environment.' }), { status: 500, headers: CORS });
  }

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: CORS });
  }

  const { model, input } = body;
  if (!model || !input) {
    return new Response(JSON.stringify({ error: 'Missing model or input' }), { status: 400, headers: CORS });
  }

  try {
    const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: res.status, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
}
