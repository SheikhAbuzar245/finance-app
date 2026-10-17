'use strict';

// ---------- Storage ----------

const STORAGE_KEY = 'pkr-budget-data-v1';
const THEME_KEY = 'pkr-budget-theme';

const DEFAULT_DATA = {
  transactions: [],
  categories: {
    expense: [
      'Groceries', 'Rent', 'Electricity', 'Gas', 'Water', 'Mobile & Internet',
      'Fuel & Transport', 'Dining Out', 'Health', 'Education', 'Shopping',
      'Family Support', 'Zakat & Charity', 'Committee (BC)', 'Entertainment', 'Other',
    ],
    income: ['Salary', 'Freelance', 'Business', 'Gift', 'Profit / Interest', 'Other'],
  },
  accounts: ['Cash', 'Bank', 'JazzCash', 'Easypaisa'],
  budgets: {},
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_DATA);
    return normalize(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function normalize(d) {
  const base = structuredClone(DEFAULT_DATA);
  if (!d || typeof d !== 'object') return base;
  return {
    transactions: Array.isArray(d.transactions) ? d.transactions.filter(isValidTx) : [],
    categories: {
      expense: Array.isArray(d.categories?.expense) ? d.categories.expense : base.categories.expense,
      income: Array.isArray(d.categories?.income) ? d.categories.income : base.categories.income,
    },
    accounts: Array.isArray(d.accounts) && d.accounts.length ? d.accounts : base.accounts,
    budgets: d.budgets && typeof d.budgets === 'object' ? d.budgets : {},
  };
}

function isValidTx(t) {
  return t && typeof t.id === 'string'
    && ['income', 'expense', 'transfer'].includes(t.type)
    && Number.isFinite(t.amount) && t.amount > 0
    && /^\d{4}-\d{2}-\d{2}$/.test(t.date);
}

let data = loadData();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    toast('Could not save. Browser storage may be full or disabled.', '⚠️');
  }
}

// ---------- Helpers ----------

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const pkr = new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 });
const fmt = (n) => pkr.format(n);

// Spoken-style amounts using lakh / crore, e.g. 150000 -> "1.5 lakh".
function inWords(n) {
  const trim = (v) => String(Math.round(v * 100) / 100);
  if (n >= 1e7) return `${trim(n / 1e7)} crore`;
  if (n >= 1e5) return `${trim(n / 1e5)} lakh`;
  if (n >= 1e3) return `${trim(n / 1e3)} thousand`;
  return '';
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayISO = () => isoDate(new Date());

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  return isoDate(new Date(y, m - 1 + delta, 1)).slice(0, 7);
}

function monthName(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
}

function dayLabel(iso) {
  const today = todayISO();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === today) return 'Today';
  if (iso === isoDate(y)) return 'Yesterday';
  const [yy, mm, dd] = iso.split('-').map(Number);
  return new Date(yy, mm - 1, dd).toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'short' });
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('data-') || k.startsWith('aria-')) node.setAttribute(k, v);
    else node[k] = v;
  }
  for (const c of [].concat(children)) if (c != null) node.append(c);
  return node;
}

function svg(markup, cls) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg class="${cls}" viewBox="0 0 36 36">${markup}</svg>`;
  return wrap.firstChild;
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

function sortByDateDesc(list) {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}

// ---------- Icons & colours ----------

const CATEGORY_ICONS = {
  Groceries: '🛒', Rent: '🏠', Electricity: '💡', Gas: '🔥', Water: '🚰', 'Mobile & Internet': '📱',
  'Fuel & Transport': '⛽', 'Dining Out': '🍽️', Health: '💊', Education: '🎓', Shopping: '🛍️',
  'Family Support': '👨‍👩‍👧', 'Zakat & Charity': '🤲', 'Committee (BC)': '🤝', Entertainment: '🎬', Other: '📦',
  Salary: '💼', Freelance: '💻', Business: '🏪', Gift: '🎁', 'Profit / Interest': '📈',
};

const PALETTE = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#f43f5e', '#14b8a6', '#6366f1', '#f97316', '#ec4899', '#84cc16', '#06b6d4', '#d946ef'];

function colorFor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const categoryIcon = (name) => CATEGORY_ICONS[name] || '🏷️';

function accountIcon(name) {
  const n = name.toLowerCase();
  if (/jazz|easy|pay|upaisa|wallet/.test(n)) return '📲';
  if (n.includes('cash')) return '💵';
  if (n.includes('bank') || n.includes('hbl') || n.includes('ubl') || n.includes('meezan')) return '🏦';
  if (n.includes('card')) return '💳';
  return '💳';
}

function avatar(icon, color, extra = '') {
  return el('div', {
    class: `avatar ${extra}`,
    style: `background: color-mix(in srgb, ${color} 16%, transparent)`,
    textContent: icon,
  });
}

// ---------- Theme ----------

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
}

function applyTheme() {
  const t = getTheme();
  const dark = t === 'dark' || (t === 'system' && darkQuery.matches);
  document.documentElement.classList.toggle('dark', dark);
  $('meta[name=theme-color]').content = dark ? '#020617' : '#f8fafc';
  const radio = $(`input[name=theme][value=${t}]`);
  if (radio) radio.checked = true;
}

function setTheme(t) {
  try { localStorage.setItem(THEME_KEY, t); } catch { /* still applies for this visit */ }
  applyTheme();
}

darkQuery.addEventListener('change', applyTheme);

// ---------- Animation helpers ----------

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function countUp(node, to) {
  const from = node._value ?? 0;
  node._value = to;
  if (reduceMotion.matches || from === to) { node.textContent = fmt(to); return; }
  const start = performance.now();
  const dur = 700;
  cancelAnimationFrame(node._raf);
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = fmt(from + (to - from) * eased);
    if (p < 1) node._raf = requestAnimationFrame(step);
  };
  node._raf = requestAnimationFrame(step);
}

// Bars and rings are rendered at zero, then grown to their real size so the CSS transition plays.
function growAfterPaint(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll('[data-w]').forEach((n) => { n.style.width = n.dataset.w; });
    root.querySelectorAll('[data-dash]').forEach((n) => n.setAttribute('stroke-dasharray', n.dataset.dash));
  }));
}

function stagger(nodes) {
  nodes.forEach((n, i) => n.style.setProperty('--i', Math.min(i, 12)));
  return nodes;
}

// ---------- Toast & confirm ----------

function toast(message, icon = '✅') {
  const t = el('div', {
    class: 'animate-toast-in pointer-events-auto flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl transition duration-300 dark:bg-white dark:text-slate-900',
  }, [el('span', { textContent: icon }), el('span', { textContent: message })]);
  $('#toastHost').append(t);
  setTimeout(() => {
    t.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => t.remove(), 300);
  }, 2400);
}

function confirmBox(message, { ok = 'Delete', icon = '⚠️' } = {}) {
  const d = $('#confirmDialog');
  $('#confirmText').textContent = message;
  $('#confirmOk').textContent = ok;
  $('#confirmIcon').textContent = icon;
  d.returnValue = '';
  d.showModal();
  return new Promise((resolve) => {
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
  });
}

function closeSheet(d) {
  if (!d.open || d.classList.contains('closing')) return;
  d.classList.add('closing');
  d.addEventListener('animationend', () => {
    d.classList.remove('closing');
    d.close();
  }, { once: true });
}

// ---------- State ----------

let currentMonth = todayISO().slice(0, 7);
let currentView = 'dashboard';
let editingId = null;

const txInMonth = () => data.transactions.filter((t) => t.date.startsWith(currentMonth));

function totals(list) {
  let income = 0, expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

function spentByCategory(list) {
  const out = {};
  for (const t of list) if (t.type === 'expense') out[t.category] = (out[t.category] || 0) + t.amount;
  return out;
}

function accountBalances() {
  const bal = Object.fromEntries(data.accounts.map((a) => [a, 0]));
  for (const t of data.transactions) {
    if (t.type === 'income') bal[t.account] = (bal[t.account] || 0) + t.amount;
    else if (t.type === 'expense') bal[t.account] = (bal[t.account] || 0) - t.amount;
    else {
      bal[t.account] = (bal[t.account] || 0) - t.amount;
      bal[t.toAccount] = (bal[t.toAccount] || 0) + t.amount;
    }
  }
  return bal;
}

// ---------- Rendering ----------

function render() {
  $('#monthInput').value = currentMonth;
  $('#monthLabel').textContent = monthName(currentMonth);
  $('#monthHint').textContent = currentMonth === todayISO().slice(0, 7) ? 'This month' : 'Tap to pick a month';
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'transactions') renderTransactions();
  if (currentView === 'budgets') renderBudgets();
  if (currentView === 'settings') renderSettings();
}

function emptyState(icon, title, text) {
  return el('div', { class: 'animate-fade-up py-6 text-center' }, [
    el('div', { class: 'mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-slate-100 text-2xl dark:bg-slate-800', textContent: icon }),
    el('p', { class: 'font-semibold text-slate-700 dark:text-slate-200', textContent: title }),
    el('p', { class: 'muted mt-1', textContent: text }),
  ]);
}

function bar(pct, color) {
  return el('div', { class: 'bar-track' },
    el('div', { class: 'bar-fill', style: `background:${color}`, 'data-w': `${Math.min(100, pct)}%` }));
}

function budgetColor(spent, limit) {
  if (spent > limit) return '#f43f5e';
  if (spent >= limit * 0.8) return '#f59e0b';
  return '#10b981';
}

function ring(pct, color, label, sub) {
  const r = svg(`
    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" stroke-width="3.2" class="text-slate-100 dark:text-slate-800"/>
    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round"
      stroke-dasharray="0 100" data-dash="${Math.min(100, pct)} 100" transform="rotate(-90 18 18)"
      class="transition-[stroke-dasharray] duration-1000 ease-out"/>`, 'size-full');
  return el('div', { class: 'relative size-28 shrink-0' }, [
    r,
    el('div', { class: 'absolute inset-0 grid place-content-center text-center' }, [
      el('span', { class: 'text-xl font-extrabold tabular-nums', textContent: label }),
      el('span', { class: 'text-[10px] font-semibold tracking-wide text-slate-400 uppercase', textContent: sub }),
    ]),
  ]);
}

function renderDashboard() {
  const list = txInMonth();
  const { income, expense, net } = totals(list);
  const balances = accountBalances();
  const total = Object.values(balances).reduce((s, v) => s + v, 0);

  countUp($('#statBalance'), total);
  countUp($('#statIncome'), income);
  countUp($('#statExpense'), expense);

  const netLine = $('#statNetLine');
  if (!income && !expense) netLine.textContent = '✨ No activity this month yet';
  else if (net >= 0) {
    const rate = income ? Math.round((net / income) * 100) : 0;
    netLine.textContent = `🌱 Saved ${fmt(net)}${income ? ` · ${rate}% of income` : ''}`;
  } else netLine.textContent = `⚠️ Spent ${fmt(-net)} more than earned`;

  // Overall budget ring
  const totalBudget = Object.values(data.budgets).reduce((s, v) => s + (Number(v) || 0), 0);
  const overall = $('#budgetOverall');
  overall.replaceChildren();
  if (totalBudget > 0) {
    const pct = (expense / totalBudget) * 100;
    const left = totalBudget - expense;
    const lines = [
      el('p', { class: 'muted', textContent: 'Spent' }),
      el('p', { class: 'font-bold tabular-nums', textContent: `${fmt(expense)} of ${fmt(totalBudget)}` }),
      el('p', {
        class: `mt-2 text-sm font-semibold ${left >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`,
        textContent: left >= 0 ? `${fmt(left)} left` : `Over by ${fmt(-left)}`,
      }),
    ];
    // For the current month, suggest a daily spending allowance.
    if (left > 0 && currentMonth === todayISO().slice(0, 7)) {
      const now = new Date();
      const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
      lines.push(el('p', { class: 'muted mt-0.5 text-xs', textContent: `≈ ${fmt(left / daysLeft)} a day for ${daysLeft} day${daysLeft > 1 ? 's' : ''}` }));
    }
    overall.append(el('div', { class: 'flex items-center gap-5' }, [
      ring(pct, budgetColor(expense, totalBudget), `${Math.round(pct)}%`, 'used'),
      el('div', {}, lines),
    ]));
  } else {
    overall.append(emptyState('🎯', 'No budget yet', 'Set limits in the Budgets tab to track your spending.'));
  }

  // Accounts
  $('#accountList').replaceChildren(...stagger(Object.entries(balances).map(([name, v]) =>
    el('div', { class: 'animate-fade-up flex items-center gap-3' }, [
      avatar(accountIcon(name), colorFor(name), 'size-10 text-lg'),
      el('span', { class: 'flex-1 font-medium', textContent: name }),
      el('span', { class: `font-bold tabular-nums ${v < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`, textContent: fmt(v) }),
    ]))));

  // Category breakdown: donut + legend
  const box = $('#categoryBreakdown');
  const entries = Object.entries(spentByCategory(list)).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    box.replaceChildren(emptyState('🧾', 'No expenses yet', 'Tap + to add your first expense for this month.'));
  } else {
    let offset = 0;
    const arcs = entries.map(([cat, amt]) => {
      const pct = (amt / expense) * 100;
      const gap = entries.length > 1 ? 0.8 : 0;
      const arc = `<circle cx="18" cy="18" r="15.9155" fill="none" stroke="${colorFor(cat)}" stroke-width="4"
        stroke-dasharray="0 100" data-dash="${Math.max(0.01, pct - gap)} ${100 - pct + gap}" stroke-dashoffset="${-offset}"
        transform="rotate(-90 18 18)" class="transition-[stroke-dasharray] duration-1000 ease-out"/>`;
      offset += pct;
      return arc;
    }).join('');
    const donut = el('div', { class: 'relative mx-auto size-44 shrink-0' }, [
      svg(arcs, 'size-full'),
      el('div', { class: 'absolute inset-0 grid place-content-center text-center' }, [
        el('span', { class: 'text-[10px] font-semibold tracking-wide text-slate-400 uppercase', textContent: 'Spent' }),
        el('span', { class: 'text-lg font-extrabold tabular-nums', textContent: fmt(expense) }),
      ]),
    ]);
    const legend = el('div', { class: 'stagger flex-1 space-y-3.5' }, stagger(entries.map(([cat, amt]) => {
      const limit = Number(data.budgets[cat]) || 0;
      const pctOfTotal = Math.round((amt / expense) * 100);
      return el('div', {}, [
        el('div', { class: 'mb-1.5 flex items-center gap-2.5' }, [
          avatar(categoryIcon(cat), colorFor(cat), 'size-8 rounded-xl text-base'),
          el('span', { class: 'flex-1 truncate text-sm font-semibold', textContent: cat }),
          el('span', { class: 'text-sm font-bold tabular-nums', textContent: fmt(amt) }),
          el('span', { class: 'w-9 text-right text-xs font-semibold text-slate-400', textContent: `${pctOfTotal}%` }),
        ]),
        limit
          ? bar((amt / limit) * 100, budgetColor(amt, limit))
          : bar((amt / entries[0][1]) * 100, colorFor(cat)),
      ]);
    })));
    box.replaceChildren(el('div', { class: 'flex flex-col gap-6 sm:flex-row sm:items-center' }, [donut, legend]));
  }

  renderTxList($('#recentList'), sortByDateDesc(list).slice(0, 5), false);
  growAfterPaint($('#view-dashboard'));
}

function txRow(t) {
  const isTransfer = t.type === 'transfer';
  const title = isTransfer ? `${t.account} → ${t.toAccount}` : t.category;
  const sub = [isTransfer ? 'Transfer' : t.account, t.note].filter(Boolean).join(' · ');
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
  const amtClass = {
    income: 'text-emerald-600 dark:text-emerald-400',
    expense: 'text-slate-900 dark:text-white',
    transfer: 'text-sky-600 dark:text-sky-400',
  }[t.type];
  const li = el('li', {
    class: 'animate-fade-up -mx-2 flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-slate-100 active:scale-[0.99] dark:hover:bg-slate-800/60',
    tabIndex: 0,
  }, [
    isTransfer ? avatar('🔁', '#0ea5e9') : avatar(categoryIcon(t.category), colorFor(t.category)),
    el('div', { class: 'min-w-0 flex-1' }, [
      el('p', { class: 'truncate font-semibold', textContent: title }),
      el('p', { class: 'truncate text-xs text-slate-500 dark:text-slate-400', textContent: sub }),
    ]),
    el('span', { class: `font-bold whitespace-nowrap tabular-nums ${amtClass}`, textContent: sign + fmt(t.amount) }),
  ]);
  li.addEventListener('click', () => openTxDialog(t));
  li.addEventListener('keydown', (e) => { if (e.key === 'Enter') openTxDialog(t); });
  return li;
}

function renderTxList(ul, list, groupByDay) {
  ul.replaceChildren();
  if (!list.length) {
    ul.append(el('li', {}, emptyState('📭', 'Nothing here yet', 'Transactions you add will show up here.')));
    return;
  }
  const rows = [];
  let lastDay = null;
  for (const t of list) {
    if (groupByDay && t.date !== lastDay) {
      const dayNet = totals(list.filter((x) => x.date === t.date)).net;
      rows.push(el('li', { class: 'animate-fade-up flex justify-between px-1 pt-4 pb-1 text-xs font-bold tracking-wide text-slate-400 uppercase first:pt-2' }, [
        el('span', { textContent: dayLabel(t.date) }),
        dayNet ? el('span', { class: 'tabular-nums normal-case', textContent: (dayNet > 0 ? '+' : '−') + fmt(Math.abs(dayNet)) }) : null,
      ]));
      lastDay = t.date;
    }
    rows.push(txRow(t));
  }
  ul.append(...stagger(rows));
}

function renderTransactions() {
  const catSel = $('#categoryFilter');
  const prev = catSel.value;
  const cats = [...new Set([...data.categories.expense, ...data.categories.income, ...data.transactions.map((t) => t.category).filter(Boolean)])];
  catSel.replaceChildren(el('option', { value: 'all', textContent: 'All categories' }),
    ...cats.map((c) => el('option', { value: c, textContent: `${categoryIcon(c)}  ${c}` })));
  catSel.value = cats.includes(prev) ? prev : 'all';

  const q = $('#searchInput').value.trim().toLowerCase();
  const type = $('input[name=typeFilter]:checked').value;
  const cat = catSel.value;
  const list = txInMonth().filter((t) =>
    (type === 'all' || t.type === type)
    && (cat === 'all' || t.category === cat)
    && (!q || `${t.note || ''} ${t.category || ''} ${t.account} ${t.toAccount || ''}`.toLowerCase().includes(q)));

  const { income, expense } = totals(list);
  const tile = (label, value, cls) => el('div', { class: 'card animate-fade-up p-4' }, [
    el('p', { class: 'muted text-xs font-semibold', textContent: label }),
    el('p', { class: `mt-0.5 text-lg font-extrabold tabular-nums ${cls}`, textContent: fmt(value) }),
  ]);
  $('#txSummary').replaceChildren(
    tile('Spent', expense, 'text-slate-900 dark:text-white'),
    tile('Earned', income, 'text-emerald-600 dark:text-emerald-400'),
  );
  renderTxList($('#txList'), sortByDateDesc(list), true);
}

function budgetStatus(spent, limit) {
  if (!limit) return { text: 'No limit set', cls: 'text-slate-400' };
  if (spent > limit) return { text: `Over by ${fmt(spent - limit)}`, cls: 'text-rose-600 dark:text-rose-400' };
  return { text: `${fmt(limit - spent)} left`, cls: spent >= limit * 0.8 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400' };
}

function renderBudgets() {
  const spent = spentByCategory(txInMonth());
  const cards = data.categories.expense.map((cat) => {
    const s = spent[cat] || 0;
    const input = el('input', {
      type: 'number', min: '0', step: '500', inputMode: 'numeric', placeholder: 'No limit',
      value: data.budgets[cat] ?? '',
      class: 'field w-32 py-2 pl-9 text-right font-semibold tabular-nums',
      'aria-label': `Monthly budget for ${cat}`,
    });
    const barBox = el('div', { class: 'mt-3' });
    const status = el('p', { class: 'mt-2 text-xs font-semibold' });
    const update = () => {
      const limit = Number(data.budgets[cat]) || 0;
      const fill = el('div', { class: 'bar-fill', style: `background:${limit ? budgetColor(s, limit) : '#cbd5e1'}` });
      fill.style.width = limit ? `${Math.min(100, (s / limit) * 100)}%` : '0%';
      barBox.replaceChildren(el('div', { class: 'bar-track' }, fill));
      const st = budgetStatus(s, limit);
      status.className = `mt-2 text-xs font-semibold ${st.cls}`;
      status.textContent = st.text;
    };
    input.addEventListener('input', () => {
      const v = Number(input.value);
      if (input.value === '' || !(v > 0)) delete data.budgets[cat];
      else data.budgets[cat] = v;
      save();
      update();
    });
    update();
    const card = el('div', { class: 'card p-4' }, [
      el('div', { class: 'flex items-center gap-3' }, [
        avatar(categoryIcon(cat), colorFor(cat)),
        el('div', { class: 'min-w-0 flex-1' }, [
          el('p', { class: 'truncate font-semibold', textContent: cat }),
          el('p', { class: 'text-xs text-slate-500 dark:text-slate-400', textContent: `${fmt(s)} spent` }),
        ]),
        el('div', { class: 'relative' }, [
          el('span', { class: 'pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-slate-400', textContent: 'Rs' }),
          input,
        ]),
      ]),
      barBox,
      status,
    ]);
    // Start bars at zero so they grow in.
    const target = barBox.querySelector('.bar-fill');
    target.dataset.w = target.style.width;
    target.style.width = '0%';
    return card;
  });
  $('#budgetList').replaceChildren(...stagger(cards));
  growAfterPaint($('#budgetList'));
}

function chip(icon, name, onRemove) {
  const btn = el('button', {
    type: 'button', textContent: '×', 'aria-label': `Remove ${name}`,
    class: 'grid size-6 cursor-pointer place-items-center rounded-full text-base leading-none text-slate-400 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/20',
  });
  btn.addEventListener('click', onRemove);
  return el('span', { class: 'animate-pop inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1.5 pr-1.5 pl-3 text-sm font-medium dark:bg-slate-800' }, [
    el('span', { textContent: icon }), el('span', { textContent: name }), btn,
  ]);
}

function renderSettings() {
  applyTheme();
  for (const type of ['expense', 'income']) {
    $(`#${type}Categories`).replaceChildren(...stagger(data.categories[type].map((c) => chip(categoryIcon(c), c, async () => {
      if (data.categories[type].length <= 1) return toast('Keep at least one category.', '⚠️');
      if (!await confirmBox(`Remove "${c}"? Existing transactions keep this category.`, { ok: 'Remove' })) return;
      data.categories[type] = data.categories[type].filter((x) => x !== c);
      if (type === 'expense') delete data.budgets[c];
      save();
      render();
      toast(`Removed ${c}`, '🗑️');
    }))));
  }
  $('#accountChips').replaceChildren(...stagger(data.accounts.map((a) => chip(accountIcon(a), a, async () => {
    if (data.accounts.length <= 1) return toast('Keep at least one account.', '⚠️');
    if (data.transactions.some((t) => t.account === a || t.toAccount === a)) {
      return toast(`"${a}" has transactions, so it can't be removed.`, '⚠️');
    }
    if (!await confirmBox(`Remove the account "${a}"?`, { ok: 'Remove' })) return;
    data.accounts = data.accounts.filter((x) => x !== a);
    save();
    render();
  }))));
}

// ---------- Transaction sheet ----------

const txDialog = $('#txDialog');
const form = $('#txForm');

const picked = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value;

function fillPicker(container, name, options, value, iconFn) {
  const opts = value && !options.includes(value) ? [...options, value] : options;
  const selected = opts.includes(value) ? value : opts[0];
  container.replaceChildren(...opts.map((o) => el('label', { class: 'pick' }, [
    el('input', { type: 'radio', name, value: o, checked: o === selected }),
    el('span', {}, [el('span', { class: 'text-base', textContent: iconFn(o) }), el('span', { class: 'truncate', textContent: o })]),
  ])));
}

const TYPE_STYLE = {
  expense: { prefix: 'text-rose-500', label: 'Paid from' },
  income: { prefix: 'text-emerald-500', label: 'Received in' },
  transfer: { prefix: 'text-sky-500', label: 'From account' },
};

function updateTypeFields(keep = {}) {
  const type = picked('type');
  const isTransfer = type === 'transfer';
  $('#categoryField').hidden = isTransfer;
  $('#toAccountField').hidden = !isTransfer;
  $('#accountLabel').textContent = TYPE_STYLE[type].label;
  $('#amountPrefix').className = `text-2xl font-bold transition-colors ${TYPE_STYLE[type].prefix}`;
  if (!isTransfer) fillPicker($('#categoryPicker'), 'category', data.categories[type], keep.category, categoryIcon);
  const account = keep.account || picked('account');
  fillPicker($('#accountPicker'), 'account', data.accounts, account, accountIcon);
  const to = keep.toAccount || data.accounts.find((a) => a !== picked('account'));
  fillPicker($('#toAccountPicker'), 'toAccount', data.accounts, to, accountIcon);
}

// Keeps the amount input as wide as its digits, so "Rs" sits right next to the number.
function updateAmountWords() {
  const input = form.elements.amount;
  input.style.width = `${Math.max(1, (input.value || input.placeholder).length) + 0.6}ch`;
  $('#amountWords').textContent = inWords(Number(input.value) || 0);
}

function openTxDialog(tx = null) {
  editingId = tx ? tx.id : null;
  form.reset();
  $('#txError').hidden = true;
  $('#txDialogTitle').textContent = tx ? 'Edit transaction' : 'New transaction';
  $('#deleteTx').hidden = !tx;
  form.querySelector(`input[name=type][value=${tx ? tx.type : 'expense'}]`).checked = true;
  updateTypeFields(tx || {});
  form.elements.amount.value = tx ? tx.amount : '';
  // New entries default to today, or to the 1st of the month being viewed if it's another month.
  form.elements.date.value = tx ? tx.date : (todayISO().startsWith(currentMonth) ? todayISO() : `${currentMonth}-01`);
  form.elements.note.value = tx?.note || '';
  updateAmountWords();
  txDialog.showModal();
  if (!tx) form.elements.amount.focus();
}

form.addEventListener('change', (e) => {
  if (e.target.name === 'type') updateTypeFields();
});
form.elements.amount.addEventListener('input', updateAmountWords);

function showError(msg) {
  const err = $('#txError');
  err.textContent = msg;
  err.hidden = false;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = form.elements;
  const amount = Math.round(Number(f.amount.value) * 100) / 100;
  const type = picked('type');
  if (!(amount > 0)) return showError('Enter an amount greater than 0.');
  if (type === 'transfer' && picked('account') === picked('toAccount')) {
    return showError('Choose two different accounts for a transfer.');
  }
  const tx = {
    id: editingId || newId(),
    type,
    amount,
    account: picked('account'),
    date: f.date.value,
    note: f.note.value.trim(),
    createdAt: editingId ? data.transactions.find((t) => t.id === editingId)?.createdAt : Date.now(),
  };
  if (type === 'transfer') tx.toAccount = picked('toAccount');
  else tx.category = picked('category');

  const wasEditing = Boolean(editingId);
  if (wasEditing) data.transactions = data.transactions.map((t) => (t.id === editingId ? tx : t));
  else data.transactions.push(tx);
  save();
  closeSheet(txDialog);
  currentMonth = tx.date.slice(0, 7);
  render();
  toast(wasEditing ? 'Changes saved' : `${type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : 'Transfer'} of ${fmt(amount)} added`);
});

$('#deleteTx').addEventListener('click', async () => {
  if (!await confirmBox('Delete this transaction? This cannot be undone.')) return;
  data.transactions = data.transactions.filter((t) => t.id !== editingId);
  save();
  closeSheet(txDialog);
  render();
  toast('Transaction deleted', '🗑️');
});

// Close sheets with the X button, Escape, or a tap on the backdrop, playing the exit animation.
for (const d of $$('dialog.sheet')) {
  d.addEventListener('cancel', (e) => { e.preventDefault(); d === txDialog ? closeSheet(d) : d.close(); });
  d.addEventListener('click', (e) => { if (e.target === d) d === txDialog ? closeSheet(d) : d.close(); });
}
txDialog.querySelector('[data-close]').addEventListener('click', () => closeSheet(txDialog));

// ---------- Settings actions ----------

$$('input[name=theme]').forEach((r) => r.addEventListener('change', () => setTheme(r.value)));

$('#themeToggle').addEventListener('click', () => {
  setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
});

$('#categoryForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const type = $('#newCategoryType').value;
  const name = $('#newCategoryName').value.trim();
  if (!name) return;
  if (data.categories[type].some((c) => c.toLowerCase() === name.toLowerCase())) return toast('That category already exists.', '⚠️');
  data.categories[type].push(name);
  save();
  $('#newCategoryName').value = '';
  render();
  toast(`Added ${name}`);
});

$('#accountForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#newAccountName').value.trim();
  if (!name) return;
  if (data.accounts.some((a) => a.toLowerCase() === name.toLowerCase())) return toast('That account already exists.', '⚠️');
  data.accounts.push(name);
  save();
  $('#newAccountName').value = '';
  render();
  toast(`Added ${name}`);
});

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#exportJson').addEventListener('click', () => {
  download(`pkr-budget-backup-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json');
  toast('Backup downloaded', '💾');
});

$('#exportCsv').addEventListener('click', () => {
  const esc = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheets treating notes as formulas
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['Date', 'Type', 'Category', 'Account', 'To Account', 'Amount (PKR)', 'Note']];
  for (const t of sortByDateDesc(data.transactions)) {
    rows.push([t.date, t.type, t.category || '', t.account, t.toAccount || '', t.amount, t.note || '']);
  }
  // BOM so Excel opens it as UTF-8 (Urdu notes display correctly).
  download(`pkr-budget-${todayISO()}.csv`, '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n'), 'text/csv');
  toast('CSV exported', '📊');
});

$('#importJson').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.transactions)) throw new Error('bad file');
    if (!await confirmBox('Restoring replaces all current data with the backup. Continue?', { ok: 'Restore', icon: '📂' })) return;
    data = normalize(parsed);
    save();
    render();
    toast(`Restored ${data.transactions.length} transactions`, '📂');
  } catch {
    toast('That file is not a valid PKR Budget backup.', '⚠️');
  }
});

$('#resetAll').addEventListener('click', async () => {
  if (!await confirmBox('Erase ALL transactions, budgets and settings? This cannot be undone.', { ok: 'Erase all' })) return;
  data = structuredClone(DEFAULT_DATA);
  save();
  render();
  toast('All data erased', '🗑️');
});

// ---------- Navigation ----------

function showView(view) {
  currentView = view;
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach((v) => {
    const active = v.id === `view-${view}`;
    v.classList.toggle('hidden', !active);
    if (active) {
      v.classList.remove('animate-fade-up');
      void v.offsetWidth; // restart the entrance animation
      v.classList.add('animate-fade-up');
    }
  });
  render();
  window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
}

$$('.nav-btn').forEach((btn) => btn.addEventListener('click', () => showView(btn.dataset.view)));
$$('[data-goto]').forEach((btn) => btn.addEventListener('click', () => showView(btn.dataset.goto)));

$('#prevMonth').addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, -1); render(); });
$('#nextMonth').addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, 1); render(); });
$('#monthInput').addEventListener('change', (e) => { if (e.target.value) { currentMonth = e.target.value; render(); } });
$('#addBtn').addEventListener('click', () => openTxDialog());
$('#searchInput').addEventListener('input', renderTransactions);
$$('input[name=typeFilter]').forEach((r) => r.addEventListener('change', renderTransactions));
$('#categoryFilter').addEventListener('change', renderTransactions);

function greet() {
  const h = new Date().getHours();
  $('#greeting').textContent = h < 12 ? 'Good morning ☀️' : h < 17 ? 'Good afternoon 🌤️' : 'Good evening 🌙';
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

applyTheme();
greet();
render();
