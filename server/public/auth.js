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
  fetch('/api/me', { credentials: 'same-origin' }).then(r => r.json()).then(d => {
    // If Google isn't configured server-side, gracefully hide the button + divider
    if (!d.googleEnabled) {
      if (googleBtn) googleBtn.style.display = 'none';
      const divider = document.querySelector('.divider');
      if (divider) divider.style.display = 'none';
    }
  }).catch(() => {});

  setMode('login');
})();
