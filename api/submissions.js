// api/submissions.js
// GET  /api/submissions  - Fetch all submissions (admin only)
// DELETE /api/submissions?id=xxx - Delete a submission (admin only)

const { connectToDatabase } = require('./db');
const { decrypt } = require('./crypto');
const jwt = require('jsonwebtoken');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getJwtSecret() {
  return process.env.JWT_SECRET || 'syntiox-dev-jwt-secret-key-change-in-production';
}

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, getJwtSecret(), { issuer: 'syntiox-ideas' });
  } catch (_) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── Auth Guard ────────────────────────────────────────────────────────────
  const user = verifyToken(req);
  if (!user || user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized. Please log in as admin.' });
  }

  const { db } = await connectToDatabase();
  const collection = db.collection('submissions');

  // ── GET: Fetch Submissions ────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { category, search, page = '1', limit = '50' } = req.query || {};

      let submissions = await collection
        .find({})
        .sort({ timestamp: -1 })
        .toArray();

      // Decrypt sensitive fields
      submissions = submissions.map(doc => {
        let decryptedContact = null;
        if (doc.contactEncrypted) {
          decryptedContact = decrypt(doc.contactEncrypted);
        }
        return {
          _id: doc._id,
          name: doc.name,
          contactType: doc.contactType,
          contact: decryptedContact,
          category: doc.category,
          message: doc.message,
          hasPhoto: doc.hasPhoto,
          photo: doc.photo,
          createdAt: doc.createdAt,
          timestamp: doc.timestamp,
          status: doc.status || 'new'
        };
      });

      // Filter by category
      if (category && category !== 'all') {
        submissions = submissions.filter(s => s.category === category);
      }

      // Search filter
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        submissions = submissions.filter(s =>
          s.name.toLowerCase().includes(q) ||
          s.message.toLowerCase().includes(q) ||
          (s.contact && s.contact.toLowerCase().includes(q))
        );
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const total = submissions.length;
      const paginated = submissions.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      // Stats
      const stats = {
        total: total,
        byCategory: {
          idea: submissions.filter(s => s.category === 'idea').length,
          bug: submissions.filter(s => s.category === 'bug').length,
          feedback: submissions.filter(s => s.category === 'feedback').length,
          general: submissions.filter(s => s.category === 'general').length,
          qa: submissions.filter(s => s.category === 'qa').length
        }
      };

      return res.status(200).json({
        success: true,
        submissions: paginated,
        total,
        page: pageNum,
        stats
      });

    } catch (error) {
      console.error('[SUBMISSIONS GET] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch submissions.' });
    }
  }

  // ── DELETE: Remove a Submission ───────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Submission ID is required.' });
      }

      const result = await collection.deleteOne({ _id: id });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Submission not found.' });
      }

      return res.status(200).json({ success: true, message: 'Submission deleted successfully.' });

    } catch (error) {
      console.error('[SUBMISSIONS DELETE] Error:', error);
      return res.status(500).json({ error: 'Failed to delete submission.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
