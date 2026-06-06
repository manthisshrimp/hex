const fs = require('fs');

const API_KEY_PATH = process.env.OCTIRON_API_KEY_PATH || '/root/.octiron-api-key';

let cachedKey = null;

function loadApiKey() {
  try {
    if (fs.existsSync(API_KEY_PATH)) {
      cachedKey = fs.readFileSync(API_KEY_PATH, 'utf8').trim();
      console.info(`Octiron API key loaded from ${API_KEY_PATH}`);
    } else {
      console.warn(`Octiron API key not found at ${API_KEY_PATH}. Service endpoints disabled.`);
      cachedKey = null;
    }
  } catch (err) {
    console.error('Failed to load Octiron API key:', err.message);
    cachedKey = null;
  }
}

function apiKeyMiddleware(req, res, next) {
  const provided = req.headers['x-api-key'];
  if (!provided || !cachedKey || provided !== cachedKey) {
    return res.status(403).json({ error: 'Invalid or missing API key' });
  }
  next();
}

function getApiKey() {
  return cachedKey;
}

loadApiKey();

module.exports = { apiKeyMiddleware, loadApiKey, getApiKey };
