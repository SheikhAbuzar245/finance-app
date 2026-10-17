'use strict';

// ---------- Storage ----------

const STORAGE_KEY = 'pkr-budget-data-v1';

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
    alert('Could not save. Your browser storage may be full or disabled.');
  }
}

// ---------- Helpers ----------

const $ = (sel) => document.querySelector(sel);

const pkr = new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 });
const fmt = (n) => pkr.format(n);

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of [].concat(children)) node.append(c);
  return node;
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

function sortByDateDesc(list) {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}

// ---------- State ----------

let currentMonth = todayISO().slice(0, 7);
let currentView = 'dashboard';
let editingId = null;

const txInMonth = () => data.transactions.filter((t) => t.date.startsWith(currentMonth));

function monthTotals(list) {
  let income = 0, expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense, net: income - expense };
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
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'transactions') renderTransactions();
  if (currentView === 'budgets') renderBudgets();
  if (currentView === 'settings') renderSettings();
}

// With no budget limit, the bar is scaled against `scaleMax` and never shows warning colours.
function progressRow(label, spent, limit, scaleMax = 0) {
  const base = limit > 0 ? limit : scaleMax;
  const pct = base > 0 ? Math.min(100, (spent / base) * 100) : 0;
  const fill = el('div', { className: 'fill' });
  fill.style.width = `${pct}%`;
  if (limit > 0 && spent > limit) fill.classList.add('over');
  else if (limit > 0 && spent >= limit * 0.8) fill.classList.add('warn');
  const right = limit > 0 ? `${fmt(spent)} of ${fmt(limit)}` : fmt(spent);
  return el('div', { className: 'bar-row' }, [
    el('div', { className: 'bar-label' }, [el('span', { textContent: label }), el('span', { textContent: right })]),
    el('div', { className: 'track' }, fill),
  ]);
}

function renderDashboard() {
  const list = txInMonth();
  const { income, expense, net } = monthTotals(list);
  const balances = accountBalances();
  const total = Object.values(balances).reduce((s, v) => s + v, 0);

  $('#statIncome').textContent = fmt(income);
  $('#statExpense').textContent = fmt(expense);
  $('#statNet').textContent = fmt(net);
  $('#statBalance').textContent = fmt(total);

  // Overall budget
  const totalBudget = Object.values(data.budgets).reduce((s, v) => s + (Number(v) || 0), 0);
  const overall = $('#budgetOverall');
  overall.replaceChildren();
  if (totalBudget > 0) {
    overall.append(progressRow('Total spent', expense, totalBudget));
    const left = totalBudget - expense;
    overall.append(el('p', {
      className: 'muted',
      textContent: left >= 0 ? `${fmt(left)} left to spend this month.` : `Over budget by ${fmt(-left)}.`,
    }));
  } else {
    overall.append(el('p', { className: 'empty', textContent: 'No budgets set yet. Add them in the Budgets tab.' }));
  }

  // Spending per category
  const byCat = {};
  for (const t of list) if (t.type === 'expense') byCat[t.category] = (byCat[t.category] || 0) + t.amount;
  const bars = $('#categoryBars');
  bars.replaceChildren();
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    bars.append(el('p', { className: 'empty', textContent: 'No expenses this month.' }));
  } else {
    const max = entries[0][1];
    for (const [cat, amt] of entries) {
      const limit = Number(data.budgets[cat]) || 0;
      bars.append(progressRow(cat, amt, limit, max));
    }
  }

  // Accounts
  const accList = $('#accountList');
  accList.replaceChildren(...Object.entries(balances).map(([name, v]) =>
    el('div', {}, [el('span', { textContent: name }), el('strong', { textContent: fmt(v) })])));

  renderTxList($('#recentList'), sortByDateDesc(list).slice(0, 6), false);
}

function txItem(t) {
  const title = t.type === 'transfer' ? 'Transfer' : t.category;
  const sub = t.type === 'transfer'
    ? `${t.account} → ${t.toAccount}${t.note ? ' · ' + t.note : ''}`
    : `${t.account}${t.note ? ' · ' + t.note : ''}`;
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
  const li = el('li', {}, [
    el('div', { className: 'tx-main' }, [
      el('div', { className: 'tx-title', textContent: title }),
      el('div', { className: 'tx-sub', textContent: sub }),
    ]),
    el('span', { className: `amt ${t.type}`, textContent: sign + fmt(t.amount) }),
  ]);
  li.addEventListener('click', () => openDialog(t));
  return li;
}

function renderTxList(ul, list, groupByDay) {
  ul.replaceChildren();
  if (!list.length) {
    ul.append(el('li', { className: 'empty tx-day', textContent: 'No transactions.' }));
    return;
  }
  let lastDay = null;
  for (const t of list) {
    if (groupByDay && t.date !== lastDay) {
      ul.append(el('li', { className: 'tx-day', textContent: formatDay(t.date) }));
      lastDay = t.date;
    }
    ul.append(txItem(t));
  }
}

function renderTransactions() {
  const catSel = $('#categoryFilter');
  const prev = catSel.value;
  const cats = [...new Set([...data.categories.expense, ...data.categories.income, ...data.transactions.map((t) => t.category).filter(Boolean)])];
  catSel.replaceChildren(el('option', { value: 'all', textContent: 'All categories' }),
    ...cats.map((c) => el('option', { value: c, textContent: c })));
  catSel.value = cats.includes(prev) ? prev : 'all';

  const q = $('#searchInput').value.trim().toLowerCase();
  const type = $('#typeFilter').value;
  const cat = catSel.value;
  const list = txInMonth().filter((t) =>
    (type === 'all' || t.type === type)
    && (cat === 'all' || t.category === cat)
    && (!q || `${t.note || ''} ${t.category || ''} ${t.account} ${t.toAccount || ''}`.toLowerCase().includes(q)));
  renderTxList($('#txList'), sortByDateDesc(list), true);
}

function renderBudgets() {
  const form = $('#budgetForm');
  const spent = {};
  for (const t of txInMonth()) if (t.type === 'expense') spent[t.category] = (spent[t.category] || 0) + t.amount;
  form.replaceChildren(...data.categories.expense.map((cat) => {
    const input = el('input', {
      type: 'number', min: '0', step: '100', inputMode: 'numeric', placeholder: 'No limit',
      value: data.budgets[cat] ?? '',
    });
    input.addEventListener('change', () => {
      const v = Number(input.value);
      if (input.value === '' || !(v > 0)) delete data.budgets[cat];
      else data.budgets[cat] = v;
      save();
    });
    const label = el('div', {}, [
      el('div', { textContent: cat }),
      el('div', { className: 'muted', textContent: `Spent this month: ${fmt(spent[cat] || 0)}` }),
    ]);
    return el('label', {}, [label, input]);
  }));
}

function chip(name, onRemove) {
  const btn = el('button', { type: 'button', textContent: '×', title: `Remove ${name}` });
  btn.addEventListener('click', onRemove);
  return el('span', { className: 'chip' }, [el('span', { textContent: name }), btn]);
}

function renderSettings() {
  for (const type of ['expense', 'income']) {
    $(`#${type}Categories`).replaceChildren(...data.categories[type].map((c) => chip(c, () => {
      if (data.categories[type].length <= 1) return alert('Keep at least one category.');
      if (!confirm(`Remove category "${c}"? Existing transactions keep their category.`)) return;
      data.categories[type] = data.categories[type].filter((x) => x !== c);
      if (type === 'expense') delete data.budgets[c];
      save();
      render();
    })));
  }
  $('#accountChips').replaceChildren(...data.accounts.map((a) => chip(a, () => {
    if (data.accounts.length <= 1) return alert('Keep at least one account.');
    if (data.transactions.some((t) => t.account === a || t.toAccount === a)) {
      return alert(`"${a}" has transactions, so it can't be removed.`);
    }
    data.accounts = data.accounts.filter((x) => x !== a);
    save();
    render();
  })));
}

// ---------- Transaction dialog ----------

const dialog = $('#txDialog');
const form = $('#txForm');

function fillSelect(select, options, value) {
  const opts = value && !options.includes(value) ? [...options, value] : options;
  select.replaceChildren(...opts.map((o) => el('option', { value: o, textContent: o })));
  if (value) select.value = value;
}

function updateTypeFields(keep = {}) {
  const type = form.elements.type.value;
  const isTransfer = type === 'transfer';
  $('#categoryField').hidden = isTransfer;
  $('#toAccountField').hidden = !isTransfer;
  $('#accountLabel').textContent = isTransfer ? 'From account' : 'Account';
  if (!isTransfer) fillSelect(form.elements.category, data.categories[type], keep.category);
  fillSelect(form.elements.account, data.accounts, keep.account);
  const defaultTo = data.accounts.find((a) => a !== form.elements.account.value);
  fillSelect(form.elements.toAccount, data.accounts, keep.toAccount || defaultTo);
}

function openDialog(tx = null) {
  editingId = tx ? tx.id : null;
  form.reset();
  $('#txError').hidden = true;
  $('#txDialogTitle').textContent = tx ? 'Edit transaction' : 'Add transaction';
  $('#deleteTx').hidden = !tx;
  form.elements.type.value = tx ? tx.type : 'expense';
  updateTypeFields(tx || {});
  form.elements.amount.value = tx ? tx.amount : '';
  // New entries default to today, or to the 1st of the month being viewed if it's another month.
  form.elements.date.value = tx ? tx.date : (todayISO().startsWith(currentMonth) ? todayISO() : `${currentMonth}-01`);
  form.elements.note.value = tx?.note || '';
  dialog.showModal();
  if (!tx) form.elements.amount.focus();
}

form.addEventListener('change', (e) => {
  if (e.target.name === 'type') updateTypeFields();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = form.elements;
  const amount = Math.round(Number(f.amount.value) * 100) / 100;
  const type = f.type.value;
  const err = $('#txError');
  if (!(amount > 0)) { err.textContent = 'Enter an amount greater than 0.'; err.hidden = false; return; }
  if (type === 'transfer' && f.account.value === f.toAccount.value) {
    err.textContent = 'Choose two different accounts for a transfer.'; err.hidden = false; return;
  }
  const tx = {
    id: editingId || newId(),
    type,
    amount,
    account: f.account.value,
    date: f.date.value,
    note: f.note.value.trim(),
    createdAt: editingId ? data.transactions.find((t) => t.id === editingId)?.createdAt : Date.now(),
  };
  if (type === 'transfer') tx.toAccount = f.toAccount.value;
  else tx.category = f.category.value;

  if (editingId) data.transactions = data.transactions.map((t) => (t.id === editingId ? tx : t));
  else data.transactions.push(tx);
  save();
  dialog.close();
  currentMonth = tx.date.slice(0, 7);
  render();
});

$('#cancelTx').addEventListener('click', () => dialog.close());
$('#deleteTx').addEventListener('click', () => {
  if (!confirm('Delete this transaction?')) return;
  data.transactions = data.transactions.filter((t) => t.id !== editingId);
  save();
  dialog.close();
  render();
});

// ---------- Settings actions ----------

$('#categoryForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const type = $('#newCategoryType').value;
  const name = $('#newCategoryName').value.trim();
  if (!name) return;
  if (data.categories[type].some((c) => c.toLowerCase() === name.toLowerCase())) return alert('That category already exists.');
  data.categories[type].push(name);
  save();
  $('#newCategoryName').value = '';
  render();
});

$('#accountForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#newAccountName').value.trim();
  if (!name) return;
  if (data.accounts.some((a) => a.toLowerCase() === name.toLowerCase())) return alert('That account already exists.');
  data.accounts.push(name);
  save();
  $('#newAccountName').value = '';
  render();
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
});

$('#importJson').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.transactions)) throw new Error('bad file');
    if (!confirm('Restoring replaces all current data with the backup. Continue?')) return;
    data = normalize(parsed);
    save();
    render();
    alert(`Restored ${data.transactions.length} transactions.`);
  } catch {
    alert('That file is not a valid PKR Budget backup.');
  }
});

$('#resetAll').addEventListener('click', () => {
  if (!confirm('Erase ALL transactions, budgets and settings? This cannot be undone.')) return;
  data = structuredClone(DEFAULT_DATA);
  save();
  render();
});

// ---------- Navigation ----------

document.querySelectorAll('.tabbar button').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentView = btn.dataset.view;
    document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${currentView}`));
    render();
    window.scrollTo(0, 0);
  });
});

$('#prevMonth').addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, -1); render(); });
$('#nextMonth').addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, 1); render(); });
$('#monthInput').addEventListener('change', (e) => { if (e.target.value) { currentMonth = e.target.value; render(); } });
$('#addBtn').addEventListener('click', () => openDialog());
$('#searchInput').addEventListener('input', renderTransactions);
$('#typeFilter').addEventListener('change', renderTransactions);
$('#categoryFilter').addEventListener('change', renderTransactions);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
