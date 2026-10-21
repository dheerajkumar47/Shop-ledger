import { openDB } from 'idb';

const DB_NAME = 'shop-ledger-db';
const STORE_NAME = 'transactions';
const DB_VERSION = 3;

export const initDB = async () => {
  return await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('date', 'date');
        store.createIndex('storeName', 'storeName');
      }

      if (newVersion >= 2) {
        if (!db.objectStoreNames.contains('customers')) {
          db.createObjectStore('customers', { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains('parties')) {
          db.createObjectStore('parties', { keyPath: 'name' });
        }
      }

      if (newVersion >= 3) {
        if (!db.objectStoreNames.contains('gala')) {
          const galaStore = db.createObjectStore('gala', {
            keyPath: 'id',
            autoIncrement: true,
          });
          galaStore.createIndex('date', 'date');
          galaStore.createIndex('type', 'type');
        }
      }
    },
  });
};

export const addTransaction = async (transaction) => {
  const db = await initDB();
  const tx = {
    ...transaction,
    type: transaction.type || 'debit', // 'debit' = Udhar, 'credit' = Payment
    date: transaction.date || new Date().toISOString(),
    amount: Number(transaction.amount)
  };
  return await db.add(STORE_NAME, tx);
};

export const getTransactionsByCustomer = async (storeName) => {
  const db = await initDB();
  return await db.getAllFromIndex(STORE_NAME, 'storeName', storeName);
};

export const updateTransaction = async (tx) => {
  const db = await initDB();
  return await db.put(STORE_NAME, tx);
};

export const getAllTransactions = async () => {
  const db = await initDB();
  return await db.getAllFromIndex(STORE_NAME, 'date');
};

export const deleteTransaction = async (id) => {
  const db = await initDB();
  return await db.delete(STORE_NAME, id);
};

export const clearAllTransactions = async () => {
  const db = await initDB();
  return await db.clear(STORE_NAME);
};

export const deleteDatabase = async () => {
  const db = await initDB();
  await db.clear(STORE_NAME);
  // Also try to clear customers and parties if they exist
  try { await db.clear('customers'); } catch {}
  try { await db.clear('parties'); } catch {}
  try { await db.clear('gala'); } catch {}
};

export const seedRandomData = async () => {
  const db = await initDB();
  await db.clear(STORE_NAME); // Clear previous

  const customers = ["Ali Store", "Imran Bakery", "Usman Traders"];
  const items = ["5x Sugar", "2x Flour Bag", "1x Oil carton", "10x Milk pack", "3x Soap", "5x Rice bag", "Payment Received"];
  
  const now = new Date();
  
  const generateRandomDate = (start, end) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  };

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  for (let i = 0; i < 30; i++) {
    const isCredit = Math.random() > 0.7; // 30% payments (credits)
    const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
    const randomDate = generateRandomDate(sixMonthsAgo, now);
    
    let amount = 0;
    let itemName = '';
    
    if (isCredit) {
      amount = Math.floor(Math.random() * 5 + 1) * 1000; // Payments of 1000, 2000, etc.
      itemName = "Payment Received";
    } else {
      amount = Math.floor(Math.random() * 50 + 1) * 100; // Udhar of 100, 500, etc
      itemName = items[Math.floor(Math.random() * (items.length - 1))]; // Exclude Payment Received from Udhar lists
    }

    const tx = {
      storeName: randomCustomer,
      itemName: itemName,
      amount: amount,
      type: isCredit ? 'credit' : 'debit',
      date: randomDate.toISOString()
    };
    
    await db.add(STORE_NAME, tx);
  }
};

// Customer Operations
export const addCustomer = async (customer) => {
  const db = await initDB();
  return await db.put('customers', customer);
};

export const getCustomers = async () => {
  const db = await initDB();
  return await db.getAll('customers');
};

export const deleteCustomer = async (name) => {
  const db = await initDB();
  return await db.delete('customers', name);
};

export const updateCustomerInfo = async (oldName, newData) => {
  const db = await initDB();
  // Delete old record, save new one
  await db.delete('customers', oldName);
  await db.put('customers', newData);
  // If name changed, migrate all transactions to new name
  if (oldName !== newData.name) {
    const all = await db.getAllFromIndex(STORE_NAME, 'storeName', oldName);
    for (const tx of all) {
      await db.put(STORE_NAME, { ...tx, storeName: newData.name });
    }
  }
};


// Party Operations
export const addParty = async (party) => {
  const db = await initDB();
  return await db.put('parties', party);
};

export const getParties = async () => {
  const db = await initDB();
  return await db.getAll('parties');
};

// Gala (Cash Register) Operations
export const addGalaEntry = async (entry) => {
  const db = await initDB();
  return await db.add('gala', {
    ...entry,
    date: entry.date || new Date().toISOString(),
    amount: Number(entry.amount)
  });
};

export const getGalaEntries = async () => {
  const db = await initDB();
  return await db.getAll('gala');
};

// ── Backup & Restore ────────────────────────────────────────────────────────

export const exportAllData = async () => {
  const db = await initDB();
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: await db.getAll('transactions'),
    customers:    await db.getAll('customers'),
    parties:      await db.getAll('parties'),
    gala:         await db.getAll('gala'),
  };
  return backup;
};

export const importAllData = async (backup) => {
  const db = await initDB();

  // Clear existing data first
  await db.clear('transactions');
  await db.clear('customers');
  await db.clear('parties');
  try { await db.clear('gala'); } catch {}

  // Re-insert everything
  for (const tx of (backup.transactions || [])) {
    const { id, ...rest } = tx;
    await db.add('transactions', rest);
  }
  for (const c of (backup.customers || [])) {
    await db.put('customers', c);
  }
  for (const p of (backup.parties || [])) {
    await db.put('parties', p);
  }
  for (const g of (backup.gala || [])) {
    const { id, ...rest } = g;
    await db.add('gala', rest);
  }
};

// ── Daily Excel Import ──────────────────────────────────────────────────────
// A row's key is date|name|detail|amount|type (payments ignore detail, since
// manual payments are saved as "Payment Received"). Matching is by count, so
// two identical rows on the same day are two entries:
//  - rows already added by an earlier upload are skipped (same sheet uploaded again)
//  - entries typed by hand before the first upload are offered as matches the
//    user can choose to skip; a skipped row is then linked to that entry so
//    later uploads count it as already added. Anything typed by hand after the
//    first upload is never matched

const pad2 = (n) => String(n).padStart(2, '0');

const localYmd = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const tidy = (s) => (s || '').trim().replace(/\s+/g, ' ');

export const makeImportKey = (ymd, name, detail, amount, type) =>
  [ymd, name.toLowerCase(), type === 'credit' ? '' : detail.toLowerCase(), Number(amount), type].join('|');

export const planSheetImport = async (rows) => {
  const db = await initDB();
  const allTx = await db.getAll(STORE_NAME);
  const customers = await db.getAll('customers');

  const importedIds = allTx.filter(tx => tx.importBatch).map(tx => tx.id);
  const firstImportId = importedIds.length ? Math.min(...importedIds) : Infinity;

  const importedCount = {};
  const manualIds = {};
  for (const tx of allTx) {
    if (tx.importKey) {
      importedCount[tx.importKey] = (importedCount[tx.importKey] || 0) + 1;
    } else if (tx.id < firstImportId) {
      const key = makeImportKey(localYmd(tx.date), tidy(tx.storeName), tidy(tx.itemName), tx.amount, tx.type);
      (manualIds[key] ??= []).push(tx.id);
    }
  }

  // Map lowercase name -> canonical name already used in the app
  const knownNames = {};
  for (const c of customers) knownNames[c.name.toLowerCase()] = c.name;
  for (const tx of allTx) if (tx.storeName && !knownNames[tx.storeName.toLowerCase()]) knownNames[tx.storeName.toLowerCase()] = tx.storeName;

  const seenCount = {};
  const toAdd = [];
  const manualMatches = [];
  let skipped = 0;

  for (const row of rows) {
    const lower = row.name.toLowerCase();
    if (!knownNames[lower]) knownNames[lower] = row.name;
    const key = makeImportKey(row.ymd, lower, row.detail, row.amount, row.type);
    const n = seenCount[key] = (seenCount[key] || 0) + 1;
    const item = { ...row, name: knownNames[lower], importKey: key };
    const already = importedCount[key] || 0;
    if (n <= already) skipped++;
    else if (n <= already + (manualIds[key]?.length || 0)) manualMatches.push({ ...item, manualTxId: manualIds[key][n - already - 1] });
    else toAdd.push(item);
  }

  return { toAdd, manualMatches, skipped, customerNames: customers.map(c => c.name.toLowerCase()) };
};

// Rows to write (optionally including the hand-typed matches) and the customers they need
export const finalizePlan = (plan, includeManualMatches) => {
  const rows = includeManualMatches
    ? [...plan.toAdd, ...plan.manualMatches].sort((a, b) => a.rowIndex - b.rowIndex)
    : plan.toAdd;
  const known = new Set(plan.customerNames);
  const newCustomers = [];
  for (const r of rows) {
    const lower = r.name.toLowerCase();
    if (!known.has(lower)) { known.add(lower); newCustomers.push(r.name); }
  }
  const links = includeManualMatches ? [] : plan.manualMatches.map(r => ({ id: r.manualTxId, importKey: r.importKey }));
  return { toAdd: rows, newCustomers, links };
};

export const applySheetImport = async ({ toAdd, newCustomers, links = [] }, fileName = '') => {
  const db = await initDB();
  const batchId = Date.now();
  // Hand-typed entries the user said are the same as sheet rows
  // One transaction for everything: fast for sheets with tens of thousands of rows
  const t = db.transaction([STORE_NAME, 'customers'], 'readwrite');
  const txStore = t.objectStore(STORE_NAME);
  const custStore = t.objectStore('customers');
  for (const { id, importKey } of links) {
    const tx = await txStore.get(id);
    if (tx) txStore.put({ ...tx, importKey });
  }
  for (const name of newCustomers) {
    const existing = await custStore.get(name);
    if (!existing) custStore.put({ name, mobile: '', address: '', createdByImport: batchId });
  }
  const perDay = {};
  for (const row of toAdd) {
    const [y, m, d] = row.ymd.split('-').map(Number);
    // From 6 AM local, one second apart per row of that day: the date never shifts
    // across timezones and entries keep the sheet's order
    const seq = perDay[row.ymd] = (perDay[row.ymd] ?? -1) + 1;
    const date = new Date(y, m - 1, d, 6, 0, seq);
    txStore.add({
      storeName: row.name,
      itemName: row.detail || (row.type === 'credit' ? 'Payment Received' : 'Udhar'),
      amount: row.amount,
      type: row.type,
      date: date.toISOString(),
      importKey: row.importKey,
      importBatch: batchId,
      importFile: fileName,
    });
  }
  await t.done;
  return batchId;
};

// Uploads still in the ledger, newest first
export const getImportBatches = async () => {
  const db = await initDB();
  const allTx = await db.getAll(STORE_NAME);
  const batches = {};
  for (const tx of allTx) {
    if (!tx.importBatch) continue;
    const b = batches[tx.importBatch] ??= { id: tx.importBatch, fileName: tx.importFile || '', entries: [], debit: 0, credit: 0 };
    b.entries.push(tx);
    b[tx.type] += Number(tx.amount);
  }
  return Object.values(batches)
    .map(b => ({ ...b, entries: b.entries.sort((a, c) => a.date.localeCompare(c.date)) }))
    .sort((a, b) => b.id - a.id);
};

// Removes every entry of an upload, and customers that upload created if they have nothing left
export const undoImportBatch = async (batchId) => {
  const db = await initDB();
  const allTx = await db.getAll(STORE_NAME);
  const t = db.transaction(STORE_NAME, 'readwrite');
  for (const tx of allTx) {
    if (tx.importBatch === batchId) t.store.delete(tx.id);
  }
  await t.done;
  await removeEmptyImportedCustomers(batchId);
};

export const deleteImportedEntry = async (tx) => {
  const db = await initDB();
  await db.delete(STORE_NAME, tx.id);
  await removeEmptyImportedCustomers(tx.importBatch);
};

const removeEmptyImportedCustomers = async (batchId) => {
  const db = await initDB();
  const customers = await db.getAll('customers');
  for (const c of customers) {
    if (c.createdByImport !== batchId) continue;
    const left = await db.getAllFromIndex(STORE_NAME, 'storeName', c.name);
    if (left.length === 0) await db.delete('customers', c.name);
  }
};
