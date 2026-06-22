// google.js — minimal Google OAuth 2.0 flow (no external deps)
// Uses Google's authorization code exchange endpoints directly.

const crypto = require('crypto');

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
const SCOPE         = 'openid email profile';

function isConfigured(){
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

// PKCE + auth URL
function buildAuthUrl(state){
  const auth = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'online',
    include_granted_scopes: 'true',
    state
  }).toString();
  return auth;
}

// Exchange authorization code for tokens, then fetch userinfo
async function exchangeCode(code){
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });
  if (!tokenRes.ok){
    const t = await tokenRes.text();
    throw new Error('token exchange failed: ' + t);
  }
  const tokens = await tokenRes.json();
  const access = tokens.access_token;

  // userinfo
  const uiRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: 'Bearer ' + access }
  });
  if (!uiRes.ok) throw new Error('userinfo fetch failed');
  const ui = await uiRes.json();
  return {
    sub: ui.sub,
    email: ui.email,
    name: ui.name,
    avatar: ui.picture
  };
}

// Generate an unguessable state token for CSRF protection
function newState(){
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  isConfigured, buildAuthUrl, exchangeCode, newState,
  CLIENT_ID, REDIRECT_URI
};
