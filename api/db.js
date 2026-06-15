// api/db.js
// Database connection helper - MongoDB Atlas with local file fallback

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

let cachedClient = null;
let cachedDb = null;

// ─── Local File-Based Fallback DB ───────────────────────────────────────────
const LOCAL_DB_PATH = path.join(process.cwd(), '.local-db.json');

function getLocalDb() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (_) {}
  return { submissions: [] };
}

function saveLocalDb(data) {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ─── LocalDb Adapter (mirrors MongoDB collection API) ───────────────────────
function createLocalAdapter() {
  return {
    collection(name) {
      return {
        async insertOne(doc) {
          const db = getLocalDb();
          doc._id = Date.now().toString(36) + Math.random().toString(36).slice(2);
          if (!db[name]) db[name] = [];
          db[name].push(doc);
          saveLocalDb(db);
          return { insertedId: doc._id };
        },
        async find(query = {}) {
          const db = getLocalDb();
          const items = db[name] || [];
          return {
            sort() { return this; },
            toArray() {
              if (!query || Object.keys(query).length === 0) return Promise.resolve(items);
              return Promise.resolve(
                items.filter(item => Object.keys(query).every(k => item[k] === query[k]))
              );
            }
          };
        },
        async findOne(query = {}) {
          const db = getLocalDb();
          const items = db[name] || [];
          return items.find(item => Object.keys(query).every(k => item[k] == query[k])) || null;
        },
        async deleteOne(query = {}) {
          const db = getLocalDb();
          const items = db[name] || [];
          const idx = items.findIndex(item => Object.keys(query).every(k => item[k] == query[k]));
          if (idx !== -1) { items.splice(idx, 1); db[name] = items; saveLocalDb(db); return { deletedCount: 1 }; }
          return { deletedCount: 0 };
        },
        async countDocuments() {
          const db = getLocalDb();
          return (db[name] || []).length;
        }
      };
    }
  };
}

// ─── MongoDB Atlas Connection ────────────────────────────────────────────────
async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;

  // Fallback to local file database if no URI provided
  if (!MONGODB_URI || MONGODB_URI.includes('username:password')) {
    console.log('[DB] Using local file-based database (development mode)');
    return { db: createLocalAdapter(), isLocal: true };
  }

  if (cachedClient && cachedDb) {
    return { db: cachedDb, isLocal: false };
  }

  try {
    const client = await MongoClient.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    cachedClient = client;
    cachedDb = client.db('syntiox');
    console.log('[DB] Connected to MongoDB Atlas');
    return { db: cachedDb, isLocal: false };
  } catch (error) {
    console.error('[DB] MongoDB connection failed, falling back to local DB:', error.message);
    return { db: createLocalAdapter(), isLocal: true };
  }
}

module.exports = { connectToDatabase };
