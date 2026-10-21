// Organisation-specific settings. Fill these in for your own team.
const ORG_CONFIG = {
  // Link shown under any DSE item that needs attention. Leave empty to hide it.
  ergonomicsGuideUrl:  '',
  ergonomicsGuideName: 'Desk ergonomics guide',
};

// ── Appearance (Match my Mac / Light / Dark) ───────────────────────
function applyTheme(choice) {
  if (choice === 'light' || choice === 'dark') document.documentElement.dataset.theme = choice;
  else delete document.documentElement.dataset.theme;
}
chrome.storage.sync.get({ appearance: 'auto' }).then(d => applyTheme(d.appearance));

const REMINDERS = {
  stand: {
    name:          'Stand & stretch',
    activeName:    'Standing (8m)',
    moveName:      'Move! (2m)',
    readyName:     'Cycle done',
    doneLabel:     "I'm up",
    activeLabel:   'Skip to move',
    moveLabel:     'Sitting back down',
    readyLabel:    'Sitting back down',
    defaultInterval: 20,
    intervals:     [20, 30, 45, 60],
    intervalLabels:['20m','30m','45m','1h'],
    source:        "Cornell 20-8-2 rule · British Journal of Sports Medicine",
    waitTip:       'Sit 20, stand 8, move 2.',
    activeTip:     'Stand for 8 minutes.',
    moveTip:       'Walk, stretch or move around for 2 minutes.',
    readyTip:      '20-8-2 cycle complete. Sit back down.',
    iconClass:     'stand',
  },
  eyes: {
    name:          'Eye rest',
    activeName:    'Resting eyes…',
    readyName:     'Eye rest',
    doneLabel:     'Looking away',
    activeLabel:   'Looking back',
    readyLabel:    'Looking back',
    defaultInterval: 20,
    intervals:     [20, 30, 45, 60],
    intervalLabels:['20m','30m','45m','1h'],
    source:        'American Optometric Association 20-20-20 rule',
    waitTip:       'Look 20 feet away for 20 seconds.',
    activeTip:     'Look 20 feet away — click when done.',
    readyTip:      'Done — eyes rested.',
    iconClass:     'eyes',
  },
  posture: {
    name:          'Posture check',
    activeName:    'Posture check',
    readyName:     'Posture check',
    doneLabel:     'Checked',
    activeLabel:   null,
    readyLabel:    null,
    defaultInterval: 90,
    intervals:     [45, 60, 90, 120],
    intervalLabels:['45m','1h','90m','2h'],
    source:        'HSE display screen equipment guidance',
    waitTip:       'Sit back, shoulders relaxed, feet flat on the floor.',
    activeTip:     'Sit back, shoulders relaxed, feet flat on the floor.',
    readyTip:      'Posture checked.',
    iconClass:     'posture',
  },
  break: {
    name:          'Screen break',
    activeName:    'On a break…',
    readyName:     'Screen break',
    doneLabel:     'Stepping away',
    activeLabel:   'Back at desk',
    readyLabel:    'Back at desk',
    defaultInterval: 60,
    intervals:     [45, 60, 90, 120],
    intervalLabels:['45m','1h','90m','2h'],
    source:        'HSE DSE Regulations: 5–10 mins every hour',
    waitTip:       'Step away from your screen for at least 5 minutes.',
    activeTip:     'Stay away from your screen — minimum is 5 minutes.',
    readyTip:      'Minimum reached. Come back whenever you\'re ready.',
    iconClass:     'break',
  },
};

const DSE_QUESTIONS = [
  { q:"Is your monitor at roughly eye level, about an arm's length away?",    opts:["Yes, comfortable","Roughly, could be better","No, needs adjusting"],    scores:[2,1,0] },
  { q:"Are your wrists straight and relaxed when typing?",                    opts:["Yes, wrists are flat","Sometimes","No, wrists bend upward"],            scores:[2,1,0] },
  { q:"Are your feet flat on the floor or on a footrest?",                    opts:["Yes","I use a footrest","No, feet dangle"],                            scores:[2,2,0] },
  { q:"Does your chair support the curve of your lower back?",                opts:["Yes, good lumbar support","Partially","No support at all"],             scores:[2,1,0] },
  { q:"Can you see your screen clearly without squinting or leaning in?",     opts:["Yes, clearly","Occasionally squint","Often struggle"],                  scores:[2,1,0] },
  { q:"Is there glare or reflections on your screen?",                        opts:["No glare","Occasional glare","Regular problem"],                       scores:[2,1,0] },
  { q:"Is your keyboard at a comfortable height without raising your shoulders?", opts:["Yes, comfortable","Shoulders rise slightly","Shoulders are raised"], scores:[2,1,0] },
  { q:"Do you take regular short breaks away from your screen?",              opts:["Yes, regularly","Sometimes","Rarely or never"],                        scores:[2,1,0] },
  { q:"Is the lighting in your workspace comfortable?",                       opts:["Yes, comfortable","Could be better","Too bright or too dark"],          scores:[2,1,0] },
  { q:"Do you experience discomfort in your neck, shoulders, wrists or back?",opts:["No discomfort","Occasionally","Regularly"],                            scores:[2,1,0] },
];
const DSE_LABELS = ["Monitor position","Wrist posture","Foot support","Chair support","Screen clarity","Screen glare","Keyboard height","Screen breaks","Lighting","Discomfort"];

// ── Helpers ────────────────────────────────────────────────────────
function fmt(ms, allowSeconds = false) {
  if (allowSeconds) {
    const secs = Math.ceil(ms / 1000);
    if (secs <= 0) return 'Now';
    if (secs < 60) return `${secs}s`;
  }
  const m = Math.ceil(ms / 60000);
  if (m <= 0) return 'Now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r > 0 ? `${h}h ${r}m` : `${h}h`;
}

function fmtMins(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), r = mins % 60;
  return r > 0 ? `${h}h ${r}m` : `${h}h`;
}

// ── Onboarding (first run only) ──────────────────────────────────────
const ONBOARDING_REMINDERS = [
  { key: 'stand',   label: 'Stand & stretch', desc: 'Every 20 minutes, stand for 8, move for 2.' },
  { key: 'eyes',    label: 'Eye rest',        desc: 'Look away from the screen every 20 minutes.' },
  { key: 'posture', label: 'Posture check',   desc: 'A reminder to sit back and relax your shoulders.' },
  { key: 'break',   label: 'Screen break',    desc: 'Step away from your screen every hour.' },
  { key: 'water',   label: 'Hydration',       desc: 'Tracks water intake against your working hours.' },
  { key: 'mood',    label: 'Mood check-in',   desc: 'A private daily check-in. Saved on this Mac only.', defaultOn: false },
];

function renderOnboardingList() {
  const list = document.getElementById('ob-reminder-list');
  list.innerHTML = ONBOARDING_REMINDERS.map(i => `
    <label style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer;">
      <input type="checkbox" class="ob-check" data-key="${i.key}" ${i.defaultOn === false ? '' : 'checked'} style="margin-top:3px;">
      <span>
        <div style="font-size:13px;font-weight:700;color:var(--text);">${i.label}</div>
        <div style="font-size:11px;color:var(--text3);">${i.desc}</div>
      </span>
    </label>`
  ).join('');
}

async function checkOnboarding() {
  const { onboardingComplete } = await chrome.storage.local.get({ onboardingComplete: false });
  if (onboardingComplete) return;
  document.getElementById('app-main').style.display = 'none';
  document.getElementById('view-onboarding').style.display = 'block';
  renderOnboardingList();
}

document.getElementById('ob-start-btn').addEventListener('click', async () => {
  const nameInput = document.getElementById('ob-name-input');
  const errorEl   = document.getElementById('ob-error');
  const name      = nameInput.value.trim();

  if (!name) {
    errorEl.textContent   = 'Enter your name to continue.';
    errorEl.style.display = 'block';
    return;
  }
  errorEl.style.display = 'none';

  await chrome.storage.local.set({ userName: name, onboardingComplete: true });

  for (const c of document.querySelectorAll('.ob-check')) {
    await chrome.runtime.sendMessage({ type: 'SET_SETTING', key: `${c.dataset.key}_enabled`, value: c.checked });
  }

  document.getElementById('view-onboarding').style.display = 'none';
  document.getElementById('app-main').style.display = 'block';

  await refreshOverview();
  await renderWater();
  await renderSettings();
});

checkOnboarding();

// ── Tabs ───────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`view-${tab.dataset.tab}`).classList.add('active');
    if (tab.dataset.tab === 'dse') loadDSEResults();
    if (tab.dataset.tab === 'mind') { mindMode = 'home'; renderMind(); } else { stopBreathing(); }
    skyMode = tab.dataset.tab === 'mind' ? 'mind' : 'day';
    renderSky();
    if (tab.dataset.tab === 'settings') renderSettings();
  });
});

// ── Eyes 20s local timer ───────────────────────────────────────────
let eyesTimer = null;
let eyesEndAt = null;

function startEyesTimer() {
  eyesEndAt = Date.now() + 20000;
  clearInterval(eyesTimer);
  eyesTimer = setInterval(() => {
    const rem    = Math.max(0, eyesEndAt - Date.now());
    const badge  = document.getElementById('badge-eyes');
    const next   = document.getElementById('next-eyes');
    const card   = document.getElementById('card-eyes');
    const nameEl = document.getElementById('r-name-eyes');
    const btn    = document.getElementById('done-eyes');

    if (rem <= 0) {
      clearInterval(eyesTimer); eyesTimer = null; eyesEndAt = null;
      // Don't auto-reset — show ready state, wait for user to click
      card.classList.remove('active-phase'); card.classList.add('ready-phase');
      badge.textContent  = '✓'; badge.className = 'r-badge ready';
      next.textContent   = REMINDERS.eyes.readyTip; next.className = 'r-next ready-tip';
      nameEl.textContent = REMINDERS.eyes.readyName;
      btn.textContent    = REMINDERS.eyes.activeLabel;
      btn.dataset.action = 'end';
    } else {
      badge.textContent = fmt(rem, true);
      badge.className   = 'r-badge active';
    }
  }, 200);
}

// ── Overview ───────────────────────────────────────────────────────
let overviewInterval = null;
let hasActivePhase   = false;

async function refreshOverview() {
  let state;
  try {
    state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  } catch {
    return;
  }
  if (!state) return;

  // DSE due badge
  const dseTab = document.querySelector('[data-tab="dse"]');
  if (state._dseDue) {
    dseTab.classList.add('has-badge');
  } else {
    dseTab.classList.remove('has-badge');
  }

  hasActivePhase = false;

  for (const [key, r] of Object.entries(REMINDERS)) {
    const s      = state[key];
    const card   = document.getElementById(`card-${key}`);
    const badge  = document.getElementById(`badge-${key}`);
    const next   = document.getElementById(`next-${key}`);
    const btn    = document.getElementById(`done-${key}`);
    const nameEl = document.getElementById(`r-name-${key}`);

    if (!card) continue;

    if (!s.enabled) {
      card.style.display = 'none';
      continue;
    }

    card.style.display = '';
    btn.classList.remove('hidden');
    if (key === 'eyes' && eyesTimer) continue;

    // ── DUE — alarm fired, waiting for user to confirm ──
    if (s.phase === 'due') {
      card.classList.remove('active-phase', 'ready-phase', 'move-phase'); card.classList.add('due-phase');
      badge.textContent  = '!'; badge.className = 'r-badge due';
      next.textContent   = r.waitTip; next.className = 'r-next due-tip';
      nameEl.textContent = r.name;
      btn.textContent    = r.doneLabel;
      btn.dataset.action = 'done';
      btn.classList.add('due-btn');
      continue;
    }

    btn.classList.remove('due-btn');
    card.classList.remove('due-phase');

    // ── READY ──
    if (s.phase === 'ready') {
      card.classList.remove('active-phase'); card.classList.add('ready-phase');
      badge.textContent  = '✓'; badge.className = 'r-badge ready';
      next.textContent   = r.readyTip; next.className = 'r-next ready-tip';
      nameEl.textContent = r.readyName;
      btn.textContent    = r.readyLabel || r.doneLabel;
      btn.dataset.action = 'end';
      continue;
    }

    // ── ACTIVE (standing phase) ──
    if (s.phase === 'active' && s.activeNextTime) {
      hasActivePhase = true;
      const rem = Math.max(0, s.activeNextTime - Date.now());
      card.classList.add('active-phase'); card.classList.remove('ready-phase', 'move-phase');
      badge.textContent  = fmt(rem); badge.className = 'r-badge active';
      next.textContent   = r.activeTip; next.className = 'r-next active-tip';
      nameEl.textContent = r.activeName;
      btn.textContent    = r.activeLabel || r.doneLabel;
      btn.dataset.action = 'end';
      continue;
    }

    // ── MOVING phase (2-minute move) ──
    if (s.phase === 'moving') {
      hasActivePhase = true;
      const rem = s.moveNextTime ? Math.max(0, s.moveNextTime - Date.now()) : 0;
      card.classList.add('move-phase'); card.classList.remove('active-phase', 'ready-phase');
      badge.textContent  = rem > 0 ? fmt(rem) : '2m'; badge.className = 'r-badge move';
      next.textContent   = r.moveTip || r.activeTip; next.className = 'r-next move-tip';
      nameEl.textContent = r.moveName || r.activeName;
      btn.textContent    = r.moveLabel || r.doneLabel;
      btn.dataset.action = 'end';
      continue;
    }

    // ── WAITING ──
    card.classList.remove('active-phase', 'ready-phase', 'move-phase');
    nameEl.textContent = r.name;
    btn.textContent    = r.doneLabel;
    btn.dataset.action = 'done';

    if (!s.waitNextTime) {
      badge.textContent = '—'; badge.className = 'r-badge ok';
      next.textContent  = `Every ${fmtMins(s.interval)}`; next.className = 'r-next';
    } else {
      const rem = Math.max(0, s.waitNextTime - Date.now());
      const pct = rem / (s.interval * 60000);
      badge.textContent = fmt(rem);
      badge.className   = pct < 0.2 ? 'r-badge soon' : 'r-badge ok';
      next.textContent  = r.waitTip;
      next.className    = pct < 0.2 ? 'r-next soon' : 'r-next';
    }
  }

  // Refresh faster when active timers are running
  clearInterval(overviewInterval);
  overviewInterval = setInterval(refreshOverview, hasActivePhase ? 5000 : 15000);
  renderSky();
}

// ── Button handlers ────────────────────────────────────────────────
document.querySelectorAll('.r-done').forEach(btn => {
  btn.addEventListener('click', async () => {
    const key    = btn.dataset.key;
    const action = btn.dataset.action || 'done';
    const r      = REMINDERS[key];

    // Eyes — handle locally
    if (key === 'eyes') {
      if (eyesTimer) { clearInterval(eyesTimer); eyesTimer = null; eyesEndAt = null; }
      if (action === 'end') {
        // User clicked Looking back — reset to waiting
        const card = document.getElementById('card-eyes');
        card.classList.remove('active-phase', 'ready-phase', 'move-phase');
        document.getElementById('r-name-eyes').textContent = r.name;
        btn.textContent    = r.doneLabel;
        btn.dataset.action = 'done';
        btn.classList.remove('due-btn');
        await chrome.runtime.sendMessage({ type: 'DONE_NOW', key: 'eyes' });
        await chrome.runtime.sendMessage({ type: 'INCREMENT_STAT', key: 'eyes' });
        await refreshOverview();
        return;
      }
      // User clicked Looking away — start 20s countdown
      document.getElementById('card-eyes').classList.add('active-phase');
      document.getElementById('r-name-eyes').textContent = r.activeName;
      btn.textContent    = r.activeLabel;
      btn.dataset.action = 'end';
      startEyesTimer();
      await chrome.runtime.sendMessage({ type: 'DONE_NOW', key: 'eyes' });
      return;
    }

    if (action === 'end') {
      // If stand is in active phase and has a move phase, skip to move
      const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      if (key === 'stand' && state.stand.phase === 'active') {
        await chrome.runtime.sendMessage({ type: 'START_MOVE', key });
      } else {
        await chrome.runtime.sendMessage({ type: 'END_ACTIVE', key });
      }
    } else {
      await chrome.runtime.sendMessage({ type: 'DONE_NOW', key });
      await chrome.runtime.sendMessage({ type: 'INCREMENT_STAT', key });
    }

    const orig = btn.textContent;
    btn.textContent = '✓'; btn.classList.add('confirmed');
    setTimeout(async () => {
      btn.classList.remove('confirmed');
      btn.textContent = orig;
      await refreshOverview();
    }, 700);
  });
});

refreshOverview();

// ── Water tracker ──────────────────────────────────────────────────
// Target is derived from hours worked, not set directly. General
// guidance is ~2000ml spread across a 16-hour waking day, so the
// "at work" share is prorated from that and rounded to a tidy 250ml.
const WATER_STEP           = 250;
const WATER_DAILY_BASELINE = 2000;
const WATER_WAKING_HOURS   = 16;
const WORK_HOUR_OPTIONS    = [4, 5, 6, 6.5, 7, 7.5, 8, 9, 10];

function computeWaterGoal(hours) {
  const raw = WATER_DAILY_BASELINE * (hours / WATER_WAKING_HOURS);
  return Math.round(raw / WATER_STEP) * WATER_STEP;
}

async function getWorkHours() {
  const data = await chrome.storage.local.get({ workHours: 8 });
  return data.workHours;
}

async function getWaterGoal() {
  const hours = await getWorkHours();
  return computeWaterGoal(hours);
}

async function getWaterMl() {
  const today = new Date().toISOString().split('T')[0];
  const data  = await chrome.storage.local.get({ waterMl: 0, waterDate: '' });
  if (data.waterDate !== today) {
    await chrome.storage.local.set({ waterMl: 0, waterDate: today });
    return 0;
  }
  return data.waterMl || 0;
}

async function renderWater() {
  setTimeout(renderSky, 0);
  const card = document.getElementById('card-water');
  const waterEnabled = (await chrome.storage.sync.get({ water_enabled: true })).water_enabled;
  if (!waterEnabled) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';

  const ml       = await getWaterMl();
  const goal     = await getWaterGoal();
  const glasses  = goal / WATER_STEP;
  const filled   = Math.floor(ml / WATER_STEP);
  const allDone  = ml >= goal;
  const next     = document.getElementById('next-water');
  const container = document.getElementById('water-glasses');

  // Rebuild glasses to match goal
  container.innerHTML = Array.from({ length: glasses }, (_, i) =>
    `<button class="glass-btn${allDone ? ' done-all' : i < filled ? ' filled' : ''}" data-idx="${i}" title="${(i+1)*WATER_STEP}ml"></button>`
  ).join('');

  // Reattach click handlers
  container.querySelectorAll('.glass-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx     = parseInt(btn.dataset.idx);
      const current = await getWaterMl();
      const g       = await getWaterGoal();
      const target  = (idx + 1) * WATER_STEP;
      const newMl   = current >= target ? idx * WATER_STEP : target;
      await chrome.storage.local.set({
        waterMl:   Math.min(newMl, g),
        waterDate: new Date().toISOString().split('T')[0],
      });
      await renderWater();
    });
  });

  if (allDone) {
    next.textContent = `${goal}ml work target reached, great work! Resets at midnight.`;
    next.className   = 'r-next ready-tip';
    card.classList.add('ready-phase');
  } else {
    next.textContent = `${ml} / ${goal}ml work target`;
    next.className   = 'r-next';
    card.classList.remove('ready-phase');
  }
}

renderWater();

// ── DSE ────────────────────────────────────────────────────────────
const DSE_GUIDANCE = [
  {
    label: 'Monitor position',
    tip:   'Raise your monitor so the top of the screen is at or just below eye level, about an arm\'s length away.',
    url:   ORG_CONFIG.ergonomicsGuideUrl,
  },
  {
    label: 'Wrist posture',
    tip:   'Keep your wrists flat and straight when typing. Consider a wrist rest or adjusting your chair height.',
    url:   ORG_CONFIG.ergonomicsGuideUrl,
  },
  {
    label: 'Foot support',
    tip:   'Your feet should rest flat on the floor. If they dangle, ask IT or facilities for a footrest.',
    url:   ORG_CONFIG.ergonomicsGuideUrl,
  },
  {
    label: 'Chair support',
    tip:   'Adjust your chair\'s lumbar support so it fits the curve of your lower back. Ask your manager about a DSE assessment.',
    url:   ORG_CONFIG.ergonomicsGuideUrl,
  },
  {
    label: 'Screen clarity',
    tip:   'Increase your display resolution or text size, clean the screen, or request an eye test — your employer must provide one.',
    url:   ORG_CONFIG.ergonomicsGuideUrl,
  },
  {
    label: 'Screen glare',
    tip:   'Reposition your monitor away from windows, adjust blinds, or use an anti-glare screen filter.',
    url:   ORG_CONFIG.ergonomicsGuideUrl,
  },
  {
    label: 'Keyboard height',
    tip:   'Adjust your chair height so your elbows are at roughly 90 degrees and your shoulders stay relaxed.',
    url:   ORG_CONFIG.ergonomicsGuideUrl,
  },
  {
    label: 'Screen breaks',
    tip:   'Take 5–10 minutes away from your screen every hour. Use WorkWell\'s screen break reminder to help.',
    url:   ORG_CONFIG.ergonomicsGuideUrl,
  },
  {
    label: 'Lighting',
    tip:   'Aim for around 300–500 lux. Add a desk lamp for task lighting or reposition your workstation away from bright overhead lights.',
    url:   ORG_CONFIG.ergonomicsGuideUrl,
  },
  {
    label: 'Discomfort',
    tip:   'Report persistent pain to your line manager and request a formal DSE workstation assessment.',
    url:   ORG_CONFIG.ergonomicsGuideUrl,
  },
];

let dseAnswers = [];

async function loadDSEResults() {
  const data  = await chrome.storage.local.get({ dseAnswers: null, dseDate: null });
  const score = document.getElementById('dse-score');
  const sub   = document.getElementById('dse-score-sub');
  const last  = document.getElementById('dse-last');
  const btn   = document.getElementById('btn-start-dse');
  const list  = document.getElementById('dse-results');

  if (!data.dseAnswers) {
    score.textContent = '—'; sub.textContent = 'Not yet assessed';
    list.innerHTML = ''; btn.textContent = 'Start assessment'; last.textContent = '';
    return;
  }

  const total = data.dseAnswers.reduce((s, ai, i) => s + DSE_QUESTIONS[i].scores[ai], 0);
  const pct   = Math.round((total / (DSE_QUESTIONS.length * 2)) * 10);
  score.textContent = `${pct}/10`;
  score.style.color = pct >= 8 ? 'var(--green)' : pct >= 5 ? 'var(--amber)' : 'var(--red)';
  sub.textContent   = pct >= 8 ? 'Good setup' : pct >= 5 ? 'Some improvements needed' : 'Needs attention';

  if (data.dseDate) {
    const days = Math.floor((Date.now() - data.dseDate) / 86400000);
    const due  = 90 - days;
    last.textContent = due > 0
      ? `Next review due in ${due} day${due !== 1 ? 's' : ''}`
      : 'Review overdue — please retake';
  }

  list.innerHTML = data.dseAnswers.map((ai, i) => {
    const s    = DSE_QUESTIONS[i].scores[ai];
    const cls  = s === 2 ? 'ok' : s === 1 ? 'warn' : 'bad';
    const tag  = s === 2 ? 'Good' : s === 1 ? 'Review' : 'Action needed';
    const g    = DSE_GUIDANCE[i];
    const guidance = s < 2 ? `
      <div class="dse-guidance">
        <span class="dse-tip">${g.tip}</span>
        ${g.url ? `<a class="dse-link" href="${g.url}" target="_blank" rel="noopener">${ORG_CONFIG.ergonomicsGuideName}</a>` : ''}
      </div>` : '';
    return `<div class="dse-item ${s < 2 ? 'has-guidance' : ''}">
      <div class="dse-item-top">
        <div class="dse-dot ${cls}"></div>
        <div class="dse-text">${DSE_LABELS[i]}</div>
        <div class="dse-tag ${cls}">${tag}</div>
      </div>${guidance}
    </div>`;
  }).join('');

  btn.textContent = 'Retake assessment';
}

function showDSEQuestion(step) {
  const q = DSE_QUESTIONS[step];
  document.getElementById('dse-q-num').textContent     = `Question ${step + 1} of ${DSE_QUESTIONS.length}`;
  document.getElementById('dse-q-text').textContent    = q.q;
  document.getElementById('dse-prog-fill').style.width = `${(step / DSE_QUESTIONS.length) * 100}%`;

  const opts = document.getElementById('dse-options');
  opts.innerHTML = q.opts.map((o, i) => `<button class="dse-opt" data-i="${i}">${o}</button>`).join('');
  opts.querySelectorAll('.dse-opt').forEach(b => {
    b.addEventListener('click', async () => {
      opts.querySelectorAll('.dse-opt').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      dseAnswers[step] = parseInt(b.dataset.i);
      setTimeout(async () => {
        if (step + 1 < DSE_QUESTIONS.length) {
          showDSEQuestion(step + 1);
        } else {
          await chrome.storage.local.set({ dseAnswers, dseDate: Date.now() });
          document.getElementById('dse-questions').classList.remove('active');
          document.getElementById('dse-list').style.display = 'block';
          await loadDSEResults();
          await refreshOverview();

          // Send the completed result on for posting to Slack.
          const maxScore = DSE_QUESTIONS.length * 2;
          const score    = dseAnswers.reduce((s, ai, i) => s + DSE_QUESTIONS[i].scores[ai], 0);
          const flagged  = dseAnswers
            .map((ai, i) => ({ label: DSE_LABELS[i], score: DSE_QUESTIONS[i].scores[ai] }))
            .filter(x => x.score < 2)
            .map(x => x.label);
          chrome.runtime.sendMessage({ type: 'DSE_COMPLETE', score, maxScore, flagged });
        }
      }, 300);
    });
  });
}

document.getElementById('btn-start-dse').addEventListener('click', async () => {
  const errorEl = document.getElementById('dse-name-error');
  const data    = await chrome.storage.local.get({ userName: '' });

  if (!data.userName.trim()) {
    errorEl.textContent = 'Enter your name in Settings before starting the assessment.';
    errorEl.style.display = 'block';
    return;
  }

  errorEl.style.display = 'none';
  dseAnswers = [];
  document.getElementById('dse-list').style.display = 'none';
  document.getElementById('dse-questions').classList.add('active');
  showDSEQuestion(0);
});

loadDSEResults();

// ── Settings ────────────────────────────────────────────────────────
async function renderSettings() {
  const defaults = { eodEnabled: true, eodTime: '17:30' };
  Object.keys(REMINDERS).forEach(k => {
    defaults[`${k}_interval`] = REMINDERS[k].defaultInterval;
    defaults[`${k}_enabled`]  = true;
  });
  const settings  = await chrome.storage.sync.get(defaults);
  const workHours = await getWorkHours();
  const waterGoal = computeWaterGoal(workHours);
  const userName  = (await chrome.storage.local.get({ userName: '' })).userName;
  const container = document.getElementById('settings-content');

  const icons = {
    stand:   `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="3" r="1.5"/><path d="M9 5v4.5M6.5 7l2.5 1 2.5-1M7 16l2-2.5 2 2.5"/></svg>`,
    eyes:    `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M1 9s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z"/><circle cx="9" cy="9" r="2"/></svg>`,
    posture: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 2v7M6 7l3 3 3-3M5 14h8M7 16.5h4"/></svg>`,
    water:   `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 2L4.5 9a5 5 0 1 0 9 0L9 2z"/></svg>`,
    break:   `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="2" y="3" width="14" height="10" rx="2"/><path d="M6 16h6M9 13v3"/></svg>`,
  };

  const reminderSettings = Object.entries(REMINDERS).map(([key, r]) => {
    const interval = settings[`${key}_interval`] || r.defaultInterval;
    const enabled  = settings[`${key}_enabled`];
    const opts     = r.intervals.map((v, i) =>
      `<button class="interval-opt${v === interval ? ' active' : ''}" data-key="${key}" data-v="${v}">${r.intervalLabels[i]}</button>`
    ).join('');
    return `<div class="setting-group">
      <div class="setting-header">
        <div class="setting-icon ${r.iconClass}">${icons[key]}</div>
        <div class="setting-name">${r.name}</div>
        <button class="toggle${enabled ? ' on' : ''}" data-key="${key}" data-setting="${key}_enabled"></button>
      </div>
      <div class="interval-row">
        <span class="interval-label">Reminder</span>
        <div class="interval-opts">${opts}</div>
      </div>
      <div style="font-size:10px;color:var(--text3);line-height:1.5;margin-top:2px;">${r.source}</div>
    </div>`;
  }).join('<div style="height:1px;background:var(--border);margin:2px 0 18px"></div>');

  const eodSection = `<div style="height:1px;background:var(--border);margin:2px 0 18px"></div>
    <div class="setting-group">
      <div class="setting-header">
        <div class="setting-icon break"><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="9" r="6.5"/><path d="M9 5.5V9l2.5 1.5"/></svg></div>
        <div class="setting-name">End of day summary</div>
        <button class="toggle${settings.eodEnabled ? ' on' : ''}" data-key="eodEnabled" id="toggle-eod"></button>
      </div>
      <div class="interval-row">
        <span class="interval-label">Time</span>
        <input type="time" id="eod-time" value="${settings.eodTime}" style="font-size:12px;padding:4px 8px;border:1.5px solid var(--border);border-radius:6px;color:var(--text);background:var(--surface);">
      </div>
      <div style="font-size:10px;color:var(--text3);line-height:1.5;margin-top:2px;">Daily summary of stands, eye rests, water and screen breaks.</div>
    </div>`;

  const waterSection = `<div style="height:1px;background:var(--border);margin:2px 0 18px"></div>
    <div class="setting-group">
      <div class="setting-header">
        <div class="setting-icon water"><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 2L4.5 9a5 5 0 1 0 9 0L9 2z"/></svg></div>
        <div class="setting-name">Hydration</div>
        <button class="toggle${settings.water_enabled !== false ? ' on' : ''}" data-key="water" data-setting="water_enabled"></button>
      </div>
      <div class="interval-row">
        <span class="interval-label">Hours worked</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <select id="water-hours-input" style="font-size:12px;padding:4px 8px;border:1.5px solid var(--border);border-radius:6px;color:var(--text);background:var(--surface);">
            ${WORK_HOUR_OPTIONS.map(v =>
              `<option value="${v}" ${v === workHours ? 'selected' : ''}>${v}h</option>`
            ).join('')}
          </select>
          <span style="font-size:11px;color:var(--text3);" id="water-goal-preview">≈ ${waterGoal}ml target</span>
        </div>
      </div>
      <div style="font-size:10px;color:var(--text3);line-height:1.5;margin-top:2px;">Based on the general ~2000ml/day guidance, prorated to your working hours.</div>
    </div>`;

  const profileSection = `<div class="setting-group">
      <div class="setting-header" style="border-bottom:none; margin-bottom:6px;">
        <div class="setting-name">Your name</div>
      </div>
      <input type="text" id="user-name-input" value="${userName}" placeholder="Your name" style="width:100%;font-size:12px;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;color:var(--text);background:var(--surface);">
      <div style="font-size:10px;color:var(--text3);line-height:1.5;margin-top:4px;">Used to identify you in DSE check results if you're not signed into Chrome with your work account.</div>
    </div>`;

  const moodOn = (await chrome.storage.sync.get({ mood_enabled: false })).mood_enabled;
  const moodSection = `<div style="height:1px;background:var(--border);margin:2px 0 18px"></div>
    <div class="setting-group">
      <div class="setting-header">
        <div class="setting-icon mood"><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="9" r="6.5"/><path d="M6.5 10.5s1 1.5 2.5 1.5 2.5-1.5 2.5-1.5M7 7h.01M11 7h.01"/></svg></div>
        <div class="setting-name">Mood check-in</div>
        <button class="toggle${moodOn ? ' on' : ''}" data-key="mood" data-setting="mood_enabled"></button>
      </div>
      <div style="font-size:10px;color:var(--text3);line-height:1.5;margin-top:2px;">A private daily check-in on the Mind tab. Saved on this Mac only and never shared, including with IT.</div>
    </div>`;

  const appearance = (await chrome.storage.sync.get({ appearance: 'auto' })).appearance;
  const appearanceSection = `<div class="setting-group">
      <div class="setting-header" style="border-bottom:none; margin-bottom:6px;">
        <div class="setting-name">Appearance</div>
      </div>
      <div class="seg" role="group" aria-label="Appearance">
        ${['auto','light','dark'].map(v => `<button type="button" data-appearance="${v}" aria-pressed="${appearance === v}">${v === 'auto' ? 'Match my Mac' : v[0].toUpperCase() + v.slice(1)}</button>`).join('')}
      </div>
    </div><div style="height:1px;background:var(--border);margin:2px 0 18px"></div>`;

  container.innerHTML = appearanceSection + profileSection + `<div style="height:1px;background:var(--border);margin:2px 0 18px"></div>` + reminderSettings + eodSection + waterSection + moodSection;

  container.querySelectorAll('[data-appearance]').forEach(b => b.addEventListener('click', async () => {
    const v = b.dataset.appearance;
    await chrome.storage.sync.set({ appearance: v });
    applyTheme(v);
    container.querySelectorAll('[data-appearance]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));

  document.getElementById('user-name-input')?.addEventListener('change', async (e) => {
    await chrome.storage.local.set({ userName: e.target.value.trim() });
    renderSky();
  });

  container.querySelectorAll('.interval-opt').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      container.querySelectorAll(`.interval-opt[data-key="${key}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await chrome.runtime.sendMessage({ type: 'SET_SETTING', key: `${key}_interval`, value: parseInt(btn.dataset.v) });
      refreshOverview();
    });
  });

  container.querySelectorAll('.toggle').forEach(tog => {
    tog.addEventListener('click', async () => {
      const key        = tog.dataset.key;
      const settingKey = tog.dataset.setting || (key === 'eodEnabled' ? key : `${key}_enabled`);
      const on         = !tog.classList.contains('on');
      tog.classList.toggle('on', on);
      await chrome.runtime.sendMessage({ type: 'SET_SETTING', key: settingKey, value: on });
      if (key === 'water') await renderWater();
      if (key === 'mood') { renderMind(); return; }
      if (key !== 'eodEnabled') refreshOverview();
    });
  });

  document.getElementById('eod-time')?.addEventListener('change', async (e) => {
    await chrome.runtime.sendMessage({ type: 'SET_SETTING', key: 'eodTime', value: e.target.value });
  });

  document.getElementById('water-hours-input')?.addEventListener('change', async (e) => {
    const hours = parseFloat(e.target.value) || 8;
    await chrome.storage.local.set({ workHours: hours });
    const preview = document.getElementById('water-goal-preview');
    if (preview) preview.textContent = `≈ ${computeWaterGoal(hours)}ml target`;
    await renderWater();
  });
}

renderSettings();

// ── Mind: mood check-in, calming tools, support ─────────────────────
// Mood entries are stored in chrome.storage.local only. They are never
// sent to Slack, IT or anywhere else.

// Your organisation's own support. Leave a field empty to hide that entry.
const SUPPORT_CONFIG = {
  // A counselling or Employee Assistance service your organisation provides.
  counselling: {
    name:   'Counselling service',
    detail: 'Talk things through with a qualified counsellor.',
    url:    '',
  },
  // Link to your intranet's wellbeing page.
  hubUrl: '',
  eap:  { name: 'Employee Assistance Programme', detail: '', phone: '', url: '' },
  mhfa: {
    name:   'Mental Health First Aiders',
    detail: '',
    url:    '',
    // Example: { name: 'Alex Smith', role: 'Office Manager', location: 'London' },
    people: [],
  },
};

const PUBLIC_SUPPORT = [
  { name: 'Samaritans', detail: 'Call <b>116 123</b>, free, any time, day or night.', url: 'https://www.samaritans.org', link: 'samaritans.org' },
  { name: 'Shout', detail: 'Text <b>SHOUT</b> to <b>85258</b>, free, 24/7, if you would rather not talk.', url: 'https://giveusashout.org', link: 'giveusashout.org' },
  { name: 'Mind', detail: 'Information and advice. Infoline <b>0300 123 3393</b>.', url: 'https://www.mind.org.uk', link: 'mind.org.uk' },
  { name: 'NHS 111', detail: 'Call <b>111</b> and choose the mental health option for urgent help.', url: 'https://111.nhs.uk', link: '111.nhs.uk' },
];

const MOODS = [
  { v: 1, face: '😞', label: 'Low' },
  { v: 2, face: '🙁', label: 'Not great' },
  { v: 3, face: '😐', label: 'Okay' },
  { v: 4, face: '🙂', label: 'Good' },
  { v: 5, face: '😄', label: 'Great' },
];

const BREATHE_PHASES = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
const BREATHE_SIDE_SECS = 4;
const BREATHE_ROUNDS = 4; // 4 rounds × 16s = just over a minute

const GROUND_STEPS = [
  { n: 5, text: 'Notice 5 things you can see', hint: 'Look around slowly. Pick out small details.' },
  { n: 4, text: 'Notice 4 things you can feel', hint: 'Your feet on the floor, the chair, your sleeves.' },
  { n: 3, text: 'Notice 3 things you can hear', hint: 'Near or far. Traffic, a fan, your own breathing.' },
  { n: 2, text: 'Notice 2 things you can smell', hint: 'Or two smells you like, if nothing stands out.' },
  { n: 1, text: 'Notice 1 thing you can taste', hint: 'Or take a sip of water and notice that.' },
];

let mindMode = 'home';      // home | breathe | ground
let breatheRaf = null;
let groundStep = 0;

function localDateKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getMoods() {
  const { moods } = await chrome.storage.local.get({ moods: {} });
  return moods;
}

async function saveMood(value) {
  const moods = await getMoods();
  moods[localDateKey()] = value;
  // Keep 90 days at most
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
  const cutoffKey = localDateKey(cutoff);
  for (const k of Object.keys(moods)) if (k < cutoffKey) delete moods[k];
  await chrome.storage.local.set({ moods });
}

function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
  return days;
}

function countLowDays(moods) {
  return lastNDays(7).filter(d => (moods[localDateKey(d)] || 99) <= 2).length;
}

function stopBreathing() {
  if (breatheRaf) cancelAnimationFrame(breatheRaf);
  breatheRaf = null;
}

function supportHTML() {
  const items = [];
  const eap = SUPPORT_CONFIG.eap;
  if (eap.detail || eap.phone || eap.url) {
    items.push(`<div class="support-item"><div class="support-name">${eap.name}</div><div class="support-detail">
      ${eap.detail}${eap.phone ? ` Call <b>${eap.phone}</b>.` : ''}${eap.url ? ` <a href="${eap.url}" target="_blank" rel="noopener">Visit website</a>` : ''}</div></div>`);
  }
  const mhfa = SUPPORT_CONFIG.mhfa;
  if (mhfa.detail || mhfa.url || mhfa.people?.length) {
    const people = (mhfa.people || []).map(p => `<div class="mhfa-person">
        <span class="mhfa-name">${p.name}</span><span class="mhfa-loc">${p.location}</span>
        <span class="mhfa-role">${p.role}</span></div>`).join('');
    items.push(`<div class="support-item"><div class="support-name">${mhfa.name}</div><div class="support-detail">
      ${mhfa.detail}${mhfa.url ? ` <a href="${mhfa.url}" target="_blank" rel="noopener">See who they are</a>` : ''}</div>
      ${people ? `<div class="mhfa-list">${people}</div>` : ''}</div>`);
  }
  const hs = SUPPORT_CONFIG.counselling;
  if (hs?.url) {
    items.push(`<div class="support-item"><div class="support-name">${hs.name}</div><div class="support-detail">
      ${hs.detail}</div><a class="support-cta" href="${hs.url}" target="_blank" rel="noopener">Get started</a></div>`);
  }
  for (const s of PUBLIC_SUPPORT) {
    items.push(`<div class="support-item"><div class="support-name">${s.name}</div><div class="support-detail">
      ${s.detail} <a href="${s.url}" target="_blank" rel="noopener">${s.link}</a></div></div>`);
  }
  return `<div class="mind-block" id="support-block">
    <div class="mind-title">Need to talk?</div>
    <div class="mind-sub">You don't have to wait until things feel serious.</div>
    <div style="margin-top:6px;">${items.join('')}</div>
    ${SUPPORT_CONFIG.hubUrl ? `<a class="hub-link" href="${SUPPORT_CONFIG.hubUrl}" target="_blank" rel="noopener">More wellbeing support<span>Resources and guides on your wellbeing page</span></a>` : ''}
    <div class="support-foot">WorkWell isn't a replacement for professional support. If you or someone else is in immediate danger, call 999.</div>
  </div>`;
}

async function renderMind() {
  const el = document.getElementById('mind-content');
  if (!el) return;
  if (mindMode === 'breathe') return renderBreathe(el);
  if (mindMode === 'ground')  return renderGround(el);
  stopBreathing();

  const { mood_enabled } = await chrome.storage.sync.get({ mood_enabled: false });
  const moods = await getMoods();
  const todayKey = localDateKey();
  const todayVal = moods[todayKey];
  const lowDays = countLowDays(moods);

  let moodBlock = '';
  if (mood_enabled) {
    const opts = MOODS.map(m => `<button class="mood-opt${todayVal === m.v ? ' selected' : ''}" data-mood="${m.v}" aria-label="${m.label}">
        <span class="m-face">${m.face}</span><span class="m-label">${m.label}</span></button>`).join('');
    const week = lastNDays(7).map(d => {
      const k = localDateKey(d), v = moods[k], m = MOODS.find(x => x.v === v);
      const name = d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2);
      return `<div class="mood-day${k === todayKey ? ' today' : ''}">
        ${m ? `<span class="d-face" title="${m.label}">${m.face}</span>` : `<span class="d-face"><span class="d-empty"></span></span>`}
        <span class="d-name">${name}</span></div>`;
    }).join('');
    let note = '';
    if (todayVal && todayVal <= 2) note = `<div class="mood-note">Thanks for checking in. If today is hard, the support options below are there for you.</div>`;
    else if (todayVal) note = `<div class="mood-note">Thanks for checking in.</div>`;
    moodBlock = `<div class="mind-block lilac">
      <div class="mind-title">Today's check-in</div>
      <div class="mood-opts">${opts}</div>
      ${note}
      <div class="mood-week">${week}</div>
      <div class="mind-private">Saved on this Mac only. Never shared, including with IT.</div>
    </div>`;
  }

  const careBanner = (mood_enabled && lowDays >= 3) ? `<div class="mind-block care-banner">
      <div class="mind-title">The last few days have felt tough</div>
      <div class="mind-sub">That happens, and you don't have to handle it alone. Talking to someone you trust, or one of the services below, can help.</div>
    </div>` : '';

  const toolsBlock = `<div class="mind-block lilac">
      <div class="mind-title">Take a moment</div>
      <div class="mind-sub">Short exercises to slow down and reset.</div>
      <div class="tool-row">
        <button class="tool-btn" id="tool-breathe"><b>Box breathing</b><span>1 minute</span></button>
        <button class="tool-btn" id="tool-ground"><b>5-4-3-2-1</b><span>Grounding, 2 minutes</span></button>
      </div>
    </div>`;

  el.innerHTML = moodBlock + toolsBlock + careBanner + supportHTML();

  el.querySelectorAll('.mood-opt').forEach(b => b.addEventListener('click', async () => {
    await saveMood(parseInt(b.dataset.mood));
    renderMind();
    renderSky();
  }));
  document.getElementById('tool-breathe').addEventListener('click', () => { mindMode = 'breathe'; renderMind(); });
  document.getElementById('tool-ground').addEventListener('click',  () => { mindMode = 'ground'; groundStep = 0; renderMind(); });
}

function renderBreathe(el) {
  stopBreathing();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.innerHTML = `<div class="mind-block">
    <div class="breathe-stage">
      <div class="mind-title">Box breathing</div>
      <div class="mind-sub" style="text-align:center;">Follow the dot around the square.</div>
      <div class="breathe-box">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <rect x="10" y="10" width="100" height="100" rx="6" fill="none" style="stroke:var(--breathe-track)" stroke-width="3"/>
          <path id="breathe-trail" d="M10 110 L10 10 L110 10 L110 110 Z" fill="none" style="stroke:var(--lilac)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" pathLength="400" stroke-dasharray="0 400"/>
          <circle id="breathe-dot" cx="10" cy="110" r="7" style="fill:var(--lilac)"/>
        </svg>
        <div class="breathe-centre" id="breathe-num">4</div>
      </div>
      <div class="breathe-phase" id="breathe-phase" aria-live="polite">Breathe in</div>
      <div class="breathe-count" id="breathe-round">Round 1 of ${BREATHE_ROUNDS}</div>
    </div>
    <div class="btn-row"><button class="btn-soft" id="breathe-stop">Stop</button></div>
  </div>`;

  document.getElementById('breathe-stop').addEventListener('click', () => { stopBreathing(); mindMode = 'home'; renderMind(); });

  // Dot path: up the left side (in), across the top (hold), down the right (out), along the bottom (hold)
  const corners = [[10,110],[10,10],[110,10],[110,110],[10,110]];
  const sideMs = BREATHE_SIDE_SECS * 1000;
  const totalMs = sideMs * 4 * BREATHE_ROUNDS;
  const start = performance.now();
  const dot = document.getElementById('breathe-dot');
  const trail = document.getElementById('breathe-trail');
  const phaseEl = document.getElementById('breathe-phase');
  const numEl = document.getElementById('breathe-num');
  const roundEl = document.getElementById('breathe-round');
  if (reduced) { dot.style.display = 'none'; }

  const tick = (now) => {
    const t = now - start;
    if (t >= totalMs) {
      phaseEl.textContent = 'Well done';
      numEl.textContent = '✓';
      roundEl.textContent = 'Notice how you feel now.';
      document.getElementById('breathe-stop').textContent = 'Back';
      breatheRaf = null;
      return;
    }
    const side = Math.floor(t / sideMs) % 4;
    const within = (t % sideMs) / sideMs;
    const round = Math.floor(t / (sideMs * 4)) + 1;
    const [x1, y1] = corners[side], [x2, y2] = corners[side + 1];
    if (!reduced) {
      dot.setAttribute('cx', x1 + (x2 - x1) * within);
      dot.setAttribute('cy', y1 + (y2 - y1) * within);
    }
    // Trail fills the square once per round, starting bottom-left going up
    const progress = (side + within) * 100;
    trail.setAttribute('stroke-dasharray', `${progress} 400`);
    phaseEl.textContent = BREATHE_PHASES[side];
    numEl.textContent = String(BREATHE_SIDE_SECS - Math.floor(within * BREATHE_SIDE_SECS));
    roundEl.textContent = `Round ${round} of ${BREATHE_ROUNDS}`;
    breatheRaf = requestAnimationFrame(tick);
  };
  breatheRaf = requestAnimationFrame(tick);
}

function renderGround(el) {
  stopBreathing();
  if (groundStep >= GROUND_STEPS.length) {
    el.innerHTML = `<div class="mind-block">
      <div class="ground-num">✓</div>
      <div class="ground-text">Nicely done</div>
      <div class="ground-hint">Take a slow breath before you get back to work.</div>
      <div class="btn-row"><button class="btn-lilac" id="ground-done">Back</button></div>
    </div>`;
    document.getElementById('ground-done').addEventListener('click', () => { mindMode = 'home'; renderMind(); });
    return;
  }
  const s = GROUND_STEPS[groundStep];
  const dots = GROUND_STEPS.map((_, i) => `<i class="${i <= groundStep ? 'on' : ''}"></i>`).join('');
  el.innerHTML = `<div class="mind-block">
    <div class="mind-sub" style="margin:0 0 8px;">5-4-3-2-1 grounding</div>
    <div class="ground-num">${s.n}</div>
    <div class="ground-text">${s.text}</div>
    <div class="ground-hint">${s.hint} Take your time.</div>
    <div class="ground-dots">${dots}</div>
    <div class="btn-row">
      <button class="btn-soft" id="ground-stop">Stop</button>
      <button class="btn-lilac" id="ground-next">${groundStep === GROUND_STEPS.length - 1 ? 'Finish' : 'Next'}</button>
    </div>
  </div>`;
  document.getElementById('ground-stop').addEventListener('click', () => { mindMode = 'home'; renderMind(); });
  document.getElementById('ground-next').addEventListener('click', () => { groundStep++; renderMind(); });
}

renderMind();


// ── Sky header: workday scene and growing plant ─────────────────────
// Each healthy action today (stand, eye rest, posture check, screen
// break or a glass of water) grows a leaf. Six leaves and it blooms.
const PLANT_BLOOM_AT = 6;
let skyMode = 'day';   // day | mind

const SCENES = {
  morning:   { top: '#A8D8F2', base: '#BFE3F7', hill1: '#8FD19E', hill2: '#5DB97A', ink: '#14304A', ink2: '#2B5675', sun: '#FFD866' },
  midday:    { top: '#7EC4F0', base: '#A6D9F7', hill1: '#8FD19E', hill2: '#5DB97A', ink: '#0F2E47', ink2: '#1F4A68', sun: '#FFE07A' },
  afternoon: { top: '#F6C79A', base: '#FBE0B8', hill1: '#A3CF8A', hill2: '#6FAE6B', ink: '#4A2A12', ink2: '#6E4220', sun: '#FFB84D' },
  evening:   { top: '#232A52', base: '#2D3560', band: '#5B4A78', hill1: '#2F5A4A', hill2: '#234537', ink: '#FFFFFF', ink2: '#C9CDF0', sun: '#F5A35C', stars: true },
  night:     { top: '#151B38', base: '#1D2547', hill1: '#24443A', hill2: '#1A342C', ink: '#FFFFFF', ink2: '#B8BEE6', moon: true, stars: true },
  mind:      { top: '#D6D0F6', base: '#E4E0FA', hill1: '#B9B0EE', hill2: '#9F94E3', ink: '#26215C', ink2: '#3C3489', calmMoon: true },
};

function sceneForTime(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 11)  return 'morning';
  if (h >= 11 && h < 15) return 'midday';
  if (h >= 15 && h < 18) return 'afternoon';
  if (h >= 18 && h < 21) return 'evening';
  return 'night';
}

function leafPath(y, side) {
  return side < 0
    ? `M250 ${y} C238 ${y - 2} 234 ${y - 10} 236 ${y - 16} C246 ${y - 14} 250 ${y - 8} 250 ${y}Z`
    : `M250 ${y} C262 ${y - 2} 266 ${y - 10} 264 ${y - 16} C254 ${y - 14} 250 ${y - 8} 250 ${y}Z`;
}

function plantSVG(leaves, dark) {
  const leaf = dark ? '#4FB27A' : '#3FAE6A';
  const stemCol = dark ? '#4FB27A' : '#2E8B57';
  const ys = [101, 94, 87, 80, 73, 66];
  const n = Math.min(leaves, PLANT_BLOOM_AT);
  const top = n === 0 ? 104 : ys[n - 1] - 12;
  let out = `<rect x="238" y="110" width="24" height="18" rx="3" fill="${dark ? '#B86C47' : '#E58A5B'}"/>
    <rect x="235" y="107" width="30" height="6" rx="2" fill="${dark ? '#A05C3B' : '#D0744A'}"/>
    <path d="M250 107 L250 ${top}" stroke="${stemCol}" stroke-width="3" stroke-linecap="round"/>`;
  if (n === 0) {
    out += `<path d="M250 104 C245 103 243 99 244 97 C248 98 250 101 250 104Z" fill="${leaf}"/>
            <path d="M250 104 C255 103 257 99 256 97 C252 98 250 101 250 104Z" fill="${leaf}"/>`;
  }
  for (let i = 0; i < n; i++) out += `<path d="${leafPath(ys[i], i % 2 ? 1 : -1)}" fill="${leaf}"/>`;
  if (n >= PLANT_BLOOM_AT) {
    out += `<g transform="translate(250 ${top})">
      <circle cx="0" cy="-6" r="4.5" fill="#F7A8C4"/><circle cx="6" cy="0" r="4.5" fill="#F7A8C4"/>
      <circle cx="0" cy="6" r="4.5" fill="#F7A8C4"/><circle cx="-6" cy="0" r="4.5" fill="#F7A8C4"/>
      <circle r="4" fill="#FFD866"/></g>`;
  } else if (n > 0) {
    out += `<circle cx="250" cy="${top}" r="4" fill="${dark ? '#2F5A4A' : '#BFE8C9'}" stroke="${leaf}" stroke-width="1.5"/>`;
  }
  return out;
}

function skySVG(sceneKey, leaves) {
  const sc = SCENES[sceneKey];
  const dusk = !!sc.stars;
  let art = `<rect width="300" height="132" fill="${sc.base}"/><rect width="300" height="48" fill="${sc.top}"/>`;
  if (sc.band) art += `<rect y="84" width="300" height="30" fill="${sc.band}"/>`;
  if (sc.stars) art += [[170,20,1.4],[205,34,1.1],[232,14,1.3],[150,40,1],[282,26,1.2],[118,50,1]].map(([x,y,r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFFFFF" opacity="0.9"/>`).join('');
  if (sc.moon) art += `<circle cx="196" cy="30" r="12" fill="#F4F1DE"/><circle cx="201" cy="26" r="11" fill="${sc.top}"/>`;
  if (sc.calmMoon) art += `<circle cx="196" cy="54" r="17" fill="#FFFFFF" opacity="0.8"/>`;
  if (sc.sun && !sc.band) {
    const now = new Date();
    const t = Math.min(1, Math.max(0, (now.getHours() + now.getMinutes() / 60 - 7) / 11));
    const x = 40 + t * 150, y = 80 - Math.sin(Math.PI * t) * 12;
    art += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="27" fill="${sc.sun}" opacity="0.3"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="19" fill="${sc.sun}"/>`;
  }
  if (sc.band) art += `<circle cx="58" cy="94" r="17" fill="${sc.sun}"/>`;
  if (!dusk && sceneKey !== 'mind') {
    art += `<ellipse cx="140" cy="72" rx="22" ry="6" fill="#FFFFFF" opacity="0.85"/><ellipse cx="155" cy="67" rx="13" ry="6" fill="#FFFFFF" opacity="0.85"/>`;
  }
  art += `<path d="M0 112 Q60 88 130 106 T300 98 V132 H0Z" fill="${sc.hill1}"/>`;
  if (sceneKey !== 'mind') art += plantSVG(leaves, dusk);
  art += `<path d="M0 124 Q90 106 180 120 T300 116 V132 H0Z" fill="${sc.hill2}"/>`;
  return `<svg viewBox="0 0 300 132" preserveAspectRatio="xMidYMid slice">${art}</svg>`;
}

async function getLeavesToday() {
  const utcToday = new Date().toISOString().split('T')[0];
  const { stats } = await chrome.storage.local.get({ stats: {} });
  const st = stats[utcToday] || {};
  const actions = (st.stand || 0) + (st.eyes || 0) + (st.posture || 0) + (st.break || 0);
  const water = Math.floor((await getWaterMl()) / WATER_STEP);
  return actions + water;
}

function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.getElementById('confetti');
  if (!box) return;
  const colours = ['#F7A8C4', '#FFD866', '#85B7EB', '#9FE1CB', '#B1A8EA'];
  box.innerHTML = Array.from({ length: 28 }, (_, i) =>
    `<i style="left:${Math.round(Math.random() * 100)}%;background:${colours[i % colours.length]};animation-delay:${(Math.random() * 0.6).toFixed(2)}s"></i>`
  ).join('');
  setTimeout(() => { box.innerHTML = ''; }, 3200);
}

async function renderSky() {
  const art = document.getElementById('sky-art');
  if (!art) return;
  const sceneKey = skyMode === 'mind' ? 'mind' : sceneForTime();
  const sc = SCENES[sceneKey];
  const leaves = await getLeavesToday();
  art.innerHTML = skySVG(sceneKey, leaves);

  const sky = document.getElementById('sky');
  sky.style.setProperty('--sky-ink', sc.ink);
  sky.style.setProperty('--sky-ink2', sc.ink2);

  const { userName } = await chrome.storage.local.get({ userName: '' });
  const first = (userName || '').trim().split(/\s+/)[0];
  const greetEl = document.getElementById('greet');
  const subEl = document.getElementById('greet-sub');

  if (sceneKey === 'mind') {
    const moods = await getMoods();
    const checkedIn = moods[localDateKey()];
    greetEl.textContent = 'Take a breath';
    subEl.textContent = checkedIn ? 'Thanks for checking in today.' : 'How are you feeling today?';
    return;
  }

  const hello = { morning: 'Morning', midday: 'Hello', afternoon: 'Afternoon', evening: 'Evening', night: 'Hello' }[sceneKey];
  greetEl.textContent = first ? `${hello}, ${first}` : hello;
  if (leaves >= PLANT_BLOOM_AT) subEl.textContent = 'In full bloom. Great work today.';
  else if (leaves === 0) subEl.textContent = 'Each healthy break grows your plant a leaf.';
  else {
    const left = PLANT_BLOOM_AT - leaves;
    subEl.textContent = `${leaves} ${leaves === 1 ? 'leaf' : 'leaves'} today. ${left} more to bloom.`;
  }

  if (leaves >= PLANT_BLOOM_AT) {
    const today = localDateKey();
    const { bloomCelebrated } = await chrome.storage.local.get({ bloomCelebrated: '' });
    if (bloomCelebrated !== today) {
      await chrome.storage.local.set({ bloomCelebrated: today });
      celebrate();
    }
  }
}

renderSky();
