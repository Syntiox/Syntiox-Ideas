// admin-app.js - Admin Dashboard Logic for Syntiox Ideas

(function () {
  'use strict';

  const API_BASE = '/api';

  // ── Auth Check ─────────────────────────────────────────────────────────────
  const token = localStorage.getItem('syntiox_admin_token');
  if (!token) {
    window.location.href = '/login.html';
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let allSubmissions   = [];
  let filteredData     = [];
  let currentFilter    = 'all';
  let searchQuery      = '';
  let pendingDeleteId  = null;
  let toastTimer       = null;

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
  const confirmCancel   = document.getElementById('confirmCancel');
  const confirmDelete   = document.getElementById('confirmDelete');
  const adminToast      = document.getElementById('adminToast');
  const adminToastIcon  = document.getElementById('adminToastIcon');
  const adminToastMsg   = document.getElementById('adminToastMsg');

  // ── Clock ──────────────────────────────────────────────────────────────────
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

  // ── Update Stats Cards ─────────────────────────────────────────────────────
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

    applyFilters();
  });

  // ── Search ─────────────────────────────────────────────────────────────────
  let searchDebounce = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchQuery = searchInput.value.trim().toLowerCase();
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
            <p class="empty-text">${searchQuery ? `No submissions match "${searchQuery}"` : 'Share the Ideas Portal link and wait for submissions to come in!'}</p>
          </div>
        </div>`;
      return;
    }

    submissionsGrid.innerHTML = items.map((s, i) => buildCard(s, i)).join('');

    // Attach delete handlers
    submissionsGrid.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => openConfirmDelete(btn.dataset.id));
    });

    // Attach photo lightbox
    submissionsGrid.querySelectorAll('.sub-card-photo').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.src, img.alt));
    });
  }

  // ── Build Card HTML ────────────────────────────────────────────────────────
  function buildCard(s, index) {
    const catIcons = { idea: '💡', bug: '🐛', feedback: '💬', qa: '❓', general: '📌' };
    const contactIcons = { telegram: '✈️', whatsapp: '💬', number: '📞', none: '🙈' };
    const statusLabels = { new: '🆕 New', reviewed: '👀 Reviewed', resolved: '✅ Resolved' };

    const date = new Date(s.createdAt);
    const formattedDate = isNaN(date) ? s.createdAt : date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    const contactBadge = s.contactType !== 'none' && s.contact
      ? `<span class="sub-contact-badge ${s.contactType}" title="${s.contactType}">
           ${contactIcons[s.contactType] || '📱'} ${escapeHtml(s.contact)}
         </span>`
      : `<span class="sub-contact-badge" style="color:var(--text-muted);">🙈 Anonymous</span>`;

    const photoSection = s.hasPhoto && s.photo
      ? `<img class="sub-card-photo" src="${s.photo}" alt="Screenshot from ${escapeHtml(s.name)}" loading="lazy">`
      : '';

    const messagePreview = s.message.length > 280
      ? escapeHtml(s.message.slice(0, 280)) + '<span style="color:var(--text-muted);">…</span>'
      : escapeHtml(s.message);

    return `
      <article class="sub-card" style="animation-delay:${index * 0.04}s" data-id="${escapeHtml(s._id)}">
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
          ${s.hasPhoto ? '<span style="font-size:11px; color:var(--text-muted);">📸 Photo attached</span>' : ''}
        </div>
        ${photoSection}
        <div class="sub-card-body">
          <p class="sub-message">${messagePreview}</p>
        </div>
        <div class="sub-card-footer">
          <span style="font-size:11px; color:var(--text-muted);">ID: ${escapeHtml(String(s._id)).slice(0, 12)}…</span>
          <button class="btn-delete" data-id="${escapeHtml(String(s._id))}" aria-label="Delete submission from ${escapeHtml(s.name)}">
            🗑 Delete
          </button>
        </div>
      </article>`;
  }

  // ── Render Error ───────────────────────────────────────────────────────────
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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (lightbox.classList.contains('open')) lightbox.click();
      if (confirmOverlay.classList.contains('show')) confirmCancel.click();
    }
  });

  // ── Delete Confirmation ────────────────────────────────────────────────────
  function openConfirmDelete(id) {
    pendingDeleteId = id;
    confirmOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  confirmCancel.addEventListener('click', () => {
    confirmOverlay.classList.remove('show');
    document.body.style.overflow = '';
    pendingDeleteId = null;
  });

  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) confirmCancel.click();
  });

  confirmDelete.addEventListener('click', async () => {
    if (!pendingDeleteId) return;

    confirmDelete.disabled = true;
    confirmDelete.textContent = 'Deleting...';

    try {
      const res = await fetch(`${API_BASE}/submissions?id=${encodeURIComponent(pendingDeleteId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed.');
      }

      // Remove from local state
      allSubmissions = allSubmissions.filter(s => String(s._id) !== pendingDeleteId);
      applyFilters();

      // Update stats
      const newStats = {
        total: allSubmissions.length,
        byCategory: {
          idea:     allSubmissions.filter(s => s.category === 'idea').length,
          bug:      allSubmissions.filter(s => s.category === 'bug').length,
          feedback: allSubmissions.filter(s => s.category === 'feedback').length,
          qa:       allSubmissions.filter(s => s.category === 'qa').length,
          general:  allSubmissions.filter(s => s.category === 'general').length,
        }
      };
      updateStats(newStats);

      showAdminToast('Submission deleted successfully.', 'success');

    } catch (err) {
      showAdminToast(err.message, 'error');
    } finally {
      confirmDelete.disabled = false;
      confirmDelete.textContent = 'Delete';
      confirmOverlay.classList.remove('show');
      document.body.style.overflow = '';
      pendingDeleteId = null;
    }
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('syntiox_admin_token');
    localStorage.removeItem('syntiox_token_time');
    window.location.href = '/login.html';
  });

  // ── Refresh ────────────────────────────────────────────────────────────────
  refreshBtn.addEventListener('click', fetchSubmissions);

  // ── Toast ──────────────────────────────────────────────────────────────────
  function showAdminToast(message, type = 'success') {
    if (toastTimer) clearTimeout(toastTimer);
    adminToastIcon.textContent = type === 'success' ? '✅' : '⚠️';
    adminToastMsg.textContent  = message;
    adminToast.className = `toast-admin ${type} show`;
    toastTimer = setTimeout(() => { adminToast.classList.remove('show'); }, 3500);
  }

  // ── Utility ────────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  // ── Token Expiry Check ─────────────────────────────────────────────────────
  function checkTokenExpiry() {
    const tokenTime = localStorage.getItem('syntiox_token_time');
    if (tokenTime) {
      const elapsed = Date.now() - parseInt(tokenTime, 10);
      const eightHours = 8 * 60 * 60 * 1000;
      if (elapsed > eightHours) {
        localStorage.removeItem('syntiox_admin_token');
        localStorage.removeItem('syntiox_token_time');
        window.location.href = '/login.html';
      }
    }
  }

  // Check every 5 minutes
  setInterval(checkTokenExpiry, 5 * 60 * 1000);

  // ── Init ───────────────────────────────────────────────────────────────────
  checkTokenExpiry();
  fetchSubmissions();

})();
