// W Forex · Auth page logic (login + signup)
(function(){
  'use strict';

  let mode = 'login'; // or 'signup'
  const form     = document.getElementById('authForm');
  const formTitle = document.getElementById('formTitle');
  const formSub  = document.getElementById('formSub');
  const nameField = document.getElementById('nameField');
  const submitBtn = document.getElementById('submitBtn');
  const switchBtn = document.getElementById('switchBtn');
  const switchText = document.getElementById('switchText');
  const banner   = document.getElementById('banner');
  const pwToggle = document.getElementById('pwToggle');
  const googleBtn = document.getElementById('googleBtn');
  const emailEl  = document.getElementById('email');
  const pwEl     = document.getElementById('password');
  const nameEl   = document.getElementById('name');

  // ---------- mode switch ----------
  function setMode(m){
    mode = m;
    if (m === 'signup'){
      formTitle.textContent = 'Create your account';
      formSub.textContent = 'Start monitoring your trading bot in seconds.';
      nameField.hidden = false;
      submitBtn.textContent = 'Create account';
      switchText.textContent = 'Already have an account?';
      switchBtn.textContent = 'Sign in';
      nameEl.setAttribute('autocomplete', 'name');
      pwEl.setAttribute('autocomplete', 'new-password');
    } else {
      formTitle.textContent = 'Welcome back';
      formSub.textContent = 'Sign in to access your live trading dashboard.';
      nameField.hidden = true;
      submitBtn.textContent = 'Sign in';
      switchText.textContent = "Don't have an account?";
      switchBtn.textContent = 'Create one';
      pwEl.setAttribute('autocomplete', 'current-password');
    }
    hideBanner();
  }

  switchBtn.addEventListener('click', e => { e.preventDefault(); setMode(mode === 'login' ? 'signup' : 'login'); });

  // ---------- banner ----------
  function showBanner(msg, type){
    banner.textContent = msg;
    banner.className = 'auth-banner ' + type;
    banner.hidden = false;
  }
  function hideBanner(){ banner.hidden = true; }

  // ---------- password toggle ----------
  pwToggle.addEventListener('click', () => {
    const show = pwEl.type === 'password';
    pwEl.type = show ? 'text' : 'password';
    pwToggle.textContent = show ? '🙈' : '👁';
  });

  // ---------- error from URL (OAuth redirects) ----------
  const params = new URLSearchParams(location.search);
  const err = params.get('error');
  if (err){
    const msgs = {
      google_cancelled: 'Google sign-in was cancelled.',
      state_mismatch: 'Security check failed — please try again.',
      oauth_failed: 'Google authentication failed. Please try again.',
      signup_failed: 'Could not complete sign-up. Please try again.'
    };
    showBanner(msgs[err] || 'Something went wrong.', 'error');
  }

  // ---------- submit ----------
  form.addEventListener('submit', async e => {
    e.preventDefault();
    hideBanner();
    const email = emailEl.value.trim();
    const password = pwEl.value;
    console.log('[auth] submit', { mode, email });
    if (!email || !password){ showBanner('Please enter your email and password.', 'error'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait…';

    try {
      const endpoint = mode === 'signup' ? '/api/signup' : '/api/login';
      const body = { email, password };
      if (mode === 'signup' && nameEl.value.trim()) body.name = nameEl.value.trim();

      console.log('[auth] POST', endpoint);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin'
      });
      console.log('[auth] response', res.status);
      const data = await res.json();
      console.log('[auth] data', data);

      if (!res.ok){
        showBanner(data.error || 'Request failed.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
        return;
      }
      // success — redirect to dashboard
      console.log('[auth] success, redirecting to /');
      window.location.href = '/';
    } catch (err){
      showBanner('Network error — please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
    }
  });

  // ---------- Google availability ----------
  fetch('/api/google-config', { credentials: 'same-origin' }).then(r => r.json()).then(cfg => {
    if (cfg.enabled && cfg.googleClientId && window.google) {
      // Native GIS button available — render it into our button
      window.google.accounts.id.initialize({
        client_id: cfg.googleClientId,
        callback: handleGoogleCredential
      });
      window.google.accounts.id.renderButton(googleBtn, { type: 'standard', size: 'large', text: 'signup_with' });
    } else if (cfg.enabled && cfg.googleClientId) {
      // GIS script not loaded yet — load it, then render
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = () => {
        window.google.accounts.id.initialize({
          client_id: cfg.googleClientId,
          callback: handleGoogleCredential
        });
        window.google.accounts.id.renderButton(googleBtn, { type: 'standard', size: 'large', text: 'signup_with' });
      };
      document.head.appendChild(s);
    } else {
      // No Client ID configured — keep the styled fallback button that redirects to OAuth
      googleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/auth/google';
      });
    }
  }).catch(() => {
    // Network error — still allow the redirect fallback
    if (googleBtn) googleBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.href = '/auth/google'; });
  });

  // Handle Google ID credential (JWT) from GIS
  function handleGoogleCredential(response) {
    const banner = document.getElementById('banner');
    googleBtn && googleBtn.classList.add('loading');
    fetch('/api/auth/google/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ credential: response.credential })
    }).then(r => r.json()).then(d => {
      if (d.ok) {
        if (banner) { banner.hidden = false; banner.className = 'auth-banner success'; banner.textContent = '✓ Welcome, ' + (d.user && d.user.name || '') + '! Redirecting…'; }
        setTimeout(() => window.location.href = '/', 700);
      } else {
        if (banner) { banner.hidden = false; banner.className = 'auth-banner error'; banner.textContent = '✗ ' + (d.error || 'Google sign-in failed'); }
        googleBtn && googleBtn.classList.remove('loading');
      }
    }).catch(() => {
      if (banner) { banner.hidden = false; banner.className = 'auth-banner error'; banner.textContent = '✗ Network error'; }
      googleBtn && googleBtn.classList.remove('loading');
    });
  }

  setMode('login');
})();
