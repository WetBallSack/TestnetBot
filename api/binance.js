const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { mode, path: apiPath, ...rest } = req.query;

  if (!apiPath) {
    return res.status(400).json({ error: 'path parameter required' });
  }

  const isLive = mode === 'live';
  const apiKey = isLive
    ? process.env.BINANCE_API_KEY
    : process.env.BINANCE_TESTNET_API_KEY;
  const secret = isLive
    ? process.env.BINANCE_SECRET
    : process.env.BINANCE_TESTNET_SECRET;

  if (!apiKey || !secret) {
    return res.status(500).json({
      error: `${mode?.toUpperCase() ?? 'TESTNET'} keys not configured in Vercel environment variables`
    });
  }

  const baseUrl = isLive
    ? 'https://fapi.binance.com'
    : 'https://demo-fapi.binance.com';

  // Build signed query — append timestamp + recvWindow, then sign
  const params = {
    ...rest,
    timestamp:  Date.now().toString(),
    recvWindow: '6000',
  };

  const queryString = new URLSearchParams(params).toString();

  const signature = crypto
    .createHmac('sha256', secret)
    .update(queryString)
    .digest('hex');

  const url = `${baseUrl}${apiPath}?${queryString}&signature=${signature}`;

  try {
    const upstream = await fetch(url, {
      headers: { 'X-MBX-APIKEY': apiKey },
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
