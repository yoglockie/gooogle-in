/* Persistent feed backed by MongoDB Atlas.

   The connection string lives ONLY here, server-side, as an env var. It is never
   sent to the spectator page or the app - they only ever talk to /api/*.

   Env (set in Vercel project settings, or a local .env - never commit it):
     MONGODB_URI   your Atlas SRV string (mongodb+srv://user:pass@cluster/...)
     MONGODB_DB    database name   (default: searchpeek)
     TTL_HOURS     auto-delete searches after N hours (default: 6)

   Serverless note: the connection is cached on the global object so warm
   invocations reuse one pool instead of opening a new connection each call.  */
'use strict';
const { MongoClient } = require('mongodb');

const URI = process.env.MONGODB_URI || '';
const DBNAME = process.env.MONGODB_DB || 'searchpeek';
const TTL_HOURS = parseFloat(process.env.TTL_HOURS || '6');

function configured() { return !!URI; }

let _indexed = false;
function client() {
  // reuse across warm invocations
  if (!global.__searchpeekMongo) {
    // Do NOT cache a rejected promise. In serverless, a first connect that fails
    // (e.g. during an Atlas network-rule propagation window) would otherwise be
    // cached and poison every later call on the same warm instance. On failure
    // we clear the cache so the next invocation reconnects fresh.
    global.__searchpeekMongo = new MongoClient(URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000
    }).connect().catch(err => {
      global.__searchpeekMongo = undefined;
      throw err;
    });
  }
  return global.__searchpeekMongo;
}

async function coll() {
  const c = await client();
  const col = c.db(DBNAME).collection('searches');
  if (!_indexed) {
    _indexed = true;
    // TTL: old searches self-delete. Privacy + no unbounded growth.
    try { await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: Math.round(TTL_HOURS * 3600) }); } catch (e) {}
    try { await col.createIndex({ at: -1 }); } catch (e) {}
  }
  return col;
}

async function push(term) {
  const col = await coll();
  const doc = { term: String(term).slice(0, 300), at: Date.now(), createdAt: new Date() };
  const r = await col.insertOne(doc);
  return { id: String(r.insertedId), term: doc.term, at: doc.at };
}

async function list(limit) {
  const col = await coll();
  const docs = await col.find({}).sort({ at: -1 }).limit(limit || 50).toArray();
  return docs.map(d => ({ id: String(d._id), term: d.term, at: d.at }));
}

async function clear() { const col = await coll(); await col.deleteMany({}); }

module.exports = { configured, push, list, clear };
