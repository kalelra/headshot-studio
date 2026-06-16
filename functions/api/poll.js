const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const key = env.REPLICATE_API_KEY;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) return new Response(JSON.stringify({ error: 'Missing ?id' }), { status: 400, headers: CORS });

  try {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
}
