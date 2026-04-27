// ─── State ──────────────────────────────────────────
let state = { active: null, journal: [], plans: null, stats: null };

// ─── API ────────────────────────────────────────────
async function api(path, opts) {
  const res = await fetch(`/api/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  return res.json();
}

// ─── Load All Data ──────────────────────────────────
async function loadData() {
  try {
    const data = await api('status');
    state = data;
    render();
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}

// ─── Render ─────────────────────────────────────────
function render() {
  renderStatusBadge();
  renderStats();
  renderFocus();
  renderPlan();
  renderDeferred();
  renderDone();
  renderJournal();
}

function renderStatusBadge() {
  const badge = document.getElementById('statusBadge');
  const text = badge.querySelector('.status-text');
  const s = state.active?.status || '';

  badge.classList.remove('active', 'idle', 'paused');

  if (s.includes('In Progress')) {
    badge.classList.add('active');
    text.textContent = 'Active';
  } else if (s.includes('Paused') || s.includes('🟡') || s.includes('Blocked')) {
    badge.classList.add('paused');
    text.textContent = 'Paused/Blocked';
  } else {
    badge.classList.add('idle');
    text.textContent = 'Idle';
  }
}

function renderStats() {
  const s = state.stats || {};
  document.getElementById('weekHours').textContent = `${s.totalHoursThisWeek || 0}h`;
  document.getElementById('monthHours').textContent = `${s.totalHoursThisMonth || 0}h`;
  document.getElementById('totalSessions').textContent = s.totalSessions || 0;
}

function renderFocus() {
  const el = document.getElementById('focusContent');
  const a = state.active;

  if (!a || !a.task || a.task.includes('none') || a.task === '(file not found)') {
    el.innerHTML = `
      <div class="focus-idle">
        <div class="focus-idle-icon">☕</div>
        <h3>No active task</h3>
        <p>Pick a task from the Master Plan to get started</p>
        <button class="btn btn-accent" onclick="openNewTaskModal()">🚀 Start New Task</button>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="focus-task-name">${escHtml(a.task)}</div>
    <div class="focus-meta">
      ${a.planFile && a.planFile !== '—' ? `<span class="focus-meta-item"><span class="meta-icon">📁</span> ${escHtml(a.planFile)}</span>` : ''}
      ${a.started ? `<span class="focus-meta-item"><span class="meta-icon">🕐</span> Start: ${escHtml(a.started)}</span>` : ''}
      ${a.finished ? `<span class="focus-meta-item"><span class="meta-icon">🏁</span> Finish: ${escHtml(a.finished)}</span>` : ''}
      ${a.agent && a.agent !== '—' ? `<span class="focus-meta-item"><span class="meta-icon">🤖</span> ${escHtml(a.agent)}</span>` : ''}
      <span class="focus-meta-item"><span class="meta-icon">📌</span> ${escHtml(a.status || 'Unknown')}</span>
    </div>
    <div class="focus-sections">
      <div class="focus-section">
        <div class="focus-section-title">What I'm Doing</div>
        <div class="focus-section-body">${escHtml(a.whatDoing || '(nothing noted)')}</div>
      </div>
      <div class="focus-section">
        <div class="focus-section-title">Where I Left Off</div>
        <div class="focus-section-body">${escHtml(a.whereLeftOff || '(nothing noted)')}</div>
      </div>
    </div>`;
}

function renderPlan() {
  const el = document.getElementById('planContent');
  const badge = document.getElementById('planBadge');
  const p = state.plans;

  if (!p) {
    el.innerHTML = '<div class="plan-loading">Loading...</div>';
    return;
  }

  badge.textContent = `${p.completedPlans}/${p.totalPlans} done`;

  const sections = [
    { key: 'p0', label: 'P0', emoji: '🔴' },
    { key: 'p1', label: 'P1', emoji: '🟡' },
    { key: 'p2', label: 'P2', emoji: '🟢' },
    { key: 'p3', label: 'P3', emoji: '⚪' },
    { key: 'fix', label: 'FIX', emoji: '🔧' }
  ];

  let html = '';
  for (const sec of sections) {
    const items = p.priorities[sec.key] || [];
    if (items.length === 0) continue;
    const done = items.filter(i => i.done).length;
    const total = items.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    html += `
      <div class="plan-row">
        <span class="plan-label">${sec.emoji} ${sec.label}</span>
        <div class="plan-bar-track">
          <div class="plan-bar-fill ${sec.key}" style="width: ${pct}%"></div>
        </div>
        <span class="plan-count">${done}/${total}</span>
      </div>`;
  }

  el.innerHTML = html || '<p class="empty-state">No plans found</p>';
}

function renderDeferred() {
  const el = document.getElementById('deferredContent');
  const badge = document.getElementById('deferredBadge');
  const tasks = state.backlog || [];

  badge.textContent = tasks.length;

  if (tasks.length === 0) {
    el.innerHTML = '<p class="empty-state">No deferred tasks. You are all caught up! ✨</p>';
    return;
  }

  el.innerHTML = tasks.map(t => `
    <div class="rabbit-item ${t.done ? 'done' : ''}">
      <span class="rabbit-id">${escHtml(t.id)}</span>
      <span class="rabbit-desc"><strong>${escHtml(t.title)}</strong> - ${escHtml(t.description)}</span>
    </div>
  `).join('');
}

function renderDone() {
  const el = document.getElementById('doneContent');
  const badge = document.getElementById('doneBadge');
  const entries = state.journal || [];
  
  const doneTasks = entries.filter(e => e.result && e.result.includes('Done'));
  badge.textContent = doneTasks.length;

  if (doneTasks.length === 0) {
    el.innerHTML = '<p class="empty-state">No completed tasks found.</p>';
    return;
  }

  // Group by date
  let html = '';
  let currentDate = '';
  
  for (const t of doneTasks) {
    if (t.date !== currentDate) {
      if (currentDate !== '') html += '</div>';
      html += `<div class="done-date-group"><div class="done-date-header">${escHtml(t.date)} (${escHtml(t.day)})</div>`;
      currentDate = t.date;
    }
    html += `
      <div class="done-task-item">
        <span class="done-icon">✅</span>
        <span class="done-title">${escHtml(t.task)}</span>
        <span class="done-meta">${escHtml(t.duration)} • ${escHtml(t.agent)}</span>
      </div>
    `;
  }
  if (currentDate !== '') html += '</div>';
  
  el.innerHTML = html;
}

function renderJournal() {
  const el = document.getElementById('journalContent');
  const entries = state.journal || [];

  if (entries.length === 0) {
    el.innerHTML = '<p class="empty-state" style="padding:24px">No journal entries yet</p>';
    return;
  }

  el.innerHTML = entries.map(e => `
    <div class="journal-entry">
      <span class="journal-date">${escHtml(e.date)}</span>
      <span class="journal-task">${escHtml(e.task)}</span>
      <span class="journal-duration">${escHtml(e.duration)}</span>
      <span class="journal-result">${escHtml(e.result)}</span>
    </div>
  `).join('');
}

// ─── Actions ────────────────────────────────────────

function openNewTaskModal() {
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('newTaskName').focus();
}

function closeNewTaskModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('newTaskName').value = '';
  document.getElementById('newTaskPlan').value = '';
}

function openEndSessionModal() {
  document.getElementById('endSessionOverlay').classList.add('open');
  document.getElementById('endItems').focus();
}

function closeEndSessionModal() {
  document.getElementById('endSessionOverlay').classList.remove('open');
}

async function startNewTask() {
  const task = document.getElementById('newTaskName').value.trim();
  const plan = document.getElementById('newTaskPlan').value.trim();
  const agent = document.getElementById('newTaskAgent').value;
  if (!task) return;

  await api('active/set-task', {
    method: 'POST',
    body: JSON.stringify({ task, planFile: plan, agent })
  });

  closeNewTaskModal();
  await loadData();
}

async function addDeferred() {
  const input = document.getElementById('deferredInput');
  const desc = input.value.trim();
  if (!desc) return;

  await api('tasks/deferred', {
    method: 'POST',
    body: JSON.stringify({ description: desc, title: desc.split(' ').slice(0, 5).join(' ') + '...' })
  });

  input.value = '';
  await loadData();
}

async function markDone() {
  openEndSessionModal();
}

async function pauseTask() {
  await api('active/update-status', {
    method: 'POST',
    body: JSON.stringify({ status: '⏸ Paused' })
  });
  await loadData();
}

async function confirmEndSession() {
  const items = document.getElementById('endItems').value.split('\n').filter(l => l.trim());
  const result = document.getElementById('endResult').value;
  const duration = document.getElementById('endDuration').value.trim() || '?h';
  const commit = document.getElementById('endCommit').value.trim();
  const next = document.getElementById('endNext').value.trim();

  const a = state.active || {};

  // Append journal entry
  await api('journal/append', {
    method: 'POST',
    body: JSON.stringify({
      task: a.task || 'Unknown task',
      agent: a.agent || '—',
      items,
      result,
      duration,
      commit: commit || undefined,
      next
    })
  });

  // Clear active task
  await api('active/set-task', {
    method: 'POST',
    body: JSON.stringify({ task: '(none — pick your next task)', planFile: '—', agent: '—' })
  });

  // Reset status
  await api('active/update-status', {
    method: 'POST',
    body: JSON.stringify({ status: '⚪ Idle' })
  });

  closeEndSessionModal();
  await loadData();
}

// ─── Utilities ──────────────────────────────────────
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

const providerIcons = { OpenAI: '🟢', Google: '🔵', Anthropic: '🟠', OpenCode: '🟣', Other: '⚪' };

// ─── Services Health ────────────────────────────────
async function loadHealth() {
  try {
    const data = await api('health');
    renderServices(data);
  } catch { /* silent */ }
}

function renderServices(services) {
  const el = document.getElementById('servicesContent');
  if (!services || services.length === 0) {
    el.innerHTML = '<p class="empty-state">No services configured</p>';
    return;
  }
  el.innerHTML = services.map(s => `
    <div class="svc-item">
      <span class="svc-dot ${s.status}"></span>
      <span class="svc-name">${escHtml(s.name)}</span>
      <span class="svc-port">:${s.port}</span>
    </div>
  `).join('');
}

// ─── Subscriptions ──────────────────────────────────
async function loadSubscriptions() {
  try {
    const data = await api('subscriptions');
    renderSubscriptions(data);
  } catch { /* silent */ }
}

function renderSubscriptions(subs) {
  const el = document.getElementById('subsContent');
  if (!subs || subs.length === 0) {
    el.innerHTML = '<p class="empty-state">No subscriptions tracked yet</p>';
    return;
  }
  el.innerHTML = subs.map(s => `
    <div class="sub-item">
      <div class="sub-icon ${escHtml(s.provider)}">${providerIcons[s.provider] || '⚪'}</div>
      <div class="sub-info">
        <div class="sub-name">${escHtml(s.name)}</div>
        <div class="sub-detail">${escHtml(s.model)}${s.notes ? ' · ' + escHtml(s.notes) : ''}</div>
      </div>
      <button class="sub-delete" onclick="deleteSub('${s.id}')" title="Remove">✕</button>
    </div>
  `).join('');
}

function openSubModal() {
  document.getElementById('subModalOverlay').classList.add('open');
  document.getElementById('subName').focus();
}

function closeSubModal() {
  document.getElementById('subModalOverlay').classList.remove('open');
  document.getElementById('subName').value = '';
  document.getElementById('subModel').value = '';
  document.getElementById('subKeyHint').value = '';
  document.getElementById('subNotes').value = '';
}

async function confirmAddSub() {
  const name = document.getElementById('subName').value.trim();
  const provider = document.getElementById('subProvider').value;
  const model = document.getElementById('subModel').value.trim();
  const apiKeyHint = document.getElementById('subKeyHint').value.trim();
  const notes = document.getElementById('subNotes').value.trim();
  if (!name) return;

  await api('subscriptions', {
    method: 'POST',
    body: JSON.stringify({ name, provider, model, apiKeyHint, notes })
  });

  closeSubModal();
  await loadSubscriptions();
}

async function deleteSub(id) {
  await api(`subscriptions/${id}`, { method: 'DELETE' });
  await loadSubscriptions();
}

// ─── Event Listeners ────────────────────────────────
document.getElementById('btnMarkDone').addEventListener('click', markDone);
document.getElementById('btnPause').addEventListener('click', pauseTask);
document.getElementById('btnAddDeferred').addEventListener('click', addDeferred);
document.getElementById('btnCloseModal').addEventListener('click', closeNewTaskModal);
document.getElementById('btnCancelModal').addEventListener('click', closeNewTaskModal);
document.getElementById('btnConfirmTask').addEventListener('click', startNewTask);
document.getElementById('btnCloseEndSession').addEventListener('click', closeEndSessionModal);
document.getElementById('btnCancelEndSession').addEventListener('click', closeEndSessionModal);
document.getElementById('btnConfirmEndSession').addEventListener('click', confirmEndSession);
document.getElementById('btnRefreshHealth').addEventListener('click', loadHealth);
document.getElementById('btnAddSub').addEventListener('click', openSubModal);
document.getElementById('btnCloseSubModal').addEventListener('click', closeSubModal);
document.getElementById('btnCancelSubModal').addEventListener('click', closeSubModal);
document.getElementById('btnConfirmSub').addEventListener('click', confirmAddSub);

// Enter key for deferred input
document.getElementById('deferredInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addDeferred();
});

// Close modals on overlay click
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeNewTaskModal();
});
document.getElementById('endSessionOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeEndSessionModal();
});
document.getElementById('subModalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeSubModal();
});

// ─── Init ───────────────────────────────────────────
loadData();
loadHealth();
loadSubscriptions();

// Auto-refresh every 10 seconds
setInterval(loadData, 10000);
// Check health every 30 seconds
setInterval(loadHealth, 30000);
