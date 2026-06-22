// reset.js — password reset flow (request email → set new password)
(function(){
  'use strict';

  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const token = params.get('token');

  const steps = {
    request: $('stepRequest'),
    sent:    $('stepSent'),
    reset:   $('stepReset'),
    done:    $('stepDone'),
    invalid: $('stepInvalid')
  };

  function show(name){
    Object.values(steps).forEach(el => el && (el.hidden = true));
    if (steps[name]) steps[name].hidden = false;
  }

  function showBanner(el, msg, type){
    el.textContent = msg;
    el.className = 'auth-banner ' + type;
    el.hidden = false;
  }
  function hideBanner(el){ el.hidden = true; }

  window.resetFlow = () => {
    // Reset the URL so a stale token isn't reused
    if (window.history && history.replaceState) history.replaceState(null, '', '/reset-password');
    show('request');
  };

  // ---------- password visibility toggles ----------
  function bindToggle(btnId, inputId){
    const btn = $(btnId), input = $(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁';
    });
  }
  bindToggle('pwToggle1', 'password');
  bindToggle('pwToggle2', 'confirm');

  // ---------- password strength meter ----------
  function scorePassword(pw){
    let score = 0;
    if (!pw) return 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(score, 4);
  }
  function paintStrength(pw){
    const fill = $('strengthFill'), label = $('strengthLabel');
    const s = scorePassword(pw);
    const cfg = [
      { w: '0%',  c: 'transparent', l: '—' },
      { w: '25%', c: '#ef4444', l: 'Weak' },
      { w: '50%', c: '#f59e0b', l: 'Fair' },
      { w: '75%', c: '#3b82f6', l: 'Good' },
      { w: '100%',c: '#22c55e', l: 'Strong' }
    ][s];
    fill.style.width = cfg.w;
    fill.style.background = cfg.c;
    label.textContent = cfg.l;
    label.style.color = cfg.c === 'transparent' ? 'var(--muted)' : cfg.c;
  }
  const pwInput = $('password');
  if (pwInput) pwInput.addEventListener('input', e => paintStrength(e.target.value));

  // ---------- Step 1: request reset ----------
  const requestForm = $('requestForm');
  if (requestForm){
    requestForm.addEventListener('submit', async e => {
      e.preventDefault();
      hideBanner($('bannerReq'));
      const email = $('email').value.trim();
      if (!email){ showBanner($('bannerReq'), 'Please enter your email.', 'error'); return; }

      const btn = $('reqBtn');
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const res = await fetch('/api/password/request-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
          credentials: 'same-origin'
        });
        const data = await res.json();
        $('sentEmail').textContent = email;
        // Show dev hint if SMTP not configured (response-less but we detect via env flag on client)
        // The server always logs in dev mode; show the hint unconditionally for transparency.
        $('devHint').hidden = false;
        show('sent');
      } catch (err){
        showBanner($('bannerReq'), 'Network error — please try again.', 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Send reset link';
      }
    });
  }

  // ---------- Step 2: reset (if token present) ----------
  async function loadToken(){
    if (!token){ resetFlow(); return; }
    try {
      const res = await fetch('/api/password/verify-token?token=' + encodeURIComponent(token), { credentials: 'same-origin' });
      const data = await res.json();
      if (res.ok && data.ok){
        $('resetEmail').textContent = data.email;
        show('reset');
      } else {
        show('invalid');
      }
    } catch (err){
      show('invalid');
    }
  }

  const resetForm = $('resetForm');
  if (resetForm){
    resetForm.addEventListener('submit', async e => {
      e.preventDefault();
      hideBanner($('bannerReset'));
      const pw = $('password').value;
      const cf = $('confirm').value;
      if (pw.length < 6){ showBanner($('bannerReset'), 'Password must be at least 6 characters.', 'error'); return; }
      if (pw !== cf){ showBanner($('bannerReset'), 'Passwords do not match.', 'error'); return; }

      const btn = $('resetBtn');
      btn.disabled = true; btn.textContent = 'Updating…';
      try {
        const res = await fetch('/api/password/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password: pw }),
          credentials: 'same-origin'
        });
        const data = await res.json();
        if (res.ok && data.ok){
          show('done');
        } else {
          showBanner($('bannerReset'), data.error || 'Reset failed.', 'error');
          btn.disabled = false; btn.textContent = 'Update password';
        }
      } catch (err){
        showBanner($('bannerReset'), 'Network error — please try again.', 'error');
        btn.disabled = false; btn.textContent = 'Update password';
      }
    });
  }

  // ---------- bootstrap ----------
  if (token){
    loadToken();
  } else {
    resetFlow();
  }
})();
