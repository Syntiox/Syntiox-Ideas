// app.js - Frontend logic for index.html (Syntiox Ideas Portal)

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  const API_BASE = '/api';

  const CATEGORY_CONFIG = {
    idea:     { label: 'Idea',        icon: '💡', placeholder: 'Describe your idea in detail. What problem does it solve? How could it improve Syntiox?' },
    bug:      { label: 'Bug Report',  icon: '🐛', placeholder: 'Describe the bug. What happened? What did you expect? Steps to reproduce...' },
    feedback: { label: 'Feedback',    icon: '💬', placeholder: 'Share your experience. What do you love? What could be better?' },
    qa:       { label: 'Q&A',         icon: '❓', placeholder: 'Ask anything about Syntiox. Our team will do their best to answer!' },
    general:  { label: 'General',     icon: '📌', placeholder: 'Share anything on your mind regarding Syntiox...' },
  };

  const CONTACT_CONFIG = {
    telegram: { label: 'Telegram Username', placeholder: '@yourusername', inputType: 'text' },
    whatsapp: { label: 'WhatsApp Number',   placeholder: '+94 77 123 4567', inputType: 'tel' },
    number:   { label: 'Phone Number',      placeholder: '+94 77 123 4567', inputType: 'tel' },
    none:     { label: 'Anonymous',         placeholder: '',               inputType: 'text' },
  };

  // ── DOM References ─────────────────────────────────────────────────────────
  const form             = document.getElementById('submitForm');
  const nameInput        = document.getElementById('nameInput');
  const contactValue     = document.getElementById('contactValue');
  const contactLabel     = document.getElementById('contactLabel');
  const contactValueGroup= document.getElementById('contactValueGroup');
  const messageInput     = document.getElementById('messageInput');
  const charCount        = document.getElementById('charCount');
  const selectedCategory = document.getElementById('selectedCategory');
  const submitBtn        = document.getElementById('submitBtn');
  const btnText          = document.getElementById('btnText');
  const btnIcon          = document.getElementById('btnIcon');
  const photoInput       = document.getElementById('photoInput');
  const photoPreview     = document.getElementById('photoPreview');
  const previewImg       = document.getElementById('previewImg');
  const removePhoto      = document.getElementById('removePhoto');
  const uploadPlaceholder= document.getElementById('uploadPlaceholder');
  const photoUploadArea  = document.getElementById('photoUploadArea');
  const successOverlay   = document.getElementById('successOverlay');
  const closeSuccess     = document.getElementById('closeSuccess');
  const toast            = document.getElementById('toast');
  const toastIcon        = document.getElementById('toastIcon');
  const toastMessage     = document.getElementById('toastMessage');

  let currentCategory    = 'idea';
  let currentContact     = 'telegram';
  let photoBase64        = null;
  let toastTimer         = null;

  // ── Category Pill Selection ────────────────────────────────────────────────
  document.getElementById('categoryPills').addEventListener('click', (e) => {
    const pill = e.target.closest('.category-pill');
    if (!pill) return;

    const cat = pill.dataset.cat;
    currentCategory = cat;
    selectedCategory.value = cat;

    document.querySelectorAll('.category-pill').forEach(p => {
      p.classList.remove('active');
      p.setAttribute('aria-pressed', 'false');
    });
    pill.classList.add('active');
    pill.setAttribute('aria-pressed', 'true');

    // Update textarea placeholder
    if (CATEGORY_CONFIG[cat]) {
      messageInput.placeholder = CATEGORY_CONFIG[cat].placeholder;
    }
  });

  // ── Contact Type Selection ─────────────────────────────────────────────────
  document.getElementById('contactTypeGroup').addEventListener('click', (e) => {
    const btn = e.target.closest('.contact-type-btn');
    if (!btn) return;

    const type = btn.dataset.contact;
    currentContact = type;

    document.querySelectorAll('.contact-type-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');

    // Update contact input
    if (type === 'none') {
      contactValueGroup.style.display = 'none';
      contactValue.required = false;
    } else {
      contactValueGroup.style.display = 'flex';
      contactValue.required = true;
      const cfg = CONTACT_CONFIG[type];
      contactLabel.textContent = cfg.label;
      contactValue.placeholder = cfg.placeholder;
      contactValue.type = cfg.inputType;
      contactValue.value = '';
    }
  });

  // ── Character Count ────────────────────────────────────────────────────────
  messageInput.addEventListener('input', () => {
    const count = messageInput.value.length;
    charCount.textContent = count;
    charCount.style.color = count > 2700 ? '#ef4444' : count > 2400 ? '#f59e0b' : 'var(--text-muted)';
  });

  // ── Photo Upload ───────────────────────────────────────────────────────────
  photoInput.addEventListener('change', handlePhotoSelect);

  // Drag & drop
  photoUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    photoUploadArea.classList.add('drag-over');
  });
  photoUploadArea.addEventListener('dragleave', () => {
    photoUploadArea.classList.remove('drag-over');
  });
  photoUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    photoUploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processPhotoFile(file);
  });

  removePhoto.addEventListener('click', (e) => {
    e.stopPropagation();
    clearPhoto();
  });

  function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (file) processPhotoFile(file);
  }

  function processPhotoFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo must be smaller than 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      photoBase64 = e.target.result;
      previewImg.src = photoBase64;
      previewImg.alt = `Preview: ${file.name}`;
      uploadPlaceholder.style.display = 'none';
      photoPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    photoBase64 = null;
    photoInput.value = '';
    previewImg.src = '';
    uploadPlaceholder.style.display = 'block';
    photoPreview.style.display = 'none';
  }

  // ── Form Submission ────────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const message = messageInput.value.trim();
    const contact = currentContact !== 'none' ? contactValue.value.trim() : '';

    // Client-side validation
    if (!name || name.length < 2) {
      showToast('Please enter your name (at least 2 characters).', 'error');
      nameInput.focus();
      return;
    }
    if (!message || message.length < 5) {
      showToast('Please write a message (at least 5 characters).', 'error');
      messageInput.focus();
      return;
    }
    if (currentContact !== 'none' && !contact) {
      showToast('Please enter your contact detail or choose Anonymous.', 'error');
      contactValue.focus();
      return;
    }

    // Show loading state
    setLoading(true);

    const payload = {
      name,
      contactType: currentContact,
      contactValue: contact,
      category: currentCategory,
      message,
      photo: photoBase64,
    };

    try {
      const response = await fetch(`${API_BASE}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      }

      if (!response.ok) {
        throw new Error(data.error || `Submission failed (Status ${response.status}).`);
      }

      if (response.ok && !contentType?.includes('application/json')) {
        throw new Error('Server returned an unexpected non-JSON response.');
      }

      // Success!
      setLoading(false);
      showSuccess();

    } catch (error) {
      setLoading(false);
      showToast(error.message || 'Something went wrong. Please try again.', 'error');
    }
  });

  function setLoading(loading) {
    submitBtn.disabled = loading;
    if (loading) {
      btnText.textContent = 'Sending...';
      btnIcon.innerHTML = '<span class="spinner"></span>';
    } else {
      btnText.textContent = 'Send to Syntiox Team';
      btnIcon.textContent = '🚀';
    }
  }

  // ── Success State ──────────────────────────────────────────────────────────
  function showSuccess() {
    successOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  closeSuccess.addEventListener('click', () => {
    successOverlay.classList.remove('show');
    document.body.style.overflow = '';
    form.reset();
    clearPhoto();
    charCount.textContent = '0';
    // Reset to defaults
    currentCategory = 'idea';
    currentContact = 'telegram';
    selectedCategory.value = 'idea';
    document.querySelectorAll('.category-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.cat === 'idea');
      p.setAttribute('aria-pressed', p.dataset.cat === 'idea' ? 'true' : 'false');
    });
    document.querySelectorAll('.contact-type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.contact === 'telegram');
      b.setAttribute('aria-pressed', b.dataset.contact === 'telegram' ? 'true' : 'false');
    });
    contactValueGroup.style.display = 'flex';
    contactLabel.textContent = CONTACT_CONFIG.telegram.label;
    contactValue.placeholder = CONTACT_CONFIG.telegram.placeholder;
    contactValue.type = 'text';
    messageInput.placeholder = CATEGORY_CONFIG.idea.placeholder;
  });

  // Close on backdrop click
  successOverlay.addEventListener('click', (e) => {
    if (e.target === successOverlay) closeSuccess.click();
  });

  // ── Toast Notifications ────────────────────────────────────────────────────
  function showToast(message, type = 'error') {
    if (toastTimer) clearTimeout(toastTimer);

    toastIcon.textContent = type === 'error' ? '⚠️' : '✅';
    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  messageInput.placeholder = CATEGORY_CONFIG.idea.placeholder;
  contactLabel.textContent = CONTACT_CONFIG.telegram.label;
  contactValue.placeholder = CONTACT_CONFIG.telegram.placeholder;

})();
