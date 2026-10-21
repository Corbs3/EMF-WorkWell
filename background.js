const REMINDERS = {
  stand: {
    id:              'workwell-stand',
    activeId:        'workwell-stand-active',
    moveId:          'workwell-stand-move',
    title:           'Time to stand & stretch!',
    message:         "Stand for 8 minutes, then move for 2. Cornell University 20-8-2 rule.",
    standTitle:      'Now move for 2 minutes',
    standMessage:    "You've been standing for 8 minutes — now walk around or stretch for 2 minutes.",
    readyTitle:      '20-8-2 cycle complete',
    readyMessage:    "Great work — sit back down whenever you're ready. Next reminder in 20 minutes.",
    defaultInterval: 20,
    minDuration:     8,
    moveDuration:    2,
    defaultEnabled:  true,
  },
  eyes: {
    id:              'workwell-eyes',
    activeId:        null,
    title:           'Eye rest — 20-20-20',
    message:         "Look at something 20 feet away for 20 seconds. AOA recommendation.",
    readyTitle:      null,
    readyMessage:    null,
    defaultInterval: 20,
    minDuration:     null,
    defaultEnabled:  true,
  },
  posture: {
    id:              'workwell-posture',
    activeId:        null,
    title:           'Posture check',
    message:         "Sit back in your chair, relax your shoulders, feet flat on the floor. HSE DSE guidance.",
    readyTitle:      null,
    readyMessage:    null,
    defaultInterval: 90,
    minDuration:     null,
    defaultEnabled:  true,
  },
  break: {
    id:              'workwell-break',
    activeId:        'workwell-break-active',
    title:           'Screen break due',
    message:         "Step away from your screen for at least 5 minutes. Feeling tense? Try box breathing on the Mind tab. HSE DSE Regulations.",
    readyTitle:      'Minimum break time reached',
    readyMessage:    "You've been on a break for 5 minutes. Come back to your desk whenever you're ready.",
    defaultInterval: 60,
    minDuration:     5,
    defaultEnabled:  true,
  },
};

const ALARM_TO_KEY = {};
for (const [key, r] of Object.entries(REMINDERS)) {
  ALARM_TO_KEY[r.id] = key;
  if (r.activeId) ALARM_TO_KEY[r.activeId] = `${key}_active`;
  if (r.moveId)   ALARM_TO_KEY[r.moveId]   = `${key}_move`;
}

// ── Slack integration (DSE results) ─────────────────────────────────
// Paste your Slack incoming webhook URL here to receive DSE results.
// Leave it empty to turn Slack posting off. Never commit a real webhook
// URL to a public repository: anyone who has it can post to your channel.
const SLACK_WEBHOOK_URL = '';

function getSignedInEmail() {
  return new Promise((resolve) => {
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (info) => {
      resolve(info && info.email ? info.email : '');
    });
  });
}

async function getIdentityLabel() {
  const email = await getSignedInEmail();
  if (email) return email;

  const data = await chrome.storage.local.get({ userName: '' });
  if (data.userName) return data.userName;

  return 'Unknown user';
}

async function postDSEResultToSlack(score, maxScore, flagged) {
  if (!SLACK_WEBHOOK_URL) return;
  const who  = await getIdentityLabel();
  const pct  = Math.round((score / maxScore) * 100);
  const flaggedText = flagged.length
    ? flagged.map(f => `• ${f}`).join('\n')
    : 'No issues flagged, all clear.';

  const payload = {
    text: `DSE check completed by ${who}\nScore: ${score}/${maxScore} (${pct}%)\n\nFlagged:\n${flaggedText}`,
  };

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch (err) {
    console.error('WorkWell: failed to post DSE result to Slack', err);
  }
}

// ── Idle detection ────────────────────────────────────────────────
// Only the "waiting" countdown to the next reminder is paused. Active
// break/move phases are left running, since being away from the desk
// already satisfies what those timers are asking for.
const IDLE_THRESHOLD_SECONDS = 60;
chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);

async function pauseWaitingAlarms() {
  const phases = await getPhases();
  const data   = await chrome.storage.local.get({ pausedAlarms: {} });
  const paused = data.pausedAlarms;
  const now    = Date.now();

  for (const [key, r] of Object.entries(REMINDERS)) {
    const phase = phases[key] || 'waiting';
    if (phase !== 'waiting') continue;
    const alarm = await chrome.alarms.get(r.id);
    if (!alarm) continue;
    const remaining = alarm.scheduledTime - now;
    if (remaining <= 0) continue;
    paused[key] = remaining;
    await chrome.alarms.clear(r.id);
  }

  await chrome.storage.local.set({ pausedAlarms: paused });
}

async function resumeWaitingAlarms() {
  const data   = await chrome.storage.local.get({ pausedAlarms: {} });
  const paused = data.pausedAlarms;
  if (Object.keys(paused).length === 0) return;

  for (const [key, remainingMs] of Object.entries(paused)) {
    const r = REMINDERS[key];
    if (!r) continue;
    const delayInMinutes = Math.max(remainingMs / 60000, 0.1);
    chrome.alarms.create(r.id, { delayInMinutes });
  }

  await chrome.storage.local.set({ pausedAlarms: {} });
}

chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'idle' || state === 'locked') {
    pauseWaitingAlarms();
  } else if (state === 'active') {
    resumeWaitingAlarms();
  }
});

async function getSettings() {
  const defaults = { eodEnabled: true, eodTime: '17:30' };
  for (const [key, r] of Object.entries(REMINDERS)) {
    defaults[`${key}_interval`] = r.defaultInterval;
    defaults[`${key}_enabled`]  = r.defaultEnabled;
  }
  return chrome.storage.sync.get(defaults);
}

async function getPhases() {
  const data = await chrome.storage.local.get({ phases: {} });
  return data.phases;
}

async function setPhase(key, phase) {
  const data = await chrome.storage.local.get({ phases: {} });
  data.phases[key] = phase;
  await chrome.storage.local.set({ phases: data.phases });
}

async function scheduleWaiting(key) {
  const settings = await getSettings();
  const r = REMINDERS[key];
  if (!r || !settings[`${key}_enabled`]) return;
  await chrome.alarms.clear(r.id);
  chrome.alarms.create(r.id, { delayInMinutes: settings[`${key}_interval`] });
}

async function startActive(key) {
  const r = REMINDERS[key];
  if (!r?.activeId || !r.minDuration) return;
  await chrome.alarms.clear(r.activeId);
  if (r.moveId) await chrome.alarms.clear(r.moveId);
  chrome.alarms.create(r.activeId, { delayInMinutes: r.minDuration });
  await setPhase(key, 'active');
}

async function startMove(key) {
  const r = REMINDERS[key];
  if (!r?.moveId || !r.moveDuration) return;
  await chrome.alarms.clear(r.moveId);
  chrome.alarms.create(r.moveId, { delayInMinutes: r.moveDuration });
  await setPhase(key, 'moving');
  chrome.notifications.create(`${key}-move`, {
    type:    'basic',
    iconUrl: 'icons/icon128.png',
    title:   r.standTitle,
    message: r.standMessage + ' Click WorkWell when done.',
  });
}

async function endToWaiting(key) {
  const r = REMINDERS[key];
  if (r?.activeId) await chrome.alarms.clear(r.activeId);
  if (r?.moveId)   await chrome.alarms.clear(r.moveId);
  await setPhase(key, 'waiting');
  await scheduleWaiting(key);
}

// Mirrors the hours-based water target logic in popup.js.
const WATER_DAILY_BASELINE = 2000;
const WATER_WAKING_HOURS   = 16;
const WATER_STEP           = 250;

function computeWaterGoal(hours) {
  const raw = WATER_DAILY_BASELINE * (hours / WATER_WAKING_HOURS);
  return Math.round(raw / WATER_STEP) * WATER_STEP;
}

function getNextMidnight() {
  const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime();
}

function getNextEOD(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

async function scheduleEOD() {
  const settings = await getSettings();
  await chrome.alarms.clear('workwell-eod');
  if (settings.eodEnabled) {
    chrome.alarms.create('workwell-eod', { when: getNextEOD(settings.eodTime) });
  }
}

async function incrementStat(key) {
  const today = new Date().toISOString().split('T')[0];
  const data  = await chrome.storage.local.get({ stats: {} });
  if (!data.stats[today]) data.stats[today] = { stand: 0, eyes: 0, posture: 0, break: 0 };
  if (data.stats[today][key] !== undefined) data.stats[today][key]++;
  await chrome.storage.local.set({ stats: data.stats });
}

// ── Alarm handler ──────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'workwell-water-reset') {
    await chrome.storage.local.set({ waterMl: 0, waterDate: new Date().toISOString().split('T')[0] });
    chrome.alarms.create('workwell-water-reset', { when: getNextMidnight() });
    return;
  }

  if (alarm.name === 'workwell-eod') {
    const today   = new Date().toISOString().split('T')[0];
    const data    = await chrome.storage.local.get({ stats: {}, waterMl: 0, waterDate: '', workHours: 8 });
    const stats   = data.stats[today] || {};
    const waterMl = data.waterDate === today ? data.waterMl : 0;
    const waterGoal = computeWaterGoal(data.workHours);

    const lines = [
      stats.stand  ? `✓ Stood up ${stats.stand} time${stats.stand !== 1 ? 's' : ''}` : '✗ No stands logged',
      stats.eyes   ? `✓ Eye rest ${stats.eyes} time${stats.eyes !== 1 ? 's' : ''}` : '✗ No eye rests logged',
      waterMl >= waterGoal ? `✓ Hit your ${waterGoal}ml water target` : `◦ ${waterMl}/${waterGoal}ml water`,
      stats.break  ? `✓ ${stats.break} screen break${stats.break !== 1 ? 's' : ''}` : '✗ No screen breaks logged',
    ];

    chrome.notifications.create('workwell-eod-summary', {
      type:    'basic',
      iconUrl: 'icons/icon128.png',
      title:   'WorkWell — end of day summary',
      message: lines.join('\n'),
      requireInteraction: false,
    });

    await scheduleEOD();
    return;
  }

  const mappedKey = ALARM_TO_KEY[alarm.name];
  if (!mappedKey) return;

  if (mappedKey.endsWith('_move')) {
    const key = mappedKey.replace('_move', '');
    const r   = REMINDERS[key];
    await setPhase(key, 'ready');
    chrome.notifications.create(`${key}-ready`, {
      type:    'basic',
      iconUrl: 'icons/icon128.png',
      title:   r.readyTitle,
      message: r.readyMessage + ' Click the WorkWell icon when ready.',
    });
  } else if (mappedKey.endsWith('_active')) {
    const key = mappedKey.replace('_active', '');
    const r   = REMINDERS[key];
    if (r.moveDuration) {
      await startMove(key);
    } else {
      await setPhase(key, 'ready');
      chrome.notifications.create(`${key}-ready`, {
        type:    'basic',
        iconUrl: 'icons/icon128.png',
        title:   r.readyTitle,
        message: r.readyMessage + ' Click the WorkWell icon when ready.',
      });
    }
  } else {
    const key      = mappedKey;
    const r        = REMINDERS[key];
    const settings = await getSettings();
    if (!settings[`${key}_enabled`]) return;

    // Set to 'due' — wait for user to confirm before starting active timer
    await setPhase(key, 'due');

    chrome.notifications.create(r.id, {
      type:    'basic',
      iconUrl: 'icons/icon128.png',
      title:   r.title,
      message: r.message + ' Click the WorkWell icon to start.',
    });
  }
});

// ── Notification click — open popup ──────────────────────────────

chrome.notifications.onClicked.addListener((notifId) => chrome.notifications.clear(notifId));

// ── Message handler ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    (async () => {
      const settings = await getSettings();
      const phases   = await getPhases();
      const today    = new Date().toISOString().split('T')[0];
      const data     = await chrome.storage.local.get({ stats: {}, dseAnswers: null, dseDate: null });
      const stats    = data.stats[today] || {};
      const result   = { _eod: { enabled: settings.eodEnabled, time: settings.eodTime }, _stats: stats };

      // DSE due flag
      if (data.dseDate) {
        const days = Math.floor((Date.now() - data.dseDate) / 86400000);
        result._dseDue = days >= 90;
      } else {
        result._dseDue = true;
      }

      for (const [key, r] of Object.entries(REMINDERS)) {
        const waitAlarm   = await chrome.alarms.get(r.id);
        const activeAlarm = r.activeId ? await chrome.alarms.get(r.activeId) : null;
        const moveAlarm   = r.moveId   ? await chrome.alarms.get(r.moveId)   : null;
        result[key] = {
          enabled:        settings[`${key}_enabled`],
          interval:       settings[`${key}_interval`] || r.defaultInterval,
          phase:          phases[key] || 'waiting',
          waitNextTime:   waitAlarm?.scheduledTime  || null,
          activeNextTime: activeAlarm?.scheduledTime || null,
          moveNextTime:   moveAlarm?.scheduledTime   || null,
          minDuration:    r.minDuration,
          moveDuration:   r.moveDuration || null,
          statToday:      stats[key] || 0,
        };
      }
      sendResponse(result);
    })();
    return true;
  }

  if (msg.type === 'DONE_NOW') {
    (async () => {
      const r = REMINDERS[msg.key];
      if (!r) { sendResponse({ ok: false }); return; }
      await chrome.alarms.clear(r.id);
      await incrementStat(msg.key);
      if (r.minDuration) {
        await startActive(msg.key);
      } else {
        await setPhase(msg.key, 'waiting');
        await scheduleWaiting(msg.key);
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'START_MOVE') {
    (async () => {
      await startMove(msg.key);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'END_ACTIVE') {
    (async () => {
      await endToWaiting(msg.key);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'INCREMENT_STAT') {
    (async () => {
      await incrementStat(msg.key);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'DSE_COMPLETE') {
    postDSEResultToSlack(msg.score, msg.maxScore, msg.flagged);
    return false;
  }

  if (msg.type === 'SET_SETTING') {
    chrome.storage.sync.set({ [msg.key]: msg.value }).then(async () => {
      const rKey = msg.key.replace(/_interval$|_enabled$/, '');
      if (REMINDERS[rKey]) {
        if (msg.key.endsWith('_enabled') && !msg.value) {
          await chrome.alarms.clear(REMINDERS[rKey].id);
          if (REMINDERS[rKey].activeId) await chrome.alarms.clear(REMINDERS[rKey].activeId);
          if (REMINDERS[rKey].moveId)   await chrome.alarms.clear(REMINDERS[rKey].moveId);
          await setPhase(rKey, 'waiting');
        } else {
          await scheduleWaiting(rKey);
        }
      }
      if (msg.key === 'eodEnabled' || msg.key === 'eodTime') await scheduleEOD();
      sendResponse({ ok: true });
    });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  for (const [key, r] of Object.entries(REMINDERS)) {
    if (settings[`${key}_enabled`])
      chrome.alarms.create(r.id, { delayInMinutes: settings[`${key}_interval`] });
  }
  chrome.alarms.create('workwell-water-reset', { when: getNextMidnight() });
  if (settings.eodEnabled)
    chrome.alarms.create('workwell-eod', { when: getNextEOD(settings.eodTime) });
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  const phases   = await getPhases();
  for (const [key, r] of Object.entries(REMINDERS)) {
    if (!settings[`${key}_enabled`]) continue;
    const waitAlarm   = await chrome.alarms.get(r.id);
    const activeAlarm = r.activeId ? await chrome.alarms.get(r.activeId) : null;
    if (phases[key] === 'active' && !activeAlarm) await endToWaiting(key);
    else if (!waitAlarm && phases[key] === 'waiting') await scheduleWaiting(key);
  }
  const eodAlarm = await chrome.alarms.get('workwell-eod');
  if (!eodAlarm && settings.eodEnabled) await scheduleEOD();
});
