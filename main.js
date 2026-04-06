/* ============================================================
   TIME MANAGER — main.js
   3-Screen Flow: Welcome → Time Selection → Planning
   ============================================================ */

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
const S = {
  tasks:      JSON.parse(localStorage.getItem('tm_tasks'))    || [],
  cutoff:     localStorage.getItem('tm_cutoff')               || '22:00',
  sound:      localStorage.getItem('tm_sound') !== 'false',
  lang:       localStorage.getItem('tm_lang')                 || 'en',
  activeId:   null,
  interval:   null,
  pickHour:   22,
  pickMin:    0,
};

// ─────────────────────────────────────────────
//  SCREENS
// ─────────────────────────────────────────────
const screens = {
  welcome: document.getElementById('screen-welcome'),
  time:    document.getElementById('screen-time'),
  plan:    document.getElementById('screen-plan'),
};

function goTo(to, fromId) {
  const from = fromId ? document.getElementById(fromId) : null;
  if (from) {
    from.classList.add('slide-out');
    setTimeout(() => { from.classList.add('hidden'); from.classList.remove('slide-out'); }, 550);
  }
  screens[to].classList.remove('hidden');
  // Force reflow before removing 'hidden state' style so transition triggers
  requestAnimationFrame(() => {
    screens[to].style.opacity = '';
    screens[to].style.transform = '';
  });
}

// ─────────────────────────────────────────────
//  SOUND
// ─────────────────────────────────────────────
function playChime(freq = 800, dur = 1.4, vol = 0.07) {
  if (!S.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.35, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch (_) {}
}

// ─────────────────────────────────────────────
//  BACKGROUND — CSS class-based animated gradients
// ─────────────────────────────────────────────
function getBgClass(h) {
  if (h >= 4  && h < 7)  return 'bg-dawn';
  if (h >= 7  && h < 15) return 'bg-day';
  if (h >= 15 && h < 18) return 'bg-afternoon';
  if (h >= 18 && h < 21) return 'bg-sunset';
  return 'bg-night';
}
function applyBg() {
  const h = new Date().getHours();
  const bgEl = document.getElementById('bg-layer');
  bgEl.className = getBgClass(h); // replaces all classes with just the one time-class
  // Night mode: adjust text colors for dark background
  if (h >= 21 || h < 4) {
    document.body.classList.add('night-mode');
  } else {
    document.body.classList.remove('night-mode');
  }
}

// ─────────────────────────────────────────────
//  GREETING
// ─────────────────────────────────────────────
function setGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  document.getElementById('greeting-time').textContent = g;
}

// ─────────────────────────────────────────────
//  TIME PICKER (Screen 2)
// ─────────────────────────────────────────────
function initTimePicker() {
  const [ch, cm] = S.cutoff.split(':').map(Number);
  S.pickHour = ch; S.pickMin = cm;
  syncPickerDisplay();

  document.getElementById('hour-up').onclick   = () => { S.pickHour = (S.pickHour + 1) % 24;  syncPickerDisplay(); };
  document.getElementById('hour-down').onclick  = () => { S.pickHour = (S.pickHour + 23) % 24; syncPickerDisplay(); };
  document.getElementById('min-up').onclick     = () => { S.pickMin = (S.pickMin + 15) % 60;   syncPickerDisplay(); };
  document.getElementById('min-down').onclick   = () => { S.pickMin = (S.pickMin + 45) % 60;   syncPickerDisplay(); };

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.pickHour = parseInt(btn.dataset.hour);
      S.pickMin  = parseInt(btn.dataset.min);
      syncPickerDisplay();
    };
  });
}
function syncPickerDisplay() {
  document.getElementById('hour-display').textContent = String(S.pickHour).padStart(2, '0');
  document.getElementById('min-display').textContent  = String(S.pickMin).padStart(2, '0');
  // Highlight matching preset
  const val = `${S.pickHour}:${String(S.pickMin).padStart(2,'0')}`;
  document.querySelectorAll('.preset-btn').forEach(b => {
    const bval = `${b.dataset.hour}:${String(b.dataset.min).padStart(2,'0')}`;
    b.classList.toggle('active', bval === val);
  });
}

// ─────────────────────────────────────────────
//  PLANNING SCREEN
// ─────────────────────────────────────────────
function updateHero() {
  const now = new Date();
  const [ch, cm] = S.cutoff.split(':').map(Number);
  let cut = new Date();
  cut.setHours(ch, cm, 0, 0);
  if (now >= cut) cut.setDate(cut.getDate() + 1);

  const diffMs   = cut - now;
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  const hLeft    = Math.floor(diffMins / 60);
  const mLeft    = diffMins % 60;

  document.getElementById('hero-time-display').textContent = `${hLeft}h ${mLeft}m`;
  document.getElementById('cutoff-badge-text').textContent = S.cutoff;

  // Smart message (i18n-aware)
  const T = i18n[S.lang];
  const pending = S.tasks.filter(t => t.status !== 'completed');
  let msg = '';
  if (pending.length === 0) {
    msg = T['msg-free'];
  } else {
    const est = pending.reduce((a, t) => a + (t.dur || 30), 0);
    if (est > diffMins) msg = T['msg-tight'];
    else {
      const buf = Math.floor((diffMins - est) / 60);
      msg = buf > 0 ? T['msg-buffer'].replace('{n}', buf) : T['msg-doable'];
    }
  }
  document.getElementById('hero-message').textContent = msg;
  updateTaskCount();
}

function updateTaskCount() {
  const active = S.tasks.filter(t => t.status !== 'completed');
  document.getElementById('task-count').textContent = `${active.length} task${active.length !== 1 ? 's' : ''}`;
}

// ─────────────────────────────────────────────
//  TASKS
// ─────────────────────────────────────────────
function save() {
  localStorage.setItem('tm_tasks', JSON.stringify(S.tasks));
  localStorage.setItem('tm_cutoff', S.cutoff);
  localStorage.setItem('tm_sound', S.sound);
}

function createTask(name, dur, urgent = false) {
  if (!name.trim()) return;
  S.tasks.push({
    id: 'tm_' + Date.now(),
    name: name.trim(),
    dur: dur || 30,
    urgent,
    status: 'pending',  // pending | active | completed
    spent: 0,
    createdAt: Date.now(),
  });
  save(); renderTasks(); updateHero(); playChime(700, 0.8, 0.05);
}

function renderTasks() {
  const list = document.getElementById('timeline-list');
  list.innerHTML = '';

  // Sort: active first, then urgent‑pending, then pending
  const arr = S.tasks.filter(t => t.status !== 'completed');
  arr.sort((a, b) => {
    const scoreA = a.status === 'active' ? 0 : a.urgent ? 1 : 2;
    const scoreB = b.status === 'active' ? 0 : b.urgent ? 1 : 2;
    if (scoreA !== scoreB) return scoreA - scoreB;
    return a.createdAt - b.createdAt; // stable among same priority
  });

  if (arr.length === 0) {
    list.innerHTML = '<div class="empty-state">No activities yet. Add one above ↑</div>';
    return;
  }

  arr.forEach(task => {
    const isActive = task.status === 'active';
    const card = document.createElement('div');
    card.className = `task-row${isActive ? ' active' : ''}${task.urgent ? ' urgent-task' : ''}`;
    card.id = `task-${task.id}`;

    const progressPct = task.dur ? Math.min(100, (task.spent / 60 / task.dur) * 100) : 0;
    const T = i18n[S.lang];

    card.innerHTML = `
      <div class="task-progress-bar" style="width:${progressPct}%"></div>
      <button class="play-btn" onclick="toggleTimer('${task.id}')" title="${isActive ? T['pause'] : T['start']}">
        ${isActive ? pauseSVG() : playSVG()}
      </button>
      <div class="task-body">
        <div class="task-name-text">${esc(task.name)}</div>
        <div class="task-meta-text">
          <span class="timer-num">${fmt(task.spent)}</span>
          ${task.dur ? `<span>· ${task.dur}m</span>` : ''}
          ${task.urgent ? `<span style="color:var(--c-urgent)">· ${T['urgent']}</span>` : ''}
        </div>
      </div>
      <div class="task-right">
        <button class="tiny-btn done-btn" title="${T['complete']}" onclick="completeTask('${task.id}')">&#10003;</button>
        <button class="tiny-btn del-btn"  title="${T['delete']}"   onclick="deleteTask('${task.id}')">&times;</button>
      </div>
    `;
    list.appendChild(card);
  });
}

function toggleTimer(id) {
  const task = S.tasks.find(t => t.id === id);
  if (!task) return;

  if (task.status === 'active') {
    task.status = 'pending';
    clearInterval(S.interval);
    S.interval = null;
    S.activeId = null;
  } else {
    // Pause any currently active task first
    if (S.activeId) {
      const prev = S.tasks.find(t => t.id === S.activeId);
      if (prev) prev.status = 'pending';
      clearInterval(S.interval);
    }
    task.status = 'active';
    S.activeId = id;
    S.interval = setInterval(() => {
      task.spent += 1;
      save();
      renderTasks();
    }, 1000);
  }
  playChime(600, 0.6, 0.06);
  save(); renderTasks();
}

function completeTask(id) {
  const task = S.tasks.find(t => t.id === id);
  if (!task) return;
  if (S.activeId === id) { clearInterval(S.interval); S.interval = null; S.activeId = null; }
  task.status = 'completed';
  task.completedAt = Date.now();
  playChime(900, 1.2, 0.08);
  save(); renderTasks(); updateHero();
}

function deleteTask(id) {
  if (S.activeId === id) { clearInterval(S.interval); S.interval = null; S.activeId = null; }
  S.tasks = S.tasks.filter(t => t.id !== id);
  save(); renderTasks(); updateHero();
}

// ─────────────────────────────────────────────
//  INSIGHTS
// ─────────────────────────────────────────────
function openInsights() {
  document.getElementById('insights-panel').classList.remove('hidden');
  renderInsights();
}
function renderInsights() {
  const done = S.tasks.filter(t => t.status === 'completed');
  const byDay = {};
  done.forEach(t => {
    const d = new Date(t.completedAt);
    const key = d.toISOString().split('T')[0];
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(t);
  });
  const days = Object.keys(byDay).sort((a,b) => b.localeCompare(a));

  const chipsEl = document.getElementById('day-chips');
  chipsEl.innerHTML = '';

  if (!days.length) {
    chipsEl.innerHTML = '<p style="color:var(--c-muted);font-size:0.85rem">No completed tasks yet.</p>';
    document.getElementById('bar-fill').style.height = '0%';
    document.getElementById('bar-stat').textContent = '0h 0m focused';
    return;
  }

  days.forEach((day, i) => {
    const d = new Date(day);
    const name = day === new Date().toISOString().split('T')[0]
      ? 'Today'
      : d.toLocaleDateString('en-US', { weekday: 'short' });
    const chip = document.createElement('div');
    chip.className = `day-chip${i === 0 ? ' selected' : ''}`;
    chip.innerHTML = `<div class="chip-day">${name}</div>`;
    chip.onclick = () => {
      document.querySelectorAll('.day-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      renderBar(byDay[day], name);
    };
    chipsEl.appendChild(chip);
  });

  renderBar(byDay[days[0]], days[0] === new Date().toISOString().split('T')[0] ? 'Today' : 'Latest');
}

function renderBar(tasks, label) {
  document.getElementById('bar-date-label').textContent = label;
  const totalSec = tasks.reduce((a, t) => a + (t.spent || 0), 0);
  const totalMin = Math.floor(totalSec / 60);
  const pct = Math.min(100, (totalMin / 480) * 100); // 8h = 100%
  document.getElementById('bar-fill').style.height = `${Math.max(4, pct)}%`;
  document.getElementById('bar-stat').innerHTML =
    `<strong>${Math.floor(totalMin/60)}h ${totalMin%60}m</strong> deeply focused`;
}

// ─────────────────────────────────────────────
//  i18n — Lightweight EN / ES
// ─────────────────────────────────────────────
const i18n = {
  en: {
    'welcome-sub':    "Let's make the most of your time today.",
    'btn-start':      'Start Planning',
    'step-label':     'Step 1 of 2',
    'screen-title':   'When does your day end?',
    'screen-sub':     "We'll use this to calculate your remaining time.",
    'label-hour':     'Hour',
    'label-min':      'Minute',
    'quick-pick':     'Quick pick',
    'btn-back':       '← Back',
    'btn-continue':   'Continue →',
    'hero-eyebrow':   'YOU HAVE EXACTLY',
    'until-ends':     'until your day ends at',
    'btn-edit':       'Edit',
    'card-label':     'What do you want to do with it?',
    'task-ph':        'E.g. Deep work, Read, Exercise...',
    'urgent-title':   'Mark as Urgent',
    'btn-add':        'Add',
    'quick-add':      'Quick add:',
    'chip-read':      'Reading (30m)',
    'chip-deep':      'Deep Work (1.5h)',
    'chip-exercise':  'Exercise (1h)',
    'chip-admin':     'Admin (45m)',
    'timeline-title': "Today's Timeline",
    'empty-state':    'No activities yet. Add one above ↑',
    'complete':       'Mark as complete',
    'delete':         'Delete',
    'start':          'Start timer',
    'pause':          'Pause timer',
    'urgent':         'urgent',
    'msg-free':       'Your time is entirely yours.',
    'msg-tight':      'Not enough time for everything — prioritize.',
    'msg-buffer':     'You have ~{n}h buffer after all tasks.',
    'msg-doable':     'Pacing looks tight but doable.',
    'productivity':   'Productivity',
    'no-data':        'No completed tasks yet.',
    'focused':        'deeply focused',
  },
  es: {
    'welcome-sub':    'Hagamos el mayor provecho de tu tiempo hoy.',
    'btn-start':      'Comenzar a Planificar',
    'step-label':     'Paso 1 de 2',
    'screen-title':   '¿Cuándo termina tu día?',
    'screen-sub':     'Usaremos esto para calcular tu tiempo restante.',
    'label-hour':     'Hora',
    'label-min':      'Minuto',
    'quick-pick':     'Elección rápida',
    'btn-back':       '← Volver',
    'btn-continue':   'Continuar →',
    'hero-eyebrow':   'TIENES EXACTAMENTE',
    'until-ends':     'hasta que termina tu día a las',
    'btn-edit':       'Editar',
    'card-label':     '¿Qué quieres hacer con él?',
    'task-ph':        'Ej. Trabajo profundo, Leer, Ejercicio...',
    'urgent-title':   'Marcar como urgente',
    'btn-add':        'Agregar',
    'quick-add':      'Agregar rápido:',
    'chip-read':      'Lectura (30m)',
    'chip-deep':      'Trabajo profundo (1.5h)',
    'chip-exercise':  'Ejercicio (1h)',
    'chip-admin':     'Admin (45m)',
    'timeline-title': 'Cronograma de hoy',
    'empty-state':    'Sin actividades. Agrega una arriba ↑',
    'complete':       'Marcar como completada',
    'delete':         'Eliminar',
    'start':          'Iniciar cronómetro',
    'pause':          'Pausar cronómetro',
    'urgent':         'urgente',
    'msg-free':       'Tu tiempo es completamente tuyo.',
    'msg-tight':      'No hay tiempo para todo — prioriza.',
    'msg-buffer':     'Tienes ~{n}h de margen después de todas las tareas.',
    'msg-doable':     'El ritmo está ajustado pero es posible.',
    'productivity':   'Productividad',
    'no-data':        'Sin tareas completadas todavía.',
    'focused':        'de enfoque profundo',
  }
};

function applyLang() {
  const T = i18n[S.lang];
  const next = S.lang === 'en' ? 'ES' : 'EN';
  // Update both lang label buttons
  ['lang-label','lang-label-plan'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = next;
  });
  // Translate all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (T[key]) el.textContent = T[key];
  });
  // Translate placeholders
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (T[key]) el.placeholder = T[key];
  });
  // Translate titles
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (T[key]) el.title = T[key];
  });
  // Translate panel head
  const panelHead = document.querySelector('.panel-head h2');
  if (panelHead) panelHead.textContent = T['productivity'];
  // Re-render tasks to pick up new language strings
  renderTasks();
  updateHero();
}

function toggleLang() {
  S.lang = S.lang === 'en' ? 'es' : 'en';
  localStorage.setItem('tm_lang', S.lang);
  applyLang();
}

// ─────────────────────────────────────────────
//  SOUND TOGGLE
// ─────────────────────────────────────────────
function updateSoundBtn() {
  const btn = document.getElementById('btn-sound');
  if (S.sound) {
    btn.classList.remove('active');
    btn.title = 'Mute sound';
  } else {
    btn.classList.add('active');
    btn.title = 'Unmute sound';
  }
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function fmt(secs) {
  return `${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;
}
function esc(s) {
  return s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c));
}
function playSVG() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
}
function pauseSVG() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
}

// ─────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────
(function init() {
  applyBg(); setGreeting();
  setInterval(applyBg, 60000);
  setInterval(updateHero, 60000);

  // ── Screen 1 listeners
  document.getElementById('btn-start').onclick = () => {
    playChime(700, 0.5, 0.05);
    initTimePicker();
    goTo('time', 'screen-welcome');
  };

  // ── Screen 2 listeners
  document.getElementById('btn-back-time').onclick = () => goTo('welcome', 'screen-time');

  document.getElementById('btn-confirm-time').onclick = () => {
    S.cutoff = `${String(S.pickHour).padStart(2,'0')}:${String(S.pickMin).padStart(2,'0')}`;
    save();
    playChime(750, 0.6, 0.06);
    // Re-activate any tasks that were mid-session before
    const wasActive = S.tasks.find(t => t.status === 'active');
    if (wasActive) wasActive.status = 'pending';
    save();
    updateHero(); renderTasks();
    goTo('plan', 'screen-time');
  };

  // ── Screen 3 listeners
  document.getElementById('btn-back-plan').onclick = () => {
    clearInterval(S.interval); S.interval = null;
    const active = S.tasks.find(t => t.status === 'active');
    if (active) { active.status = 'pending'; save(); }
    goTo('time', 'screen-plan');
  };

  // Sound toggle
  document.getElementById('btn-sound').onclick = () => {
    S.sound = !S.sound;
    save(); updateSoundBtn();
    if (S.sound) playChime();
  };
  updateSoundBtn();

  // Insights
  document.getElementById('btn-insights').onclick   = openInsights;
  document.getElementById('btn-close-insights').onclick = () =>
    document.getElementById('insights-panel').classList.add('hidden');

  // Edit cutoff (inline on planning screen)
  document.getElementById('btn-edit-cutoff').onclick = () => {
    document.getElementById('cutoff-input-modal').value = S.cutoff;
    document.getElementById('cutoff-modal').classList.remove('hidden');
  };
  document.getElementById('btn-cutoff-cancel').onclick = () =>
    document.getElementById('cutoff-modal').classList.add('hidden');
  document.getElementById('btn-cutoff-save').onclick = () => {
    const v = document.getElementById('cutoff-input-modal').value;
    if (v) { S.cutoff = v; save(); updateHero(); }
    document.getElementById('cutoff-modal').classList.add('hidden');
  };

  // Add task
  let isUrgent = false;
  document.getElementById('urgent-toggle').onclick = () => {
    isUrgent = !isUrgent;
    document.getElementById('urgent-toggle').classList.toggle('active', isUrgent);
  };

  function submitTask() {
    const name = document.getElementById('task-name-input').value.trim();
    const dur  = parseInt(document.getElementById('task-dur-input').value) || 30;
    createTask(name, dur, isUrgent);
    document.getElementById('task-name-input').value = '';
    document.getElementById('task-dur-input').value  = '';
    isUrgent = false;
    document.getElementById('urgent-toggle').classList.remove('active');
  }

  document.getElementById('btn-add-task').onclick = submitTask;
  document.getElementById('task-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitTask();
  });

  // Quick-add chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => {
      createTask(chip.dataset.name, parseInt(chip.dataset.dur), chip.dataset.urgent === 'true');
    };
  });

  // Language toggle
  ['btn-lang','btn-lang-plan'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = toggleLang;
  });

  // Apply saved language on boot
  applyLang();

  // If we already have a cutoff from localStorage, go straight to planning
  if (localStorage.getItem('tm_cutoff')) {
    updateHero(); renderTasks();
    // Still start from welcome — don't skip the flow
  }
})();
