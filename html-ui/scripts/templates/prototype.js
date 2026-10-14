/* Local navigation and lightweight design-preview interactions. No API calls. */
(() => {
  const screen = document.body.dataset.screen;
  document.addEventListener('keydown', (event) => {
    if (event.altKey && event.key.toLowerCase() === 's') go('screens.html');
  });
  if (new URLSearchParams(location.search).has('figma')) document.documentElement.classList.add('figma-export');
  try {
    if (localStorage.getItem('kainara-html-theme') === 'dark')
      document.documentElement.classList.replace('light', 'dark');
  } catch {}
  const go = (file) => {
    location.href = file;
  };
  const toast = (text) => {
    document.querySelector('.prototype-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'prototype-toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.append(el);
    setTimeout(() => el.remove(), 3500);
  };
  const tabRoutes = {
    meals: { Plan: 'meals.html', History: 'meals-history.html', Library: 'meals-library.html' },
    profile: {
      Overview: 'profile.html',
      Personal: 'profile-personal.html',
      'Health & goals': 'profile-health.html',
      'Food & planning': 'profile-planning.html',
      Security: 'profile-security.html',
      Reports: 'nutrition-report.html',
    },
  };
  const onboarding = [
    'onboarding',
    'onboarding-preferences',
    'onboarding-conditions',
    'onboarding-allergies',
    'onboarding-shopping',
    'onboarding-terms',
  ];
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button,[role="tab"],[role="checkbox"]');
    if (!button || button.disabled) return;
    const text = button.textContent.trim().replace(/\s+/g, ' ');
    const label = button.getAttribute('aria-label') || '';
    if (/theme|dark mode|light mode/i.test(label) || /^(Light|Dark|System)$/.test(text)) {
      const dark = document.documentElement.classList.toggle('dark');
      document.documentElement.classList.toggle('light', !dark);
      try {
        localStorage.setItem('kainara-html-theme', dark ? 'dark' : 'light');
      } catch {}
      return;
    }
    if (
      button.getAttribute('role') === 'tab' ||
      (screen?.startsWith('meals') && /^(Plan|History|Library)\s*\d*$/.test(text))
    ) {
      const routes = screen?.startsWith('meals')
        ? tabRoutes.meals
        : screen?.startsWith('profile')
          ? tabRoutes.profile
          : null;
      const key = text.replace(/\d+$/, '').trim();
      if (routes?.[key]) return go(routes[key]);
    }
    if (/All tools/.test(text)) return go('screens.html');
    if (/Jamie Cruz|Alex Santos|Sofia Reyes/.test(text) && button.closest('aside')) return go('profile.html');
    if (/Log food or snack|Log an outside meal/.test(text)) return go('log-food.html');
    if (/^Open .* details$/.test(label)) return go('meal-details.html');
    if (/Log today.*weight|Log weight/.test(text) && screen !== 'log-weight') return go('log-weight.html');
    if (/^View (weekly )?plan$|Open weekly plan|^Weekly plan$/.test(text)) return go('meals.html');
    if (/^Close$/.test(label) || /^Cancel$/.test(text)) {
      if (screen === 'meal-details' || screen === 'log-food') return go('dashboard.html');
      if (screen === 'log-weight') return go('progress.html');
      button.closest('[role="dialog"]')?.remove();
      return;
    }
    if (/water/i.test(label)) {
      const change = /remove|subtract|decrease/i.test(label) ? -250 : 250;
      const section = button.closest('section');
      const value = [...(section?.querySelectorAll('span,p,strong') || [])].find(
        (e) => /^\d[\d,]*$/.test(e.textContent.trim()) && e.children.length === 0
      );
      if (value)
        value.textContent = Math.max(0, Number(value.textContent.replaceAll(',', '')) + change).toLocaleString();
      toast(`${change > 0 ? 'Added' : 'Removed'} 250 mL in this local preview.`);
      return;
    }
    if (/^Mark .* as eaten$/.test(label)) {
      button.textContent = 'Eaten';
      button.setAttribute('aria-label', 'Undo eaten status');
      toast('Meal marked as eaten in this local preview.');
      return;
    }
    if (button.getAttribute('role') === 'checkbox') {
      const checked = button.getAttribute('aria-checked') === 'true';
      button.setAttribute('aria-checked', String(!checked));
      button.dataset.state = checked ? 'unchecked' : 'checked';
      return;
    }
    if (/^Continue|^Save and continue|^Complete Onboarding/.test(text) && screen?.startsWith('onboarding')) {
      const index = onboarding.indexOf(screen);
      return go(index < onboarding.length - 1 ? onboarding[index + 1] + '.html' : 'dashboard.html');
    }
    if (/^Back$|^Previous/.test(text) && screen?.startsWith('onboarding'))
      return go(onboarding[Math.max(0, onboarding.indexOf(screen) - 1)] + '.html');
    if (/Sign out|Log out/i.test(text)) return go('auth.html');
    if (/Scrambled egg and rice plate/.test(text) && screen === 'nutritionist')
      return go('nutritionist-review-detail.html');
    if (/Download|Export PDF/i.test(text)) {
      toast('Use your browser’s Print → Save as PDF for this static design preview.');
      return;
    }
    if (/^Save|^Update|^Approve|^Reject|^Generate|^Confirm|^Submit|^Send|^Regenerate|^Claim/.test(text)) {
      toast('Local design preview — no account or clinical data is changed.');
      return;
    }
    // Match single-choice option button groups without depending on React.
    if (screen?.startsWith('onboarding') && button.getAttribute('aria-pressed') !== null) {
      button.setAttribute('aria-pressed', button.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      button.classList.toggle('ring-2');
    }
  });
  document.addEventListener('submit', (event) => {
    event.preventDefault();
    if (screen === 'auth') return go('dashboard.html');
    if (screen === 'register') return go('verify-email.html');
    if (screen?.startsWith('onboarding')) {
      const i = onboarding.indexOf(screen);
      return go(i < onboarding.length - 1 ? onboarding[i + 1] + '.html' : 'dashboard.html');
    }
    toast('Saved in the local design preview.');
  });
  document.querySelectorAll('button[aria-label="Show password"],button[aria-label="Hide password"]').forEach((button) =>
    button.addEventListener('click', () => {
      const input = button.parentElement.querySelector('input');
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
        button.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
      }
    })
  );
})();
