// admin-app.js - Admin Dashboard Logic for Syntiox Ideas

(function () {
  'use strict';

  const API_BASE = '/api';

  // ── Auth Check ─────────────────────────────────────────────────────────────
  const token = localStorage.getItem('syntiox_admin_token');
  if (!token) { window.location.href = '/login.html'; }

  // ── State ──────────────────────────────────────────────────────────────────
  let allSubmissions  = [];
  let filteredData    = [];
  let currentFilter   = 'all';
  let searchQuery     = '';
  let pendingDeleteId = null;
  let pendingAction   = null; // 'single' | 'bulk' | 'deleteAll'
  let selectedIds     = new Set();
  let selectMode      = false;
  let toastTimer      = null;

  // ── DOM References ─────────────────────────────────────────────────────────
  const submissionsGrid = document.getElementById('submissionsGrid');
  const resultCount     = document.getElementById('resultCount');
  const searchInput     = document.getElementById('searchInput');
  const refreshBtn      = document.getElementById('refreshBtn');
  const logoutBtn       = document.getElementById('logoutBtn');
  const adminClock      = document.getElementById('adminClock');
  const lightbox        = document.getElementById('lightbox');
  const lightboxImg     = document.getElementById('lightboxImg');
  const confirmOverlay  = document.getElementById('confirmOverlay');
  const confirmTitle    = document.getElementById('confirmTitle');
  const confirmText     = document.getElementById('confirmText');
  const confirmIcon     = document.getElementById('confirmIcon');
  const confirmCancel   = document.getElementById('confirmCancel');
  const confirmDelete   = document.getElementById('confirmDelete');
  const adminToast      = document.getElementById('adminToast');
  const adminToastIcon  = document.getElementById('adminToastIcon');
  const adminToastMsg   = document.getElementById('adminToastMsg');
  // Bulk controls
  const selectModeBtn   = document.getElementById('selectModeBtn');
  const deleteAllBtn    = document.getElementById('deleteAllBtn');
  const bulkBar         = document.getElementById('bulkBar');
  const bulkCount       = document.getElementById('bulkCount');
  const bulkDeleteBtn   = document.getElementById('bulkDeleteBtn');
  const bulkCancelBtn   = document.getElementById('bulkCancelBtn');

  // ── Live Clock ─────────────────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    adminClock.textContent = now.toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ── Fetch Submissions ──────────────────────────────────────────────────────
  async function fetchSubmissions() {
    refreshBtn.classList.add('spinning');
    refreshBtn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/submissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('syntiox_admin_token');
        window.location.href = '/login.html';
        return;
      }
      if (!res.ok) throw new Error('Failed to load submissions.');
      const data = await res.json();
      allSubmissions = data.submissions || [];
      updateStats(data.stats);
      exitSelectMode();
      applyFilters();
      showAdminToast(`${allSubmissions.length} submission${allSubmissions.length !== 1 ? 's' : ''} loaded.`, 'success');
    } catch (err) {
      showAdminToast(err.message, 'error');
      renderError();
    } finally {
      refreshBtn.classList.remove('spinning');
      refreshBtn.disabled = false;
    }
  }

  // ── Stats Cards ────────────────────────────────────────────────────────────
  function updateStats(stats) {
    if (!stats) return;
    document.getElementById('stat-total').textContent    = stats.total ?? 0;
    document.getElementById('stat-idea').textContent     = stats.byCategory?.idea ?? 0;
    document.getElementById('stat-bug').textContent      = stats.byCategory?.bug ?? 0;
    document.getElementById('stat-feedback').textContent = stats.byCategory?.feedback ?? 0;
    document.getElementById('stat-qa').textContent       = stats.byCategory?.qa ?? 0;
    document.getElementById('stat-general').textContent  = stats.byCategory?.general ?? 0;
  }

  // ── Filter Pills ───────────────────────────────────────────────────────────
  document.getElementById('filtersBar').addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    currentFilter = pill.dataset.filter;
    document.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.remove('active');
      p.setAttribute('aria-pressed', 'false');
    });
    pill.classList.add('active');
    pill.setAttribute('aria-pressed', 'true');
    exitSelectMode();
    applyFilters();
  });

  // ── Search ─────────────────────────────────────────────────────────────────
  let searchDebounce = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchQuery = searchInput.value.trim().toLowerCase();
      exitSelectMode();
      applyFilters();
    }, 250);
  });

  // ── Apply Filters ──────────────────────────────────────────────────────────
  function applyFilters() {
    filteredData = allSubmissions.filter(s => {
      const matchCat = currentFilter === 'all' || s.category === currentFilter;
      const matchSearch = !searchQuery ||
        s.name.toLowerCase().includes(searchQuery) ||
        s.message.toLowerCase().includes(searchQuery) ||
        (s.contact && s.contact.toLowerCase().includes(searchQuery));
      return matchCat && matchSearch;
    });
    resultCount.textContent = `${filteredData.length} result${filteredData.length !== 1 ? 's' : ''}`;
    renderSubmissions(filteredData);
  }

  // ── Render Submissions ─────────────────────────────────────────────────────
  function renderSubmissions(items) {
    if (!items || items.length === 0) {
      submissionsGrid.innerHTML = `
        <div style="grid-column:1/-1;">
          <div class="empty-state">
            <div class="empty-icon" aria-hidden="true">${searchQuery ? '🔍' : '📭'}</div>
            <div class="empty-title">${searchQuery ? 'No results found' : 'No submissions yet'}</div>
            <p class="empty-text">${searchQuery ? `No submissions match "${escapeHtml(searchQuery)}"` : 'Share the Ideas Portal link!'}</p>
          </div>
        </div>`;
      return;
    }
    submissionsGrid.innerHTML = items.map((s, i) => buildCard(s, i)).join('');

    // Attach listeners
    submissionsGrid.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openConfirmSingle(btn.dataset.id); });
    });
    submissionsGrid.querySelectorAll('.sub-card-photo').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.src, img.alt));
    });
    submissionsGrid.querySelectorAll('.card-checkbox').forEach(cb => {
      cb.addEventListener('change', () => toggleSelection(cb.dataset.id, cb.checked));
    });
    // Click card to select in select mode
    submissionsGrid.querySelectorAll('.sub-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!selectMode) return;
        if (e.target.closest('.btn-delete') || e.target.closest('.sub-card-photo')) return;
        const id = card.dataset.id;
        const cb = card.querySelector('.card-checkbox');
        if (cb) { cb.checked = !cb.checked; toggleSelection(id, cb.checked); }
      });
    });

    // Apply select mode class if active
    if (selectMode) submissionsGrid.classList.add('select-mode');
  }

  // ── Build Card HTML ────────────────────────────────────────────────────────
  function buildCard(s, index) {
    const catIcons    = { idea: '💡', bug: '🐛', feedback: '💬', qa: '❓', general: '📌' };
    const contactIcons = { telegram: '✈️', whatsapp: '💬', number: '📞', none: '🙈' };
    const statusLabels = { new: '🆕 New', reviewed: '👀 Reviewed', resolved: '✅ Resolved' };

    const date = new Date(s.createdAt);
    const formattedDate = isNaN(date) ? s.createdAt : date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    const contactBadge = s.contactType !== 'none' && s.contact
      ? `<span class="sub-contact-badge ${s.contactType}">${contactIcons[s.contactType] || '📱'} ${escapeHtml(s.contact)}</span>`
      : `<span class="sub-contact-badge" style="color:var(--text-muted);">🙈 Anonymous</span>`;

    const photoSection = s.hasPhoto && s.photo
      ? `<img class="sub-card-photo" src="${s.photo}" alt="Screenshot from ${escapeHtml(s.name)}" loading="lazy">`
      : '';

    const msgPreview = s.message.length > 280
      ? escapeHtml(s.message.slice(0, 280)) + '<span style="color:var(--text-muted);">…</span>'
      : escapeHtml(s.message);

    const isSelected = selectedIds.has(s._id);

    return `
      <article class="sub-card${isSelected ? ' selected' : ''}" style="animation-delay:${index * 0.04}s" data-id="${escapeHtml(s._id)}">
        <input type="checkbox" class="card-checkbox" data-id="${escapeHtml(s._id)}" ${isSelected ? 'checked' : ''} aria-label="Select submission by ${escapeHtml(s.name)}">
        <div class="sub-card-header">
          <div class="sub-card-meta">
            <div class="sub-name">${escapeHtml(s.name)}</div>
            <div class="sub-time" title="${escapeHtml(s.createdAt)}">${formattedDate}</div>
          </div>
          ${contactBadge}
        </div>
        <div class="sub-card-tags">
          <span class="cat-tag ${s.category}">${catIcons[s.category] || '📌'} ${capitalize(s.category)}</span>
          <span class="status-badge ${s.status || 'new'}">${statusLabels[s.status] || '🆕 New'}</span>
          ${s.hasPhoto ? '<span style="font-size:11px;color:var(--text-muted);">📸 Photo</span>' : ''}
        </div>
        ${photoSection}
        <div class="sub-card-body"><p class="sub-message">${msgPreview}</p></div>
        <div class="sub-card-footer">
          <span style="font-size:11px;color:var(--text-muted);">ID: ${escapeHtml(String(s._id)).slice(0, 14)}…</span>
          <button class="btn-delete" data-id="${escapeHtml(String(s._id))}" aria-label="Delete submission">🗑 Delete</button>
        </div>
      </article>`;
  }

  function renderError() {
    submissionsGrid.innerHTML = `
      <div style="grid-column:1/-1;">
        <div class="empty-state">
          <div class="empty-icon" aria-hidden="true">⚠️</div>
          <div class="empty-title">Failed to load submissions</div>
          <p class="empty-text">Check your network or API configuration.</p>
        </div>
      </div>`;
  }

  // ── Selection Logic ────────────────────────────────────────────────────────
  function toggleSelection(id, checked) {
    if (checked) selectedIds.add(id); else selectedIds.delete(id);
    const card = submissionsGrid.querySelector(`.sub-card[data-id="${CSS.escape(id)}"]`);
    if (card) card.classList.toggle('selected', checked);
    updateBulkBar();
  }

  function updateBulkBar() {
    const count = selectedIds.size;
    bulkCount.textContent = `${count} submission${count !== 1 ? 's' : ''} selected`;
    bulkBar.classList.toggle('visible', count > 0);
  }

  function enterSelectMode() {
    selectMode = true;
    selectedIds.clear();
    submissionsGrid.classList.add('select-mode');
    selectModeBtn.classList.add('active');
    selectModeBtn.textContent = '✕ Exit Select';
    bulkBar.classList.remove('visible');
    updateBulkBar();
  }

  function exitSelectMode() {
    selectMode = false;
    selectedIds.clear();
    submissionsGrid.classList.remove('select-mode');
    selectModeBtn.classList.remove('active');
    selectModeBtn.innerHTML = '☑ Select';
    bulkBar.classList.remove('visible');
  }

  selectModeBtn.addEventListener('click', () => {
    if (selectMode) exitSelectMode();
    else enterSelectMode();
  });

  // ── Delete All Button ──────────────────────────────────────────────────────
  deleteAllBtn.addEventListener('click', () => {
    const catLabel = currentFilter === 'all' ? 'ALL submissions' : `all ${capitalize(currentFilter)} submissions`;
    const count = filteredData.length;
    if (count === 0) { showAdminToast('No submissions to delete.', 'error'); return; }
    openConfirmDialog(
      '⚠️',
      `Delete ${catLabel}?`,
      `This will permanently delete ${count} submission${count !== 1 ? 's' : ''} from the database. This cannot be undone!`,
      'deleteAll'
    );
  });

  // ── Bulk Delete Button ─────────────────────────────────────────────────────
  bulkDeleteBtn.addEventListener('click', () => {
    const count = selectedIds.size;
    if (count === 0) { showAdminToast('No submissions selected.', 'error'); return; }
    openConfirmDialog(
      '🗑️',
      `Delete ${count} submission${count !== 1 ? 's' : ''}?`,
      `This will permanently delete the selected ${count} submission${count !== 1 ? 's' : ''} from the database. This cannot be undone!`,
      'bulk'
    );
  });

  bulkCancelBtn.addEventListener('click', exitSelectMode);

  // ── Confirm Dialog ─────────────────────────────────────────────────────────
  function openConfirmSingle(id) {
    pendingDeleteId = id;
    openConfirmDialog('🗑️', 'Delete Submission?', 'This action cannot be undone. The submission will be permanently removed from the database.', 'single');
  }

  function openConfirmDialog(icon, title, text, action) {
    pendingAction = action;
    confirmIcon.textContent  = icon;
    confirmTitle.textContent = title;
    confirmText.textContent  = text;
    confirmOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  confirmCancel.addEventListener('click', closeConfirm);
  confirmOverlay.addEventListener('click', (e) => { if (e.target === confirmOverlay) closeConfirm(); });

  function closeConfirm() {
    confirmOverlay.classList.remove('show');
    document.body.style.overflow = '';
    pendingDeleteId = null;
    pendingAction = null;
  }

  confirmDelete.addEventListener('click', async () => {
    confirmDelete.disabled = true;
    confirmDelete.textContent = 'Deleting...';

    try {
      let url = '';
      if (pendingAction === 'single') {
        url = `${API_BASE}/submissions?id=${encodeURIComponent(pendingDeleteId)}`;
      } else if (pendingAction === 'bulk') {
        const ids = Array.from(selectedIds).join(',');
        url = `${API_BASE}/submissions?ids=${encodeURIComponent(ids)}`;
      } else if (pendingAction === 'deleteAll') {
        const catParam = currentFilter !== 'all' ? `&category=${encodeURIComponent(currentFilter)}` : '';
        url = `${API_BASE}/submissions?deleteAll=true${catParam}`;
      }

      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed.');

      const msg = data.message || 'Deleted successfully.';
      showAdminToast(msg, 'success');

      // Refresh data from server
      await fetchSubmissions();

    } catch (err) {
      showAdminToast(err.message, 'error');
    } finally {
      confirmDelete.disabled = false;
      confirmDelete.textContent = 'Delete';
      closeConfirm();
    }
  });

  // ── Lightbox ───────────────────────────────────────────────────────────────
  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || 'Submission photo';
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  lightbox.addEventListener('click', () => {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { lightboxImg.src = ''; }, 300);
  });

  // ── Keyboard ───────────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (lightbox.classList.contains('open')) lightbox.click();
      if (confirmOverlay.classList.contains('show')) closeConfirm();
      if (selectMode) exitSelectMode();
    }
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('syntiox_admin_token');
    localStorage.removeItem('syntiox_token_time');
    window.location.href = '/login.html';
  });

  refreshBtn.addEventListener('click', fetchSubmissions);

  // ── Toast ──────────────────────────────────────────────────────────────────
  function showAdminToast(message, type = 'success') {
    if (toastTimer) clearTimeout(toastTimer);
    adminToastIcon.textContent = type === 'success' ? '✅' : '⚠️';
    adminToastMsg.textContent  = message;
    adminToast.className = `toast-admin ${type} show`;
    toastTimer = setTimeout(() => { adminToast.classList.remove('show'); }, 3500);
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  // ── Token Expiry Check ─────────────────────────────────────────────────────
  function checkTokenExpiry() {
    const tokenTime = localStorage.getItem('syntiox_token_time');
    if (tokenTime && Date.now() - parseInt(tokenTime, 10) > 8 * 3600 * 1000) {
      localStorage.removeItem('syntiox_admin_token');
      localStorage.removeItem('syntiox_token_time');
      window.location.href = '/login.html';
    }
  }
  setInterval(checkTokenExpiry, 5 * 60 * 1000);

  // ── Init ───────────────────────────────────────────────────────────────────
  checkTokenExpiry();
  fetchSubmissions();

})();
