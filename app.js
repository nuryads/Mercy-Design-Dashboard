/* MERCY Design Dashboard — GitHub Pages + Google Sheets (tanpa API key). */
(() => {
  'use strict';

  const CONFIG = window.MERCY_CONFIG || {};
  const el = (id) => document.getElementById(id);
  const fmt = (v) => new Intl.NumberFormat('id-ID').format(v);
  const PALETTE = {
    'TUNGGU ACC': '#f0b358', 'REV SO': '#ef8893', 'SO': '#6895e7',
    'ACC': '#50b499', 'REPEAT': '#8b73de'
  };
  const CHIPS = {
    'TUNGGU ACC': 'chip-wait', 'REV SO': 'chip-revise', 'SO': 'chip-so',
    'ACC': 'chip-acc', 'REPEAT': 'chip-repeat'
  };
  const BASE_STATUSES = ['TUNGGU ACC', 'REV SO', 'SO', 'ACC', 'REPEAT'];
  const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  let DATA = Array.isArray(window.MERCY_INITIAL_DATA) ? window.MERCY_INITIAL_DATA.slice() : [];
  let loading = false;
  let successfulLiveSync = false;
  let lastSyncLabel = '';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function parseDate(input) {
    if (input === null || input === undefined || input === '') return '';
    const text = String(input).trim();
    let m = text.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)/i);
    if (m) return `${m[1]}-${String(Number(m[2]) + 1).padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    m = text.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{2,4})$/i);
    if (m) {
      const names = {
        jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3,
        apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6,
        jul: 7, juli: 7, agu: 8, ags: 8, agustus: 8,
        sep: 9, september: 9, okt: 10, oktober: 10,
        nov: 11, november: 11, des: 12, desember: 12
      };
      const month = names[m[2].toLowerCase()];
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      if (month) return `${year}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    if (typeof input === 'number' || /^\d{5}(\.\d+)?$/.test(text)) {
      const dayNumber = Number(input);
      if (dayNumber > 35000 && dayNumber < 90000) {
        const date = new Date(Date.UTC(1899, 11, 30) + Math.round(dayNumber) * 86400000);
        return date.toISOString().slice(0, 10);
      }
    }
    return '';
  }

  function dateFmt(v) {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '—';
    return new Date(`${v}T12:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function parseQty(input) {
    if (input === null || input === undefined || String(input).trim() === '') return null;
    if (typeof input === 'number') return Number.isFinite(input) ? input : null;
    let s = String(input).trim().replace(/\s/g, '');
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.');
    const result = Number(s);
    return Number.isFinite(result) && result >= 0 ? result : null;
  }

  function normalizeHeader(input) {
    return String(input ?? '').toUpperCase().replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function rowsToRecords(headers, rawRows) {
    const col = new Map(headers.map((h, i) => [normalizeHeader(h), i]));
    if (!col.has('DESIGN') && !col.has('DESAIN')) {
      throw new Error('Kolom DESIGN tidak ditemukan. Baris 1 harus berisi TGL, DESIGN, WARNA, QTY, CUSTOMER, KODE, KET.');
    }
    const get = (r, names) => {
      for (const name of names) {
        if (col.has(name)) return r[col.get(name)] ?? '';
      }
      return '';
    };
    const result = rawRows.map((r, idx) => ({
      id: idx + 1,
      tgl: parseDate(get(r, ['TGL', 'TANGGAL', 'DATE'])),
      design: String(get(r, ['DESIGN', 'DESAIN', 'NAMA DESIGN']) ?? '').trim(),
      warna: String(get(r, ['WARNA', 'COLOR']) ?? '').trim(),
      qty: parseQty(get(r, ['QTY', 'QUANTITY', 'JUMLAH'])),
      customer: String(get(r, ['CUSTOMER', 'PELANGGAN']) ?? '').trim(),
      kode: String(get(r, ['KODE', 'CODE']) ?? '').trim(),
      status: String(get(r, ['KET', 'STATUS', 'KETERANGAN']) ?? '').trim().toUpperCase()
    })).filter(r => r.design !== '');
    if (!result.length) throw new Error('Tidak ada baris desain yang terbaca. Periksa data di Google Sheets.');
    return result;
  }

  function parseCSV(text) {
    const s = text.replace(/^\uFEFF/, '');
    const firstLine = s.split(/\r?\n/, 1)[0] || '';
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    const result = [];
    let line = [], value = '', quoted = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') {
        if (quoted && s[i + 1] === '"') { value += '"'; i++; }
        else quoted = !quoted;
      } else if (c === delimiter && !quoted) {
        line.push(value); value = '';
      } else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && s[i + 1] === '\n') i++;
        line.push(value); value = '';
        if (line.some(x => x.trim())) result.push(line);
        line = [];
      } else value += c;
    }
    line.push(value);
    if (line.some(x => x.trim())) result.push(line);
    if (!result.length) throw new Error('CSV kosong');
    return rowsToRecords(result[0], result.slice(1));
  }

  function sourceState(mode, label, detail) {
    el('sourceStrip').className = 'source-strip' + (mode === 'live' ? ' live' : mode === 'error' ? ' error' : '');
    el('sourceLabel').textContent = label;
    el('sourceDetail').textContent = detail;
  }

  function allStatuses() {
    const extra = [...new Set(DATA.map(r => r.status || 'TANPA STATUS'))].filter(s => !BASE_STATUSES.includes(s));
    return [...BASE_STATUSES, ...extra];
  }
  function statusCount(status) { return DATA.filter(r => (r.status || 'TANPA STATUS') === status).length; }
  function qtyTotal() { return DATA.reduce((acc, r) => acc + (r.qty ?? 0), 0); }

  function renderKpis() {
    const kpis = [
      ['Total desain / PO', fmt(DATA.length), 'Jumlah seluruh baris order', '▦'],
      ['Menunggu ACC', fmt(statusCount('TUNGGU ACC')), 'Perlu follow-up customer', '◷'],
      ['Revisi SO', fmt(statusCount('REV SO')), 'Memerlukan revisi', '✎'],
      ['Total QTY', fmt(qtyTotal()), `${fmt(DATA.filter(x => x.qty !== null).length)} baris berisi QTY`, '◈']
    ];
    el('kpis').innerHTML = kpis.map(k => `<article class="kpi"><div class="kpi-top"><span class="kpi-label">${k[0].toUpperCase()}</span><span class="kpi-icon">${k[3]}</span></div><div class="num">${k[1]}</div><div class="hint">${escapeHtml(k[2])}</div></article>`).join('');
  }

  function renderStatus() {
    const statuses = allStatuses();
    let offset = 0;
    const slices = statuses.map(status => {
      const next = offset + (DATA.length ? statusCount(status) / DATA.length * 100 : 0);
      const slice = `${PALETTE[status] || '#b8b7c9'} ${offset}% ${next}%`;
      offset = next; return slice;
    });
    el('donut').style.background = DATA.length ? `conic-gradient(${slices.join(',')})` : '#efedf6';
    el('donutTotal').textContent = fmt(DATA.length);
    el('legend').innerHTML = statuses.map(status => `<div class="leg"><span class="swatch" style="background:${PALETTE[status] || '#b8b7c9'}"></span><span>${escapeHtml(status)}</span><strong>${fmt(statusCount(status))}</strong></div>`).join('');
  }

  function renderMonthly() {
    const counts = new Map();
    DATA.forEach(r => { if (/^\d{4}-\d{2}-\d{2}$/.test(r.tgl)) counts.set(r.tgl.slice(0, 7), (counts.get(r.tgl.slice(0, 7)) || 0) + 1); });
    const allMonths = [...counts.keys()].sort();
    const visible = allMonths.slice(-8);
    const maxCount = Math.max(1, ...visible.map(m => counts.get(m)));
    const label = (ym) => `${MONTHS_ID[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
    el('monthChart').innerHTML = visible.map((ym, i) => `<div class="bar-col ${i === visible.length - 1 ? 'highlight' : ''}" title="${label(ym)}: ${counts.get(ym)} desain / PO"><div class="bar-number">${fmt(counts.get(ym))}</div><div class="bar" style="height:${Math.max(6, (counts.get(ym) / maxCount) * 120)}px"></div></div>`).join('');
    el('monthLabels').innerHTML = visible.map(ym => `<span>${MONTHS_ID[Number(ym.slice(5, 7)) - 1]}</span>`).join('');
    el('monthRange').textContent = visible.length ? (visible.length === 1 ? label(visible[0]) : `${label(visible[0])} – ${label(visible[visible.length - 1])}`) : 'Belum ada tanggal';
    el('trendFoot').textContent = 'Grafik dihitung ulang saat baris baru ditambahkan.';
  }

  function renderFollowUp() {
    const pending = DATA.filter(r => r.status === 'TUNGGU ACC').sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id);
    el('taskItems').innerHTML = pending.length
      ? pending.slice(0, 5).map(r => `<div class="task-row"><div class="task-id"><div class="task-avatar">✿</div><div><strong>${escapeHtml(r.design)}</strong><span>${dateFmt(r.tgl)} · ${escapeHtml(r.warna)}</span></div></div><span class="chip chip-wait">TUNGGU ACC</span></div>`).join('')
      : '<div class="empty">Tidak ada desain menunggu ACC 🎉</div>';
  }

  function renderInsights() {
    el('qtyTotal').textContent = fmt(qtyTotal());
    const missing = DATA.filter(r => r.qty === null).length;
    el('insights').textContent = `${fmt(statusCount('ACC') + statusCount('REPEAT'))} baris berstatus ACC / REPEAT. ${fmt(missing)} dari ${fmt(DATA.length)} baris belum memiliki QTY. Angka QTY kosong tidak dianggap pesanan nol.`;
    el('qtyNote').textContent = `ℹ️ ${fmt(missing)} baris QTY masih kosong. Tambah atau edit QTY di Google Sheets agar total unit terhitung otomatis.`;
    const colorCount = {};
    DATA.forEach(r => (r.warna || '').split(/[,/]/).forEach(t => { const color = t.trim(); if (color) colorCount[color] = (colorCount[color] || 0) + 1; }));
    el('colorTags').innerHTML = Object.entries(colorCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([color, n]) => `<span class="soft-tag">${escapeHtml(color)} · ${fmt(n)} desain</span>`).join('');
  }

  function setOptions(select, items, emptyLabel) {
    const previous = select.value;
    select.innerHTML = `<option value="">${emptyLabel}</option>` + items.map(({ value, label }) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
    if (items.some(i => i.value === previous)) select.value = previous;
  }
  function renderFilters() {
    setOptions(el('status'), allStatuses().map(s => ({ value: s, label: s })), 'Semua status');
    const months = [...new Set(DATA.map(r => r.tgl.slice(0, 7)).filter(v => /^\d{4}-\d{2}$/.test(v)))].sort().reverse();
    setOptions(el('month'), months.map(m => ({ value: m, label: `${MONTHS_ID[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}` })), 'Semua bulan');
    const customers = [...new Set(DATA.map(r => r.customer).filter(Boolean))].sort();
    setOptions(el('customer'), customers.map(c => ({ value: c, label: c })), 'Semua customer');
  }

  function filtered() {
    const q = el('q').value.trim().toLocaleLowerCase('id-ID');
    const status = el('status').value, month = el('month').value, customer = el('customer').value;
    return [...DATA].sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id)
      .filter(r => (!q || [r.design, r.warna, r.kode, r.customer, r.status, r.tgl].some(v => String(v || '').toLocaleLowerCase('id-ID').includes(q)))
        && (!status || r.status === status) && (!month || r.tgl.startsWith(month)) && (!customer || r.customer === customer));
  }

  function renderTable() {
    const entries = filtered();
    el('tbody').innerHTML = entries.length ? entries.map(r => `<tr><td>${dateFmt(r.tgl)}</td><td><span class="design-name">${escapeHtml(r.design)}</span></td><td>${escapeHtml(r.warna)}</td><td class="qty">${r.qty === null ? '—' : fmt(r.qty)}</td><td>${escapeHtml(r.customer)}</td><td><span class="code">${escapeHtml(r.kode || '—')}</span></td><td><span class="chip ${CHIPS[r.status] || 'chip-so'}">${escapeHtml(r.status || 'TANPA STATUS')}</span></td></tr>`).join('')
      : '<tr><td colspan="7" class="empty">Tidak ada data yang cocok. Coba reset filter.</td></tr>';
    el('showCount').textContent = `Menampilkan ${fmt(entries.length)} dari ${fmt(DATA.length)} baris`;
  }

  function renderAll() {
    renderKpis(); renderStatus(); renderMonthly(); renderFollowUp(); renderInsights(); renderFilters(); renderTable();
    const validDates = DATA.map(r => r.tgl).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    el('lastDate').innerHTML = '<span class="dot"></span>' + (validDates.length ? `Data s.d. ${dateFmt(validDates[validDates.length - 1])}` : 'Belum ada tanggal');
  }

  function csvDownload() {
    const rows = [['TGL', 'DESIGN', 'WARNA', 'QTY', 'CUSTOMER', 'KODE', 'KET'], ...filtered().map(r => [r.tgl, r.design, r.warna, r.qty ?? '', r.customer, r.kode, r.status])];
    const text = '\uFEFF' + rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'mercy_desain_export.csv';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function getSheetInfo() {
    const url = String(CONFIG.sheetUrl || '').trim();
    if (!url) return null;
    const match = url.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/i);
    if (!match) throw new Error('Link di config.js harus berupa link Google Sheets, contoh https://docs.google.com/spreadsheets/d/ID/edit#gid=0');
    const gidFromUrl = url.match(/(?:[?#&])gid=(\d+)/);
    const gid = /^\d+$/.test(String(CONFIG.sheetGid || '')) ? String(CONFIG.sheetGid) : gidFromUrl ? gidFromUrl[1] : '0';
    return { id: match[1], gid, url };
  }

  function fetchGviz(info) {
    return new Promise((resolve, reject) => {
      const cb = `__mercy_sheet_callback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
      const script = document.createElement('script');
      let finished = false;
      const finish = (error, value) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        script.remove();
        try { delete window[cb]; } catch (_) { window[cb] = undefined; }
        if (error) reject(error); else resolve(value);
      };
      const timeout = setTimeout(() => finish(new Error('Google Sheets tidak merespons. Periksa koneksi atau pengaturan Share.')), 18000);
      window[cb] = (response) => finish(null, response);
      const url = new URL(`https://docs.google.com/spreadsheets/d/${info.id}/gviz/tq`);
      url.searchParams.set('gid', info.gid);
      url.searchParams.set('headers', '1');
      url.searchParams.set('tqx', `out:json;responseHandler:${cb}`);
      url.searchParams.set('nocache', String(Date.now()));
      script.src = url.toString();
      script.async = true;
      script.onerror = () => finish(new Error('Gagal membaca Google Sheets. Pastikan di-share sebagai Anyone with the link → Viewer.'));
      document.head.appendChild(script);
    });
  }

  function readGviz(response) {
    if (!response || response.status !== 'ok' || !response.table || !response.table.cols) {
      const detail = response && response.errors && response.errors[0] && (response.errors[0].detailed_message || response.errors[0].message);
      throw new Error(detail || 'Google Sheets belum bisa dibaca. Pastikan link, izin Viewer, dan sheetGid benar.');
    }
    const headers = response.table.cols.map(c => c.label || '');
    const rows = (response.table.rows || []).map(r => (r.c || []).map(c => c && c.v !== undefined ? c.v : ''));
    return rowsToRecords(headers, rows);
  }

  async function loadLocal() {
    if (location.protocol === 'file:') return false;
    const response = await fetch('./data.csv?v=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Gagal memuat data.csv');
    const records = parseCSV(await response.text());
    DATA = records;
    renderAll();
    return true;
  }

  async function reload() {
    if (loading) return;
    loading = true;
    el('refreshBtn').disabled = true;
    const info = (() => { try { return getSheetInfo(); } catch (error) { sourceState('error', 'Konfigurasi Google Sheets salah', error.message); return 'invalid'; } })();
    if (info === 'invalid') { loading = false; el('refreshBtn').disabled = false; return; }
    if (info) {
      sourceState('pending', 'Mengambil data Google Sheets…', 'Sedang menyinkronkan desain dan PO terbaru.');
      try {
        const response = await fetchGviz(info);
        const records = readGviz(response);
        DATA = records;
        successfulLiveSync = true;
        renderAll();
        lastSyncLabel = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
        sourceState('live', 'Terhubung ke Google Sheets ✓', `${fmt(records.length)} baris berhasil dibaca · Update terakhir ${lastSyncLabel}. Refresh otomatis tiap ${Number(CONFIG.autoRefreshMinutes) || 5} menit.`);
      } catch (error) {
        if (!successfulLiveSync) {
          try { await loadLocal(); } catch (_) { /* Data awal masih tersedia di data.js */ }
        }
        sourceState('error', 'Tidak bisa sinkron ke Google Sheets', `${error.message} Menampilkan ${successfulLiveSync ? 'hasil sinkron terakhir' : 'data cadangan'}, bukan data terbaru.`);
      }
    } else {
      try {
        if (await loadLocal()) sourceState('ready', 'Mode CSV GitHub aktif', 'Data dibaca dari data.csv. Untuk otomatis dari Google Sheets, isi sheetUrl pada config.js.');
      } catch (_) {
        sourceState('ready', 'Mode data awal', 'Menampilkan data bawaan. Jika online, periksa apakah data.csv ikut diunggah ke GitHub.');
      }
    }
    loading = false;
    el('refreshBtn').disabled = false;
  }

  ['q', 'status', 'month', 'customer'].forEach(id => el(id).addEventListener(id === 'q' ? 'input' : 'change', renderTable));
  el('clearBtn').addEventListener('click', () => {
    ['q', 'status', 'month', 'customer'].forEach(id => { el(id).value = ''; });
    renderTable();
  });
  el('seeAllWaiting').addEventListener('click', () => {
    el('q').value = ''; el('month').value = ''; el('customer').value = '';
    el('status').value = 'TUNGGU ACC'; renderTable();
    el('database').scrollIntoView({ behavior: 'smooth' });
  });
  el('exportBtn').addEventListener('click', csvDownload);
  el('refreshBtn').addEventListener('click', reload);

  let sheetInfo = null;
  try { sheetInfo = getSheetInfo(); } catch (_) { /* Error ditunjukkan saat reload */ }
  if (sheetInfo) {
    el('editSheetBtn').href = sheetInfo.url;
    el('editSheetBtn').hidden = false;
  }
  el('refreshBtn').hidden = false;
  renderAll();
  reload();
  const refreshEvery = Number(CONFIG.autoRefreshMinutes) || 5;
  if (sheetInfo && refreshEvery > 0 && refreshEvery <= 1440) {
    setInterval(() => { if (!document.hidden) reload(); }, refreshEvery * 60 * 1000);
  }
})();
