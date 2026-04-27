const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5555;

// Project root — one level up from command-center/
const PROJECT_ROOT = path.resolve(__dirname, '..');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helpers ────────────────────────────────────────────

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function parseBacklog() {
  const raw = readFileSafe(path.join(PROJECT_ROOT, 'BACKLOG.md'));
  if (!raw) return [];

  const tasks = [];
  const lines = raw.split('\n');
  let currentTask = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match "- [ ] **#T1: Title**" or "- [x] **#T1: Title**"
    const match = line.match(/^- \[([ x])\] \*\*(#T\d+):\s*(.+)\*\*/);
    if (match) {
      if (currentTask) tasks.push(currentTask);
      currentTask = {
        id: match[2],
        title: match[3],
        done: match[1] === 'x',
        description: ''
      };
    } else if (currentTask && line.trim() && !line.startsWith('##')) {
      // Append following lines to description until next task or header
      currentTask.description += line.trim() + ' ';
    }
  }
  if (currentTask) tasks.push(currentTask);
  
  return tasks.map(t => ({ ...t, description: t.description.trim() }));
}

function parseActive() {
  const raw = readFileSafe(path.join(PROJECT_ROOT, 'ACTIVE.md'));
  if (!raw) return { task: '(file not found)', status: '⚪', raw: '' };

  const get = (label) => {
    const m = raw.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
    return m ? m[1].trim() : '';
  };

  const getSection = (heading) => {
    const re = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
    const m = raw.match(re);
    return m ? m[1].trim() : '';
  };

  // Parse rabbit holes
  const rhSection = getSection('Rabbit Holes Found.*');
  const rabbitHoles = [];
  const rhRe = /- \[([ x])\] (#RH-\d+): (.+)/g;
  let rhMatch;
  while ((rhMatch = rhRe.exec(rhSection)) !== null) {
    rabbitHoles.push({
      done: rhMatch[1] === 'x',
      id: rhMatch[2],
      description: rhMatch[3].trim()
    });
  }

  return {
    task: get('Task'),
    planFile: get('Plan File'),
    started: get('Started'),
    finished: get('Finished'),
    agent: get('Agent/IDE'),
    status: get('Status'),
    whatDoing: getSection("What I'm Doing"),
    whereLeftOff: getSection('Where I Left Off'),
    rabbitHoles,
    blockers: getSection('Blockers'),
    raw
  };
}

function parseJournal() {
  const raw = readFileSafe(path.join(PROJECT_ROOT, 'JOURNAL.md'));
  if (!raw) return [];

  const entries = [];
  const blocks = raw.split(/\n---\n/).filter(b => b.includes('## 20'));

  for (const block of blocks) {
    const headerMatch = block.match(/## (\d{4}-\d{2}-\d{2})\s*\((\w+)\)\s*(?:—\s*(.+))?/);
    if (!headerMatch) continue;

    const get = (label) => {
      const m = block.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
      return m ? m[1].trim() : '';
    };

    const getList = (label) => {
      const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*|$)`);
      const m = block.match(re);
      if (!m) return [];
      return m[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '').trim());
    };

    entries.push({
      date: headerMatch[1],
      day: headerMatch[2],
      duration: headerMatch[3] || '',
      task: get('Task'),
      agent: get('Agent') || get('Agent/IDE'),
      started: get('Started'),
      finished: get('Finished'),
      items: getList('What I Did'),
      result: get('Result'),
      commit: get('Commit'),
      next: get('Next')
    });
  }
  return entries;
}

function parsePlans() {
  const masterPlan = readFileSafe(path.join(PROJECT_ROOT, '1-TODO', '00-MASTER-PLAN.md'));
  const todoDir = path.join(PROJECT_ROOT, '1-TODO');
  const doneDir = path.join(PROJECT_ROOT, '1-TODO', 'done');

  // Get all plan files
  let planFiles = [];
  try {
    planFiles = fs.readdirSync(todoDir)
      .filter(f => f.endsWith('.md') && f !== '00-MASTER-PLAN.md' && /^\d{2}-/.test(f));
  } catch { /* empty */ }

  // Get all completion reports
  let doneFiles = [];
  try {
    doneFiles = fs.readdirSync(doneDir)
      .filter(f => f.endsWith('.md'));
  } catch { /* empty */ }

  // Parse master plan tables for priority info
  const priorities = { p0: [], p1: [], p2: [], p3: [], fix: [] };

  if (masterPlan) {
    // Find table rows with plan numbers
    const rows = masterPlan.match(/\|\s*(\d{2})\s*\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|/g) || [];
    
    // Determine which section each row belongs to by tracking headers
    let currentPriority = 'p0';
    const lines = masterPlan.split('\n');
    
    for (const line of lines) {
      if (line.includes('P0') || line.includes('Critical')) currentPriority = 'p0';
      else if (line.includes('P1') || line.includes('High Priority')) currentPriority = 'p1';
      else if (line.includes('P2') || line.includes('Medium Priority')) currentPriority = 'p2';
      else if (line.includes('P3') || line.includes('Lower Priority')) currentPriority = 'p3';
      else if (line.includes('TODO Migration') || line.includes('Security')) currentPriority = 'fix';
      
      const rowMatch = line.match(/\|\s*(\d{2})\s*\|([^|]+)\|/);
      if (rowMatch) {
        const num = rowMatch[1];
        const name = rowMatch[2].trim().replace(/\[([^\]]+)\].*/, '$1');
        const isDone = doneFiles.some(f => f.startsWith(num));
        const hasDoneMarker = line.includes('✅ Done');
        priorities[currentPriority].push({
          num,
          name,
          done: isDone || hasDoneMarker,
          planFile: `${num}-*.md`
        });
      }
    }
  }

  // Calculate overall stats
  const allPlans = Object.values(priorities).flat();
  const totalPlans = allPlans.length;
  const completedPlans = allPlans.filter(p => p.done).length;

  return {
    priorities,
    totalPlans,
    completedPlans,
    doneFiles
  };
}

// ─── API Routes ─────────────────────────────────────────

app.get('/api/active', (req, res) => {
  res.json(parseActive());
});

app.get('/api/journal', (req, res) => {
  res.json(parseJournal());
});

app.get('/api/plans', (req, res) => {
  res.json(parsePlans());
});

app.get('/api/status', (req, res) => {
  const active = parseActive();
  const journal = parseJournal();
  const plans = parsePlans();
  const backlog = parseBacklog();

  // Calculate time stats from journal
  let totalHoursThisWeek = 0;
  let totalHoursThisMonth = 0;
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  for (const entry of journal) {
    const d = new Date(entry.date);
    const hoursMatch = entry.duration.match(/(\d+(?:\.\d+)?)h/);
    const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 0;
    if (d >= weekAgo) totalHoursThisWeek += hours;
    if (d >= monthAgo) totalHoursThisMonth += hours;
  }

  res.json({
    active,
    journal,
    plans,
    backlog,
    stats: {
      totalSessions: journal.length,
      totalHoursThisWeek,
      totalHoursThisMonth
    }
  });
});

// ─── Update endpoints ───────────────────────────────────

app.post('/api/tasks/deferred', (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const filePath = path.join(PROJECT_ROOT, 'BACKLOG.md');
  let content = readFileSafe(filePath);
  
  if (!content) {
    content = `# 📋 Task Backlog\n\n> This file contains all deferred tasks, rabbit holes, and ideas for later.\n> Tasks are numbered so you can prompt agents (e.g., "Work on Task #T1").\n\n## Pending Tasks\n\n`;
  }

  // Find highest ID
  const nums = [...content.matchAll(/#T(\d+)/g)].map(m => parseInt(m[1]));
  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const id = `#T${nextNum}`;

  const entry = `- [ ] **${id}: ${title}**\n  ${description || 'No description provided.'}\n\n`;
  
  content += entry;
  fs.writeFileSync(filePath, content, 'utf-8');
  
  res.json({ ok: true, id });
});

app.post('/api/active/rabbit-hole', (req, res) => {
  // Redirect old rabbit-hole endpoint to the new deferred task endpoint for backward compatibility
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'description required' });

  const title = description.split(' ').slice(0, 5).join(' ') + '...';
  
  // Forward to new logic
  req.body = { title, description };
  return app._router.handle(req, res, () => {});
});

app.post('/api/active/update-status', (req, res) => {
  const { status, whereLeftOff } = req.body;
  const filePath = path.join(PROJECT_ROOT, 'ACTIVE.md');
  let content = readFileSafe(filePath);
  if (!content) return res.status(500).json({ error: 'ACTIVE.md not found' });

  if (status) {
    content = content.replace(/\*\*Status:\*\*\s*.+/, `**Status:** ${status}`);
  }
  if (whereLeftOff) {
    content = content.replace(
      /## Where I Left Off\s*\n[\s\S]*?(?=\n## )/,
      `## Where I Left Off\n${whereLeftOff}\n\n`
    );
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  res.json({ ok: true });
});

app.post('/api/active/set-task', (req, res) => {
  const { task, planFile, agent } = req.body;
  if (!task) return res.status(400).json({ error: 'task required' });

  const filePath = path.join(PROJECT_ROOT, 'ACTIVE.md');
  
  // Format current date and time
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const started = `${dateStr} ${timeStr}`;
  
  const content = `# 🎯 Current Focus

**Task:** ${task}
**Plan File:** ${planFile || '—'}
**Started:** ${started}
**Agent/IDE:** ${agent || '—'}
**Status:** 🔶 In Progress

## What I'm Doing
(describe the current task here)

## Where I Left Off
(just started)

## Detours (blocking fixes made during this task)

## Rabbit Holes Found (DO NOT START — just log here)
- (Moved to BACKLOG.md)

## Blockers
- None
`;

  fs.writeFileSync(filePath, content, 'utf-8');
  res.json({ ok: true });
});

app.post('/api/journal/append', (req, res) => {
  const { task, agent, items, result, commit, next, duration } = req.body;
  if (!task) return res.status(400).json({ error: 'task required' });

  const filePath = path.join(PROJECT_ROOT, 'JOURNAL.md');
  let content = readFileSafe(filePath);
  if (!content) return res.status(500).json({ error: 'JOURNAL.md not found' });

  const today = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dateStr = today.toISOString().split('T')[0];
  const dayStr = days[today.getDay()];
  const timeStr = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  
  // Parse started from ACTIVE.md if available
  const activeData = parseActive();
  const started = activeData.started || `${dateStr} ??:?? AM`;
  
  const dur = duration || '?h';
  const itemLines = (items || []).map(i => `- ${i}`).join('\n');

  const entry = `
## ${dateStr} (${dayStr}) — ${dur}
**Task:** ${task}
**Agent:** ${agent || '—'}
**Started:** ${started}
**Finished:** ${dateStr} ${timeStr}
**What I Did:**
${itemLines || '- (no details)'}
**Result:** ${result || '🔶 Partial'}
${commit ? `**Commit:** ${commit}` : ''}
**Next:** ${next || '(TBD)'}

---
`;

  // Insert after the first ---
  const firstSepIdx = content.indexOf('---');
  if (firstSepIdx !== -1) {
    const secondSepIdx = content.indexOf('---', firstSepIdx + 3);
    const insertPoint = secondSepIdx !== -1 ? secondSepIdx + 3 : firstSepIdx + 3;
    content = content.slice(0, insertPoint) + '\n' + entry + content.slice(insertPoint);
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  res.json({ ok: true });
});

// ─── Subscriptions / Services ───────────────────────────

const SUBS_FILE = path.join(__dirname, 'subscriptions.json');

function loadSubscriptions() {
  const raw = readFileSafe(SUBS_FILE);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function saveSubscriptions(subs) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf-8');
}

app.get('/api/subscriptions', (req, res) => {
  res.json(loadSubscriptions());
});

app.post('/api/subscriptions', (req, res) => {
  const { name, provider, model, apiKeyHint, notes, status } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const subs = loadSubscriptions();
  const id = Date.now().toString(36);
  subs.push({ id, name, provider: provider || '', model: model || '', apiKeyHint: apiKeyHint || '', notes: notes || '', status: status || 'active', createdAt: new Date().toISOString() });
  saveSubscriptions(subs);
  res.json({ ok: true, id });
});

app.delete('/api/subscriptions/:id', (req, res) => {
  let subs = loadSubscriptions();
  subs = subs.filter(s => s.id !== req.params.id);
  saveSubscriptions(subs);
  res.json({ ok: true });
});

// ─── Server Health ──────────────────────────────────────

app.get('/api/health', async (req, res) => {
  const checks = [
    { name: 'Dashboard', port: 5555, url: 'http://localhost:5555' },
    { name: 'Frontend (Vite)', port: 5173, url: 'http://localhost:5173' },
    { name: 'Backend (Functions)', port: 5001, url: 'http://localhost:5001' },
    { name: 'Emulator UI', port: 4000, url: 'http://localhost:4000' },
    { name: 'Firestore', port: 8080, url: 'http://localhost:8080' },
    { name: 'Auth Emulator', port: 9099, url: 'http://localhost:9099' },
  ];

  const results = await Promise.all(checks.map(async (svc) => {
    try {
      const http = require('http');
      return await new Promise((resolve) => {
        const req = http.get(svc.url, { timeout: 1500 }, (r) => {
          resolve({ ...svc, status: 'running', code: r.statusCode });
        });
        req.on('error', () => resolve({ ...svc, status: 'stopped' }));
        req.on('timeout', () => { req.destroy(); resolve({ ...svc, status: 'stopped' }); });
      });
    } catch {
      return { ...svc, status: 'stopped' };
    }
  }));

  res.json(results);
});

// ─── Start ──────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  ┌──────────────────────────────────────────┐`);
  console.log(`  │                                          │`);
  console.log(`  │   ERP03 Command Center                   │`);
  console.log(`  │   http://localhost:${PORT}                  │`);
  console.log(`  │                                          │`);
  console.log(`  │   Project: ${PROJECT_ROOT}`);
  console.log(`  │                                          │`);
  console.log(`  └──────────────────────────────────────────┘\n`);
});


