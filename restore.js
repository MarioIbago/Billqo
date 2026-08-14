const fs = require('fs');
const orig = `@import "tailwindcss";

:root {
  color: #121827;
  background: #ffffff;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; }
html, body, #root { min-height: 100%; margin: 0; }
body { min-width: 320px; background: #f4f7f9; }
button, input, select { font: inherit; }
button { border: 0; cursor: pointer; }

.cuantly-app { min-height: 100vh; display: flex; background: #f4f7f9; color: #121827; }
.sidebar { width: 240px; flex: 0 0 240px; min-height: 100vh; display: flex; flex-direction: column; padding: 24px 16px 16px; border-right: none; background: #ffffff; box-shadow: 4px 0 24px rgba(0,0,0,0.02); z-index: 10; }
.brand { display: flex; align-items: center; gap: 10px; padding: 0 12px; color: #111827; }
.brand strong { font-size: 22px; letter-spacing: -0.65px; font-weight: 800; }
.sidebar-brand { align-items: flex-start; margin-bottom: 30px; }.sidebar-brand > div { display: flex; min-width: 0; flex-direction: column; }.sidebar-brand small { margin-top: 2px; color: #64748b; font-size: 9px; white-space: nowrap; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.cuantly-mark { color: #22c55e; flex: 0 0 auto; width: 28px; height: 28px; }
.side-nav { display: flex; flex-direction: column; gap: 6px; }
.side-nav button, .mobile-drawer > button { display: flex; align-items: center; gap: 14px; min-height: 44px; width: 100%; padding: 10px 16px; border: none; border-radius: 12px; background: transparent; color: #475569; font-size: 13px; font-weight: 600; text-align: left; transition: all .2s ease; }
.side-nav button:hover, .mobile-drawer > button:hover { background: #f1f5f9; color: #0f172a; }
.side-nav button.is-active, .mobile-drawer > button.is-active { color: #16a34a; background: #dcfce7; font-weight: 700; }
.side-nav button.is-active svg { stroke-width: 2.5; }
.sidebar-spacer { flex: 1; min-height: 24px; }
.support-card { margin: 0 0 20px; padding: 20px 16px; border: none; border-radius: 16px; background: #f8fafc; text-align: left; }
.support-illustration { position: relative; display: flex; justify-content: space-between; align-items: flex-start; height: 80px; color: #22c55e; }
.support-bot { width: 54px; height: 50px; position: relative; border: 3px solid #0f172a; border-radius: 14px 14px 18px 18px; background: #ffffff; transform: rotate(-4deg); box-shadow: 4px 4px 0 #94a3b8; }
.support-bot::before { content: ""; position: absolute; width: 4px; height: 12px; left: 22px; top: -14px; background: #0f172a; }
.support-bot::after { content: ""; position: absolute; width: 8px; height: 8px; left: 20px; top: -20px; border-radius: 50%; background: #22c55e; border: 2px solid #0f172a; }
.support-bot span { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: #0f172a; top: 16px; }
.support-bot span:first-child { left: 12px; }.support-bot span:nth-child(2) { right: 12px; }
.support-bot i { position: absolute; width: 14px; height: 6px; left: 17px; top: 32px; border-bottom: 3px solid #0f172a; border-radius: 50%; }
.support-card strong { display: block; font-size: 14px; font-weight: 800; margin: 0 0 6px; color: #0f172a; }
.support-card p { margin: 0 0 16px; font-size: 11px; line-height: 1.5; color: #475569; font-weight: 500; }
.support-card button { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 12px; border-radius: 10px; background: #22c55e; color: #fff; font-size: 12px; font-weight: 700; transition: all .2s ease; box-shadow: 0 4px 12px rgba(34,197,94,0.3); }
.support-card button:hover { background: #16a34a; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(34,197,94,0.4); }
.collapse-button { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: transparent; color: #64748b; font-size: 12px; font-weight: 600; border-radius: 12px; }
.collapse-button:hover { color: #0f172a; background: #f1f5f9; }
.app-shell { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.dashboard-column { min-width: 0; flex: 1; }
.desktop-topbar { min-height: 84px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 20px 32px; border-bottom: none; background: transparent; }
.desktop-greeting h1, .mobile-greeting h1 { margin: 0; font-size: 26px; line-height: 1.2; letter-spacing: -0.8px; font-weight: 800; color: #0f172a; }
.desktop-greeting h1 span, .mobile-greeting h1 span { font-size: 22px; }
.desktop-greeting p, .mobile-greeting p { margin: 4px 0 0; color: #64748b; font-size: 13px; font-weight: 500; }
.topbar-controls { display: flex; align-items: center; gap: 16px; }
.date-control { display: flex; align-items: center; gap: 8px; min-width: 180px; padding: 10px 14px; border: none; border-radius: 12px; color: #0f172a; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04); font-size: 12px; font-weight: 600; }
.date-control select { min-width: 0; flex: 1; appearance: none; border: 0; outline: 0; background: transparent; color: inherit; font-size: inherit; font-weight: 700; cursor: pointer; }
.period-control { display: flex; align-items: center; border: none; border-radius: 10px; overflow: hidden; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04); padding: 4px; gap: 2px; }
.period-control button { padding: 6px 10px; background: transparent; color: #64748b; font-size: 11px; font-weight: 700; border-radius: 6px; }
.period-control button:hover { color: #0f172a; }
.period-control button.is-active { background: #22c55e; color: #fff; }
.icon-button { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; border-radius: 12px; background: #ffffff; color: #475569; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.icon-button:hover { color: #0f172a; transform: translateY(-1px); }
.user-button { display: flex; align-items: center; gap: 10px; padding: 4px 12px 4px 4px; background: #ffffff; border-radius: 20px; color: #0f172a; font-size: 13px; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.2s; }
.user-button:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.avatar { display: inline-grid; place-items: center; width: 32px; height: 32px; border: none; border-radius: 50%; background: #f1f5f9; color: #0f172a; font-size: 11px; font-weight: 800; overflow: hidden; }
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.dashboard-main { width: 100%; max-width: 1600px; margin: 0 auto; padding: 0 32px 40px; }
.metrics-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
.metric-card, .chart-card, .description-panel { border: none; border-radius: 20px; background: #fff; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); padding: 20px; }
.metric-card { min-width: 0; min-height: 140px; display: flex; flex-direction: column; justify-content: space-between; }
.metric-card-top { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.metric-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; color: #fff; }
.metric-symbol { font-size: 22px; line-height: 1; font-weight: 800; }
.metric-copy { display: flex; min-width: 0; flex-direction: column; }
.metric-copy > span { overflow: hidden; color: #64748b; font-size: 11px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.metric-copy strong { margin-top: 4px; color: #0f172a; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
.metric-trend { margin-top: 6px; font-size: 11px; font-style: normal; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; }
.metric-trend em { color: #94a3b8; font-size: 10px; font-style: normal; font-weight: 500; }
.metric-trend.positive { color: #22c55e; }
.metric-trend.negative { color: #ef4444; }
.metric-trend.neutral { color: #64748b; }
.mini-sparkline { display: block; width: 100%; height: 32px; margin-top: 12px; overflow: visible; }
.primary-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; margin-top: 0; margin-bottom: 16px; }
.chart-card { min-width: 0; padding: 24px; }
.card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.card-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; color: #0f172a; font-size: 15px; font-weight: 800; letter-spacing: -0.2px; }
.card-header h2 svg { color: #94a3b8; stroke-width: 2; width: 16px; height: 16px; }
.outline-action { padding: 6px 12px; border: none; border-radius: 8px; background: #f1f5f9; color: #0f172a; font-size: 11px; font-weight: 700; transition: all 0.2s; }
.outline-action:hover { background: #e2e8f0; }
.income-expense-card, .category-card, .insights-card { min-height: 320px; }
.chart-legend { display: flex; align-items: center; gap: 16px; min-height: 24px; color: #475569; font-size: 11px; font-weight: 600; margin-bottom: 12px; }
.chart-legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
.legend-dot.green { background: #22c55e; }
.legend-dot.red { background: #ef4444; }
.line-chart { display: block; width: 100%; height: 220px; margin-top: 10px; }
.line-chart text, .small-line-chart text, .small-bar-chart text { fill: #94a3b8; font-family: inherit; font-size: 10px; font-weight: 500; }
.chart-grid-line { stroke: #f1f5f9; stroke-width: 1; stroke-dasharray: 4; }
.category-chart-content { display: flex; align-items: center; gap: 24px; min-height: 220px; }
.donut-wrap { display: grid; place-items: center; flex: 0 0 50%; }
.donut { width: 180px; max-width: 100%; height: auto; }
.donut-total { fill: #0f172a; font-size: 16px; font-weight: 800; }
.donut-label { fill: #64748b; font-size: 10px; font-weight: 600; }
.category-legend { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 12px; }
.category-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #0f172a; font-size: 11px; font-weight: 600; }
.category-row em { color: #94a3b8; font-style: normal; font-weight: 500; font-size: 10px; }
.category-name { display: flex; min-width: 0; align-items: center; gap: 8px; }
.category-name i { display: inline-block; width: 10px; height: 10px; flex: 0 0 10px; border-radius: 50%; }
.insight-list { display: flex; flex-direction: column; gap: 12px; }
.insight-item { display: flex; align-items: flex-start; gap: 14px; padding: 12px; border-radius: 12px; background: #f8fafc; transition: transform 0.2s; }
.insight-item:hover { transform: translateY(-2px); }
.insight-icon { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 40px; border-radius: 12px; }
.insight-icon.green { background: #dcfce7; color: #16a34a; }
.insight-icon.orange { background: #ffedd5; color: #ea580c; }
.insight-icon.purple { background: #f3e8ff; color: #9333ea; }
.insight-icon.blue { background: #e0f2fe; color: #0284c7; }
.insight-item strong { display: block; font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
.insight-item p { margin: 0; color: #475569; font-size: 11px; line-height: 1.4; }
.text-action { display: inline-flex; align-items: center; gap: 6px; margin-top: 16px; padding: 0; background: transparent; color: #2563eb; font-size: 12px; font-weight: 700; }
.text-action:hover { text-decoration: underline; }
.secondary-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; }
.small-chart-card { min-height: 280px; }
.category-table { width: 100%; border-collapse: collapse; margin-top: 10px; color: #0f172a; font-size: 12px; }
.category-table th { padding: 12px 8px; color: #64748b; font-size: 10px; font-weight: 600; text-align: left; border-bottom: 1px solid #f1f5f9; }
.category-table td { padding: 14px 8px; border-bottom: 1px solid #f8fafc; font-weight: 500; }
.flow-summary { display: flex; align-items: center; justify-content: space-between; padding: 24px 12px; }
.flow-summary div { display: flex; flex-direction: column; align-items: center; text-align: center; background: #f8fafc; padding: 16px; border-radius: 16px; min-width: 90px; }
.flow-summary span { color: #64748b; font-size: 11px; font-weight: 600; margin-bottom: 4px; }
.flow-summary strong { color: #0f172a; font-size: 16px; font-weight: 800; }
.flow-summary svg { color: #94a3b8; width: 24px; height: 24px; }
.influence-score { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 180px; background: #f8fafc; border-radius: 16px; padding: 24px; text-align: center; }
.influence-score span { color: #64748b; font-size: 12px; font-weight: 600; }
.influence-score strong { margin: 8px 0; font-size: 42px; font-weight: 800; color: #0f172a; letter-spacing: -1px; }
.influence-score strong small { font-size: 18px; color: #94a3b8; font-weight: 600; }
.influence-score b { color: #ea580c; font-size: 13px; font-weight: 700; padding: 4px 12px; background: #ffedd5; border-radius: 20px; }
.mobile-topbar, .mobile-greeting, .mobile-bottom-nav, .mobile-drawer, .mobile-menu-scrim, .mobile-surface { display: none; }
.dashboard-actions { display: flex; gap: 12px; margin-top: 24px; }
.toolbar-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 16px; border: none; border-radius: 10px; background: #ffffff; color: #0f172a; font-size: 12px; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all .2s; }
.toolbar-button:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-1px); }
.primary-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; border: none; border-radius: 12px; background: #22c55e; color: #ffffff; font-size: 13px; font-weight: 800; box-shadow: 0 4px 12px rgba(34,197,94,0.3); transition: all .2s; }
.primary-button:hover { background: #16a34a; box-shadow: 0 6px 16px rgba(34,197,94,0.4); transform: translateY(-2px); }
.modal-backdrop { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 24px; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(8px); }
.movement-modal { width: min(100%, 480px); border: none; border-radius: 24px; background: #fff; box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden; }
.modal-heading { padding: 24px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-start; }
.modal-heading h2 { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; }
.modal-close { width: 32px; height: 32px; border-radius: 10px; background: #e2e8f0; color: #475569; display: grid; place-items: center; transition: all 0.2s; }
.modal-close:hover { background: #cbd5e1; color: #0f172a; }
.movement-form { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.movement-form label { display: flex; flex-direction: column; gap: 8px; font-size: 12px; font-weight: 700; color: #475569; }
.movement-form input, .movement-form select { padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; font-weight: 600; color: #0f172a; outline: none; transition: border-color 0.2s; }
.movement-form input:focus, .movement-form select:focus { border-color: #22c55e; }
.workspace-panel { background: #fff; border-radius: 24px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); margin-top: 16px; }
.workspace-panel-heading h2 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
.workspace-panel-heading p { color: #64748b; font-size: 13px; font-weight: 500; }
.finance-table-wrap { margin-top: 16px; border-radius: 16px; border: 1px solid #f1f5f9; overflow: hidden; }

@media (max-width: 1024px) {
  .metrics-grid { grid-template-columns: repeat(3, 1fr); }
  .primary-grid, .secondary-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .sidebar, .desktop-topbar, .metrics-grid, .primary-grid, .secondary-grid, .dashboard-actions { display: none; }
  .mobile-topbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: #fff; position: sticky; top: 0; z-index: 20; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
  .mobile-menu-button { width: 40px; height: 40px; border-radius: 12px; background: #f8fafc; display: grid; place-items: center; color: #0f172a; }
  .mobile-brand strong { font-size: 20px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px; }
  .mobile-top-actions { display: flex; align-items: center; gap: 12px; }
  .dashboard-main { padding: 0 16px 100px; background: #f8fafc; }
  .mobile-greeting { padding: 24px 0 16px; }
  .mobile-surface { display: flex; flex-direction: column; gap: 16px; }
  .mobile-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .mobile-summary-grid article { background: #fff; padding: 16px; border-radius: 20px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 12px; }
  .mobile-summary-icon { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: #fff; font-size: 18px; }
  .mobile-summary-icon.blue { background: #3b82f6; }
  .mobile-summary-icon.orange { background: #f97316; }
  .mobile-summary-grid small { font-size: 11px; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px; }
  .mobile-summary-grid strong { font-size: 18px; font-weight: 800; color: #0f172a; }
  .mobile-bottom-nav { display: flex; justify-content: space-between; align-items: center; position: fixed; bottom: 0; left: 0; right: 0; background: #fff; padding: 12px 24px 24px; box-shadow: 0 -4px 20px rgba(0,0,0,0.08); border-radius: 32px 32px 0 0; z-index: 30; }
  .mobile-bottom-nav button { display: flex; flex-direction: column; align-items: center; gap: 4px; color: #94a3b8; font-size: 10px; font-weight: 700; }
  .mobile-bottom-nav button.is-active { color: #22c55e; }
  .mobile-add { width: 56px; height: 56px; border-radius: 20px; background: #22c55e !important; color: #fff !important; display: grid; place-items: center; margin-top: -32px; box-shadow: 0 8px 24px rgba(34,197,94,0.4); }
  .chart-card { background: #fff; border-radius: 24px; padding: 20px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
  .phone-section-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .phone-section-heading strong { font-size: 16px; font-weight: 800; color: #0f172a; }
  .phone-section-heading button { color: #22c55e; font-size: 12px; font-weight: 700; background: #dcfce7; padding: 4px 12px; border-radius: 12px; }
  .mobile-transaction { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
  .mobile-transaction:last-child { border-bottom: none; }
  .phone-transaction-icon { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: #fff; }
  .phone-transaction-icon.orange { background: #f97316; }
  .phone-transaction-icon.green { background: #22c55e; }
  .mobile-transaction b { font-size: 13px; font-weight: 700; color: #0f172a; display: block; }
  .mobile-transaction small { font-size: 11px; color: #64748b; font-weight: 500; }
  .mobile-transaction > strong { font-size: 14px; font-weight: 800; margin-left: auto; }
  .mobile-transaction > strong.income { color: #22c55e; }
  .mobile-transaction > strong.expense { color: #0f172a; }
  .mobile-drawer { position: fixed; top: 0; left: 0; bottom: 0; width: 280px; background: #fff; z-index: 50; padding: 24px; transform: translateX(-100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 20px 0 40px rgba(0,0,0,0.1); }
  .mobile-drawer.is-open { transform: translateX(0); }
  .drawer-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
  .mobile-menu-scrim { position: fixed; inset: 0; background: rgba(15,23,42,0.4); z-index: 40; backdrop-filter: blur(4px); }
}

`
fs.writeFileSync('src/index.css', orig);
