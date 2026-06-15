// api/submit.js
// POST /api/submit - Handles user feedback submissions

const { connectToDatabase } = require('./db');
const { encrypt } = require('./crypto');

// Helper: CORS headers
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      name,
      contactType,   // 'telegram' | 'whatsapp' | 'number' | 'none'
      contactValue,  // actual contact detail
      category,      // 'idea' | 'bug' | 'feedback' | 'general' | 'qa'
      message,
      photo          // base64 encoded image (optional)
    } = req.body;

    // ── Validation ───────────────────────────────────────────────────────────
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name is required (minimum 2 characters).' });
    }
    if (!message || message.trim().length < 5) {
      return res.status(400).json({ error: 'Message is required (minimum 5 characters).' });
    }
    const validCategories = ['idea', 'bug', 'feedback', 'general', 'qa'];
    if (!category || !validCategories.includes(category)) {
      return res.status(400).json({ error: 'Please select a valid category.' });
    }
    const validContactTypes = ['telegram', 'whatsapp', 'number', 'none'];
    if (!validContactTypes.includes(contactType)) {
      return res.status(400).json({ error: 'Invalid contact type.' });
    }
    if (contactType !== 'none' && (!contactValue || contactValue.trim() === '')) {
      return res.status(400).json({ error: 'Contact value is required for the selected contact type.' });
    }

    // ── Photo Validation (if provided) ──────────────────────────────────────
    let photoData = null;
    if (photo) {
      // Validate it's a base64 image and limit size to 5MB
      const base64Size = photo.length * 0.75; // approximate size in bytes
      if (base64Size > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Photo must be smaller than 5MB.' });
      }
      if (!photo.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Invalid photo format.' });
      }
      photoData = photo;
    }

    // ── Encrypt Sensitive Contact Info ───────────────────────────────────────
    const encryptedContact = contactType !== 'none' ? encrypt(contactValue.trim()) : null;

    // ── Build Submission Document ────────────────────────────────────────────
    const submission = {
      name: name.trim(),
      contactType: contactType,
      contactEncrypted: encryptedContact,  // AES-256-GCM encrypted
      category: category,
      message: message.trim(),
      photo: photoData,
      hasPhoto: !!photoData,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: 'new'  // 'new' | 'reviewed' | 'resolved'
    };

    // ── Save to Database ──────────────────────────────────────────────────────
    const { db } = await connectToDatabase();
    const collection = db.collection('submissions');
    const result = await collection.insertOne(submission);

    return res.status(201).json({
      success: true,
      message: 'Your submission has been received! Thank you for helping us improve Syntiox.',
      id: result.insertedId
    });

  } catch (error) {
    console.error('[SUBMIT] Error:', error);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
};
