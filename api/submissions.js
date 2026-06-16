// api/submissions.js
// GET    /api/submissions         - Fetch all submissions (admin only)
// DELETE /api/submissions?id=xxx  - Delete single submission (admin only)
// DELETE /api/submissions?bulk=true&ids=id1,id2,... - Bulk delete (admin only)
// DELETE /api/submissions?deleteAll=true - Delete ALL submissions (admin only)

const { connectToDatabase } = require('./db');
const { decrypt } = require('./crypto');
const jwt = require('jsonwebtoken');

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, getJwtSecret(), { issuer: 'syntiox-ideas' });
  } catch (_) {
    return null;
  }
}

// Convert string ID → MongoDB ObjectId safely
function toObjectId(id) {
  try {
    const { ObjectId } = require('mongodb');
    return new ObjectId(id);
  } catch (_) {
    return id; // fallback for local file DB (string IDs)
  }
}

// Serialize _id to string (works for both ObjectId and string)
function serializeId(id) {
  if (!id) return null;
  return id.toString ? id.toString() : String(id);
}

// ── Main Handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Auth Guard ────────────────────────────────────────────────────────────
  const user = verifyToken(req);
  if (!user || user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized. Please log in as admin.' });
  }

  const { db, isLocal } = await connectToDatabase();
  const collection = db.collection('submissions');

  // ════════════════════════════════════════════════════════════════════════════
  // GET — Fetch Submissions
  // ════════════════════════════════════════════════════════════════════════════
  if (req.method === 'GET') {
    try {
      const { category, search, page = '1', limit = '100' } = req.query || {};

      let submissions = await collection
        .find({})
        .sort({ timestamp: -1 })
        .toArray();

      // Decrypt & normalize
      submissions = submissions.map(doc => ({
        _id: serializeId(doc._id),
        name: doc.name,
        contactType: doc.contactType,
        contact: doc.contactEncrypted ? decrypt(doc.contactEncrypted) : null,
        category: doc.category,
        message: doc.message,
        hasPhoto: doc.hasPhoto,
        photo: doc.photo,
        createdAt: doc.createdAt,
        timestamp: doc.timestamp,
        status: doc.status || 'new'
      }));

      // ── All-submission stats (before filtering) ───────────────────────────
      const stats = {
        total: submissions.length,
        byCategory: {
          idea:     submissions.filter(s => s.category === 'idea').length,
          bug:      submissions.filter(s => s.category === 'bug').length,
          feedback: submissions.filter(s => s.category === 'feedback').length,
          general:  submissions.filter(s => s.category === 'general').length,
          qa:       submissions.filter(s => s.category === 'qa').length
        }
      };

      // ── Filters ───────────────────────────────────────────────────────────
      if (category && category !== 'all') {
        submissions = submissions.filter(s => s.category === category);
      }
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        submissions = submissions.filter(s =>
          s.name.toLowerCase().includes(q) ||
          s.message.toLowerCase().includes(q) ||
          (s.contact && s.contact.toLowerCase().includes(q))
        );
      }

      // ── Pagination ────────────────────────────────────────────────────────
      const pageNum  = Math.max(1, parseInt(page));
      const limitNum = Math.min(200, parseInt(limit));
      const total    = submissions.length;
      const paginated = submissions.slice((pageNum - 1) * limitNum, pageNum * limitNum);

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

  // ════════════════════════════════════════════════════════════════════════════
  // DELETE — Remove Submission(s) Permanently
  // ════════════════════════════════════════════════════════════════════════════
  if (req.method === 'DELETE') {
    try {
      const { id, ids, deleteAll, category } = req.query;

      // ── 1. Delete ALL submissions ─────────────────────────────────────────
      if (deleteAll === 'true') {
        const query = category && category !== 'all' ? { category } : {};

        let deletedCount = 0;
        if (isLocal) {
          // Local DB fallback
          const allDocs = await collection.find(query).toArray();
          for (const doc of allDocs) {
            await collection.deleteOne({ _id: doc._id });
            deletedCount++;
          }
        } else {
          const { ObjectId } = require('mongodb');
          const result = await collection.deleteMany(query);
          deletedCount = result.deletedCount;
        }

        return res.status(200).json({
          success: true,
          deletedCount,
          message: `${deletedCount} submission${deletedCount !== 1 ? 's' : ''} permanently deleted.`
        });
      }

      // ── 2. Bulk Delete (comma-separated IDs) ─────────────────────────────
      if (ids) {
        const idList = ids.split(',').map(s => s.trim()).filter(Boolean);
        if (!idList.length) {
          return res.status(400).json({ error: 'No valid IDs provided.' });
        }

        let deletedCount = 0;
        if (isLocal) {
          for (const rawId of idList) {
            const result = await collection.deleteOne({ _id: rawId });
            deletedCount += result.deletedCount || 0;
          }
        } else {
          const { ObjectId } = require('mongodb');
          const objectIds = idList.map(rawId => {
            try { return new ObjectId(rawId); }
            catch (_) { return rawId; }
          });
          const result = await collection.deleteMany({ _id: { $in: objectIds } });
          deletedCount = result.deletedCount;
        }

        return res.status(200).json({
          success: true,
          deletedCount,
          message: `${deletedCount} submission${deletedCount !== 1 ? 's' : ''} permanently deleted.`
        });
      }

      // ── 3. Single Delete ──────────────────────────────────────────────────
      if (!id) {
        return res.status(400).json({ error: 'Submission ID is required.' });
      }

      let result;
      if (isLocal) {
        result = await collection.deleteOne({ _id: id });
      } else {
        result = await collection.deleteOne({ _id: toObjectId(id) });
      }

      if (!result || result.deletedCount === 0) {
        return res.status(404).json({ error: 'Submission not found.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Submission permanently deleted from database.'
      });

    } catch (error) {
      console.error('[SUBMISSIONS DELETE] Error:', error);
      return res.status(500).json({ error: 'Failed to delete submission.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
