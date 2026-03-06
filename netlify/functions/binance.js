const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  const qs   = event.queryStringParameters || {};
  const mode = qs.mode === 'live' ? 'live' : 'testnet';
  const path = qs.path;

  if (!path) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'path parameter required' }) };
  }

  const apiKey = mode === 'live'
    ? process.env.BINANCE_API_KEY
    : process.env.BINANCE_TESTNET_API_KEY;
  const secret = mode === 'live'
    ? process.env.BINANCE_SECRET
    : process.env.BINANCE_TESTNET_SECRET;

  if (!apiKey || !secret) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `${mode.toUpperCase()} keys not configured — add BINANCE_${mode === 'live' ? '' : 'TESTNET_'}API_KEY and BINANCE_${mode === 'live' ? '' : 'TESTNET_'}SECRET in Netlify environment variables` }),
    };
  }

  const baseUrl = mode === 'testnet'
    ? 'https://demo-fapi.binance.com'
    : 'https://fapi.binance.com';

  // Forward all params except our internal ones
  const binanceParams = {};
  for (const [k, v] of Object.entries(qs)) {
    if (k !== 'mode' && k !== 'path') binanceParams[k] = v;
  }
  binanceParams.timestamp  = Date.now().toString();
  binanceParams.recvWindow = '6000';

  const queryString = new URLSearchParams(binanceParams).toString();
  const signature   = crypto.createHmac('sha256', secret).update(queryString).digest('hex');
  const url         = `${baseUrl}${path}?${queryString}&signature=${signature}`;

  try {
    const res  = await fetch(url, { headers: { 'X-MBX-APIKEY': apiKey } });
    const data = await res.json();
    return { statusCode: res.status, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(err) }) };
  }
};
