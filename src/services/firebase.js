const admin = require('firebase-admin');

let db, storage;

function initFirebase() {
  if (admin.apps.length) return;

  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  const config = {
    projectId: process.env.FIREBASE_PROJECT_ID || 'boomstroy-7bfdc',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'boomstroy-7bfdc.firebasestorage.app',
  };

  if (privateKey && process.env.FIREBASE_CLIENT_EMAIL) {
    config.credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID || 'boomstroy-7bfdc',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    });
  } else {
    // Application default credentials (Railway ortam o'zgaruvchilari orqali)
    config.credential = admin.credential.applicationDefault();
  }

  admin.initializeApp(config);
  db = admin.firestore();
  storage = admin.storage();
  console.log('✅ Firebase ulandi:', config.projectId);
}

function getDb() {
  if (!db) initFirebase();
  return db;
}

function getStorage() {
  if (!storage) initFirebase();
  return storage;
}

// ─── CRUD HELPERS ───────────────────────────────────────────────────────────

async function getCollection(col, orderField = 'createdAt', dir = 'desc') {
  const db = getDb();
  try {
    const snap = await db.collection(col).orderBy(orderField, dir).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await db.collection(col).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

async function getDoc(col, id) {
  const db = getDb();
  const doc = await db.collection(col).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function addDoc(col, data) {
  const db = getDb();
  data.createdAt = admin.firestore.FieldValue.serverTimestamp();
  data.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  const ref = await db.collection(col).add(data);
  return ref.id;
}

async function updateDoc(col, id, data) {
  const db = getDb();
  data.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await db.collection(col).doc(id).update(data);
}

async function deleteDocById(col, id) {
  const db = getDb();
  await db.collection(col).doc(id).delete();
}

async function queryDocs(col, field, op, value) {
  const db = getDb();
  const snap = await db.collection(col).where(field, op, value).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addLog(type, message, extra = {}) {
  try {
    await addDoc('logs', { type, message, extra });
  } catch (e) {
    console.error('Log xatosi:', e.message);
  }
}

// ─── YANGI YORDAMCHI FUNKSIYALAR (loyalty, favorites, reviews uchun) ─────────

async function incrementField(col, id, field, amount = 1) {
  const db = getDb();
  await db.collection(col).doc(id).update({
    [field]: admin.firestore.FieldValue.increment(amount),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function arrayUnionField(col, id, field, value) {
  const db = getDb();
  await db.collection(col).doc(id).update({
    [field]: admin.firestore.FieldValue.arrayUnion(value),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function arrayRemoveField(col, id, field, value) {
  const db = getDb();
  await db.collection(col).doc(id).update({
    [field]: admin.firestore.FieldValue.arrayRemove(value),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function queryDocsMulti(col, filters = []) {
  const db = getDb();
  let ref = db.collection(col);
  for (const f of filters) ref = ref.where(f.field, f.op, f.value);
  const snap = await ref.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function setDocById(col, id, data, merge = true) {
  const db = getDb();
  await db.collection(col).doc(id).set(
    { ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge }
  );
}

async function getDocsByIds(col, ids = []) {
  if (!ids.length) return [];
  const db = getDb();
  const chunks = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
  const results = [];
  for (const chunk of chunks) {
    const snap = await db.collection(col).where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
    results.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }
  return results;
}

module.exports = {
  initFirebase,
  getDb,
  getStorage,
  getCollection,
  getDoc,
  addDoc,
  updateDoc,
  deleteDocById,
  queryDocs,
  queryDocsMulti,
  setDocById,
  getDocsByIds,
  incrementField,
  arrayUnionField,
  arrayRemoveField,
  addLog,
  admin,
};
