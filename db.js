const DB_NAME = 'taskboard'; const DB_VER = 1; const STORE = 'tasks';
let db;

function openDB() { return new Promise((res, rej) => { const r = indexedDB.open(DB_NAME, DB_VER); r.onupgradeneeded = e => { e.target.result.createObjectStore(STORE, { keyPath: 'id' }) }; r.onsuccess = e => { db = e.target.result; res(db) }; r.onerror = e => rej(e) }) }
function dbGet() { return new Promise(res => { const tx = db.transaction(STORE, 'readonly'); const req = tx.objectStore(STORE).getAll(); req.onsuccess = e => res(e.target.result || []) }) }
function dbPut(t) { return new Promise(res => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(t); tx.oncomplete = res }) }
function dbDel(id) { return new Promise(res => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete = res }) }
