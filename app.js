'use strict';

// ── 常量 ──────────────────────────────────────────────────────────────────
const SCORE_HIGH = 8;
const SCORE_MID  = 5;

// ── 状态 ──────────────────────────────────────────────────────────────────
let currentDate = null;
let currentTab  = 'curated';
let allDates    = [];

// ── 工具函数 ──────────────────────────────────────────────────────────────
function scoreClass(score) {
  if (score >= SCORE_HIGH) return 'score-high';
  if (score >= SCORE_MID)  return 'score-mid';
  return 'score-low';
}

function sourceBadge(source, isPremium) {
  const isArxiv = /^cond-mat\.|^hep-|^quant-ph/.test(source);
  if (isArxiv) return `<span class="badge badge-arxiv">${esc(source)}</span>`;
  if (isPremium) return `<span class="badge badge-premium">⭐ ${esc(source)}</span>`;
  return `<span class="badge badge-journal">${esc(source)}</span>`;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

function fmtFullDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
       + `（${weekdays[d.getDay()]}）`;
}

// ── Paper 卡片构建 ─────────────────────────────────────────────────────────
function buildPaperCard(paper, index, compact = false) {
  const sc = scoreClass(paper.score);
  const stmBadge = paper.is_stm ? `<span class="badge badge-stm">STM</span>` : '';
  const barW = Math.round(paper.score * 10);
  const pubStr = paper.published ? fmtDate(paper.published) : '';

  const enBlock = paper.abstract_excerpt
    ? `<div class="en-excerpt">${esc(paper.abstract_excerpt)}</div>`
    : '';

  const reasonBlock = paper.score_reason
    ? `<div class="score-reason">评分：${esc(paper.score_reason)}</div>`
    : '';

  const summaryBlock = paper.summary_cn
    ? `<div class="summary-cn">${esc(paper.summary_cn)}</div>`
    : '';

  const expandBtn = (compact && (paper.summary_cn || paper.abstract_excerpt))
    ? `<button class="expand-btn" onclick="toggleExpand(this)">摘要 ▾</button>`
    : '';

  return `
<div class="paper-card ${compact ? 'compact' : ''} ${sc}">
  <div class="paper-num">${String(index).padStart(2, '0')}</div>
  <div class="paper-title"><a href="${esc(paper.url)}" target="_blank" rel="noreferrer">${esc(paper.title)}</a></div>
  <div class="paper-meta">
    ${sourceBadge(paper.source, paper.is_premium)}
    ${stmBadge}
    <span>${esc(paper.authors || '')}</span>
    ${pubStr ? `<span>· ${pubStr}</span>` : ''}
  </div>
  <div class="score-row ${sc}">
    <span class="score-num">${paper.score}/10</span>
    <div class="score-bar-track"><div class="score-bar-fill" style="width:${barW}%"></div></div>
  </div>
  ${summaryBlock}
  ${reasonBlock}
  <div class="paper-actions">
    ${expandBtn}
    <a class="link-btn" href="${esc(paper.url)}" target="_blank" rel="noreferrer">打开论文 ↗</a>
  </div>
  ${enBlock}
</div>`.trim();
}

function toggleExpand(btn) {
  const card = btn.closest('.paper-card');
  const expanded = card.classList.toggle('expanded');
  btn.textContent = expanded ? '收起 ▴' : '摘要 ▾';
}
window.toggleExpand = toggleExpand;

// ── 日期侧栏 ──────────────────────────────────────────────────────────────
function buildDateList() {
  const ul = document.getElementById('date-list');
  ul.innerHTML = '';
  allDates.forEach(date => {
    const day = window.PAPER_DATA[date];
    const li = document.createElement('li');
    li.dataset.date = date;
    const label = date.slice(5); // MM-DD
    li.innerHTML = `<span>${label}</span><span class="date-count">${day.total || '?'}</span>`;
    li.addEventListener('click', () => selectDate(date));
    ul.appendChild(li);
  });
}

function highlightDate(date) {
  document.querySelectorAll('#date-list li').forEach(li => {
    li.classList.toggle('active', li.dataset.date === date);
  });
}

// ── 来源统计（侧栏） ──────────────────────────────────────────────────────
function updateSourceStats(date) {
  const ul = document.getElementById('source-stats');
  ul.innerHTML = '';
  const day = window.PAPER_DATA[date];
  if (!day || !day.papers) return;

  const counts = {};
  day.papers.forEach(p => {
    counts[p.source] = (counts[p.source] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = sorted[0]?.[1] || 1;

  sorted.forEach(([src, cnt]) => {
    const li = document.createElement('li');
    const pct = Math.round(cnt / max * 100);
    li.innerHTML = `
      <span style="min-width:60px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(src)}</span>
      <span class="src-bar-wrap"><span class="src-bar" style="width:${pct}%"></span></span>
      <span class="src-count">${cnt}</span>`;
    ul.appendChild(li);
  });
}

// ── Tab 切换 ──────────────────────────────────────────────────────────────
function selectTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.add('hidden');
  });
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
}

// ── 精选 Tab ──────────────────────────────────────────────────────────────
function renderCurated(day) {
  const list = document.getElementById('curated-list');
  const empty = document.getElementById('curated-empty');
  list.innerHTML = '';

  const included   = day.papers.filter(p => p.included).sort((a, b) => b.score - a.score);
  const highlighted = included.filter(p => p.score >= SCORE_HIGH);
  const normal      = included.filter(p => p.score >= SCORE_MID && p.score < SCORE_HIGH);
  const stmOnly     = included.filter(p => p.is_stm && p.score < SCORE_MID);
  const others      = included.filter(p => !p.is_stm && p.score < SCORE_MID);

  let num = 1;
  if (highlighted.length) {
    list.insertAdjacentHTML('beforeend', `<div class="section-heading red">🔴 强烈推荐（${SCORE_HIGH}–10 分）</div>`);
    highlighted.forEach(p => { list.insertAdjacentHTML('beforeend', buildPaperCard(p, num++)); });
  }
  if (normal.length) {
    list.insertAdjacentHTML('beforeend', `<div class="section-heading blue">🔵 推荐阅读（${SCORE_MID}–${SCORE_HIGH - 1} 分）</div>`);
    normal.forEach(p => { list.insertAdjacentHTML('beforeend', buildPaperCard(p, num++)); });
  }
  if (stmOnly.length) {
    list.insertAdjacentHTML('beforeend', `<div class="section-heading purple">📡 STM 必读（强制收录）</div>`);
    stmOnly.forEach(p => { list.insertAdjacentHTML('beforeend', buildPaperCard(p, num++)); });
  }
  if (others.length) {
    list.insertAdjacentHTML('beforeend', `<div class="section-heading gray">📋 其他精选</div>`);
    others.forEach(p => { list.insertAdjacentHTML('beforeend', buildPaperCard(p, num++)); });
  }

  empty.classList.toggle('hidden', included.length > 0);
  document.getElementById('tab-curated-count').textContent = included.length;
}

// ── 全部 Tab ──────────────────────────────────────────────────────────────
function renderAll(day) {
  const noRaw = document.getElementById('no-raw-warning');
  noRaw.classList.toggle('hidden', day.has_raw !== false);

  const displayCount = day.has_raw === false ? day.papers.length : (day.total || day.papers.length);
  document.getElementById('tab-all-count').textContent = displayCount;

  applyAllFilters(day);
}

function applyAllFilters(day) {
  if (!day) return;
  const minScore = parseInt(document.getElementById('score-filter').value, 10);
  const sortBy   = document.getElementById('sort-select').value;

  let papers = day.papers.filter(p => p.score >= minScore);

  if (sortBy === 'score') {
    papers = papers.sort((a, b) => {
      const bonus = p => (p.is_premium ? 0.5 : 0);
      return (b.score + bonus(b)) - (a.score + bonus(a));
    });
  } else if (sortBy === 'date') {
    papers = papers.sort((a, b) => (b.published || '').localeCompare(a.published || ''));
  } else {
    papers = papers.sort((a, b) => a.source.localeCompare(b.source));
  }

  const list = document.getElementById('all-list');
  list.innerHTML = '';
  papers.forEach((p, i) => {
    list.insertAdjacentHTML('beforeend', buildPaperCard(p, i + 1, true));
  });
}

// ── 统计 Tab ──────────────────────────────────────────────────────────────
function renderStats(day) {
  renderSourceChart(day);
  renderScoreHist(day);
}

function renderSourceChart(day) {
  const el = document.getElementById('source-chart');
  el.innerHTML = '';
  const counts = {};
  day.papers.forEach(p => { counts[p.source] = (counts[p.source] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const max = sorted[0]?.[1] || 1;
  sorted.forEach(([src, cnt]) => {
    const pct = Math.round(cnt / max * 100);
    el.insertAdjacentHTML('beforeend', `
      <div class="chart-bar-row">
        <span class="chart-bar-label" title="${esc(src)}">${esc(src)}</span>
        <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
        <span class="chart-bar-count">${cnt}</span>
      </div>`);
  });
}

function renderScoreHist(day) {
  const el = document.getElementById('score-chart');
  el.innerHTML = '';
  const bins = Array(11).fill(0);
  day.papers.forEach(p => { if (p.score >= 0 && p.score <= 10) bins[p.score]++; });
  const max = Math.max(...bins, 1);

  let html = '<div class="hist-row">';
  bins.forEach((cnt, score) => {
    const h = Math.round(cnt / max * 100);
    const cls = score >= SCORE_HIGH ? 'high' : score === 0 ? 'zero' : '';
    html += `<div class="hist-col">
      <div class="hist-bar-wrap"><div class="hist-bar ${cls}" style="height:${h}%"></div></div>
      <div class="hist-label">${score}</div>
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

// ── 日期选择 ──────────────────────────────────────────────────────────────
function selectDate(date) {
  currentDate = date;
  highlightDate(date);
  updateSourceStats(date);

  const day = window.PAPER_DATA[date];
  document.getElementById('day-view').classList.remove('hidden');
  document.getElementById('search-results').classList.add('hidden');
  document.getElementById('no-data').classList.add('hidden');

  document.getElementById('day-title').textContent = fmtFullDate(date);
  const lookback = day.lookback_days || 1;
  document.getElementById('day-meta').textContent =
    `来自最近 ${lookback} 天 · 检索 ${day.total} 篇 · 精选 ${day.included} 篇 · ${day.generated || ''}`;

  renderCurated(day);
  renderAll(day);
  renderStats(day);
  selectTab(currentTab);
}

// ── 全局搜索 ──────────────────────────────────────────────────────────────
let searchTimer = null;

function doSearch(query) {
  const q = query.trim().toLowerCase();

  if (!q) {
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('day-view').classList.remove('hidden');
    if (currentDate) highlightDate(currentDate);
    return;
  }

  document.getElementById('day-view').classList.add('hidden');
  document.getElementById('search-results').classList.remove('hidden');

  const resultList = document.getElementById('search-result-list');
  const titleEl    = document.getElementById('search-result-title');
  resultList.innerHTML = '';

  let totalMatches = 0;
  allDates.forEach(date => {
    const day = window.PAPER_DATA[date];
    if (!day || !day.papers) return;
    const matched = day.papers.filter(p => {
      const hay = [p.title, p.authors, p.summary_cn, p.source].join(' ').toLowerCase();
      return hay.includes(q);
    });
    if (!matched.length) return;
    totalMatches += matched.length;
    resultList.insertAdjacentHTML('beforeend', `
      <div class="search-day-group">
        <div class="search-day-title">${fmtFullDate(date)} · ${matched.length} 条</div>
        ${matched.map((p, i) => buildPaperCard(p, i + 1, true)).join('')}
      </div>`);
  });

  titleEl.textContent = totalMatches
    ? `搜索"${query}"· ${totalMatches} 篇`
    : `搜索"${query}"· 无结果`;
}

// ── 初始化 ────────────────────────────────────────────────────────────────
function init() {
  if (!window.PAPER_DATA || Object.keys(window.PAPER_DATA).length === 0) {
    document.getElementById('no-data').classList.remove('hidden');
    document.getElementById('day-view').classList.add('hidden');
    return;
  }

  allDates = Object.keys(window.PAPER_DATA).sort().reverse();
  buildDateList();

  // Tab 点击
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => selectTab(btn.dataset.tab));
  });

  // 评分滑块
  const slider = document.getElementById('score-filter');
  const sliderVal = document.getElementById('score-filter-val');
  slider.addEventListener('input', () => {
    sliderVal.textContent = `≥ ${slider.value}`;
    if (currentDate) applyAllFilters(window.PAPER_DATA[currentDate]);
  });

  // 排序
  document.getElementById('sort-select').addEventListener('change', () => {
    if (currentDate) applyAllFilters(window.PAPER_DATA[currentDate]);
  });

  // 搜索
  document.getElementById('search-input').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(e.target.value), 200);
  });
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.target.value = '';
      doSearch('');
    }
  });

  // 默认显示最新一天
  selectDate(allDates[0]);
}

document.addEventListener('DOMContentLoaded', init);

// ── 运行按钮 & 日志面板 ───────────────────────────────────────────────────
let _pollTimer  = null;
let _toastTimer = null;
let _logVisible = false;

function showToast(msg, duration = 4000) {
  const el = document.getElementById('run-toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  if (duration > 0) {
    _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }
}

function hideToast() {
  clearTimeout(_toastTimer);
  document.getElementById('run-toast').classList.remove('show');
}

function showLogPanel(text, title) {
  const panel   = document.getElementById('log-panel');
  const content = document.getElementById('log-content');
  const titleEl = document.getElementById('log-panel-title');
  if (title) titleEl.textContent = title;
  content.textContent = text || '';
  panel.classList.add('show');
  content.scrollTop = content.scrollHeight;
  _logVisible = true;
}

function closeLogPanel() {
  document.getElementById('log-panel').classList.remove('show');
  _logVisible = false;
}
window.closeLogPanel = closeLogPanel;

function setRunBtn(text, disabled, stateClass) {
  const btn = document.getElementById('run-btn');
  if (!btn) return;
  btn.textContent = text;
  btn.disabled = disabled;
  btn.className = 'run-btn' + (stateClass ? ` ${stateClass}` : '');
}

function applyStatus(data) {
  clearTimeout(_pollTimer);
  if (data.status === 'running') {
    setRunBtn('运行中…', true, 'state-running');
    showLogPanel(data.log_tail || '正在启动…', '运行日志 · 进行中');
    _pollTimer = setTimeout(fetchStatus, 2000);
  } else if (data.status === 'done') {
    setRunBtn('今日已完成', true, 'state-done');
    showLogPanel(data.log_tail || '', '运行日志 · 已完成');
    showToast('完成！请刷新页面查看今日文献。', 8000);
  } else if (data.report_exists) {
    setRunBtn('今日已完成', true, 'state-done');
    if (_logVisible && data.log_tail) showLogPanel(data.log_tail, '运行日志 · 已完成');
  } else if (data.status === 'error') {
    setRunBtn('出错，重试', false, 'state-error');
    showLogPanel(data.log_tail || '', '运行日志 · 出错');
  } else {
    setRunBtn('运行今日', false, '');
  }
}

function fetchStatus() {
  fetch('/api/status')
    .then(r => r.json())
    .then(applyStatus)
    .catch(() => {});
}

function initRunBtn() {
  if (window.location.protocol === 'file:') return;
  fetch('/api/status')
    .then(r => r.json())
    .then(data => {
      document.getElementById('run-btn').style.display = '';
      applyStatus(data);
    })
    .catch(() => {});
}

function runScout() {
  const btn = document.getElementById('run-btn');
  if (!btn || btn.disabled) return;
  setRunBtn('启动中…', true, 'state-running');
  showLogPanel('正在连接服务器…', '运行日志 · 启动中');
  fetch('/api/run', { method: 'POST' })
    .then(r => r.json())
    .then(data => {
      if (data.status === 'already_done') {
        applyStatus({ status: 'done', report_exists: true, log_tail: data.log_tail || '' });
        showToast('今日报告已存在，无需重复运行。', 4000);
      } else if (data.status === 'started') {
        applyStatus({ status: 'running', log_tail: '' });
      } else {
        applyStatus({ status: 'error', log_tail: '' });
      }
    })
    .catch(() => {
      setRunBtn('连接失败', false, 'state-error');
      showLogPanel('无法连接服务器；静态共享版本不支持从网页端触发今日运行。', '运行日志 · 连接失败');
    });
}
window.runScout = runScout;

document.addEventListener('DOMContentLoaded', initRunBtn);

// ── 下次刷新倒计时（每天 09:00）────────────────────────────────────────────
function updateNextRefresh() {
  const el = document.getElementById('next-refresh-text');
  if (!el) return;

  const now = new Date();
  const next = new Date(now);
  next.setHours(9, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);

  const diffMs = next - now;
  const totalSec = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  let text;
  if (h > 0) {
    text = `距下次刷新 ${h} 小时 ${m} 分`;
  } else if (m > 0) {
    text = `距下次刷新 ${m} 分 ${s} 秒`;
  } else {
    text = `距下次刷新 ${s} 秒`;
  }
  el.textContent = text;

  const badge = document.getElementById('next-refresh-badge');
  if (badge) {
    badge.classList.toggle('refresh-soon', h === 0 && m < 30);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateNextRefresh();
  setInterval(updateNextRefresh, 1000);
});
