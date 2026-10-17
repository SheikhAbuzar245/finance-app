# PKR Budget

A simple personal finance app for budgeting in Pakistani Rupees (Rs / PKR).
It runs entirely in your browser: no sign-up and no server, and your data stays on your device.

## Features

- **Track income, expenses and transfers** between accounts (Cash, Bank, JazzCash, Easypaisa, or your own).
- **Monthly dashboard**: income, expenses, savings, overall balance, and balance for each account.
- **Category budgets**: set a monthly limit for each category. Bars turn amber at 80% and red when you go over.
- **Local categories** ready to use: Electricity, Gas, Committee (BC), Zakat & Charity, Family Support and more. You can add or remove them.
- **Search and filter** transactions by type, category or note.
- **Backup and restore** as JSON, and **export to CSV** to open in Excel or Google Sheets.
- **Works offline** and can be installed on your phone's home screen. Supports dark mode.

## Run it

Pick one:

1. **Just open it**: double-click `index.html`. (Offline mode and installing need option 2 or 3.)
2. **Local server**: `python3 -m http.server 8000`, then open http://localhost:8000.
3. **Host free on GitHub Pages**: repo **Settings → Pages → Deploy from a branch**, then pick the branch and `/ (root)`.
   Open the link on your phone and choose **Add to Home Screen**.

## Your data

Everything is saved in your browser's local storage on that device. Clearing your browser data erases it,
so use **Settings → Download backup** regularly. To move your data to another phone, restore that backup there.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page layout |
| `styles.css` | Styling (light and dark) |
| `app.js` | All app logic |
| `sw.js`, `manifest.json`, `icons/` | Offline support and installing as an app |
