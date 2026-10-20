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
// Each imported row carries an `importKey` (date|name|detail|amount|type).
// Re-uploading the same (growing) sheet only adds rows whose key occurs more
// times in the sheet than it already does in the ledger.

export const planSheetImport = async (rows) => {
  const db = await initDB();
  const allTx = await db.getAll(STORE_NAME);
  const customers = await db.getAll('customers');

  const existingCount = {};
  for (const tx of allTx) {
    if (tx.importKey) existingCount[tx.importKey] = (existingCount[tx.importKey] || 0) + 1;
  }

  // Map lowercase name -> canonical name already used in the app
  const knownNames = {};
  for (const c of customers) knownNames[c.name.toLowerCase()] = c.name;
  for (const tx of allTx) if (tx.storeName && !knownNames[tx.storeName.toLowerCase()]) knownNames[tx.storeName.toLowerCase()] = tx.storeName;
  const customerSet = new Set(customers.map(c => c.name.toLowerCase()));

  const seenCount = {};
  const toAdd = [];
  let skipped = 0;
  const newCustomers = [];

  for (const row of rows) {
    const lower = row.name.toLowerCase();
    if (!knownNames[lower]) knownNames[lower] = row.name;
    const name = knownNames[lower];
    if (!customerSet.has(lower)) {
      customerSet.add(lower);
      newCustomers.push(name);
    }

    const key = [row.ymd, lower, row.detail.toLowerCase(), row.amount, row.type].join('|');
    seenCount[key] = (seenCount[key] || 0) + 1;
    if (seenCount[key] <= (existingCount[key] || 0)) { skipped++; continue; }
    toAdd.push({ ...row, name, importKey: key });
  }

  return { toAdd, skipped, newCustomers };
};

export const applySheetImport = async ({ toAdd, newCustomers }) => {
  const db = await initDB();
  for (const name of newCustomers) {
    const existing = await db.get('customers', name);
    if (!existing) await db.put('customers', { name, mobile: '', address: '' });
  }
  for (const row of toAdd) {
    const [y, m, d] = row.ymd.split('-').map(Number);
    // Local noon + row offset keeps the date stable across timezones and preserves sheet order
    const date = new Date(y, m - 1, d, 12, 0, row.rowIndex % 3600);
    await db.add(STORE_NAME, {
      storeName: row.name,
      itemName: row.detail || (row.type === 'credit' ? 'Payment Received' : 'Udhar'),
      amount: row.amount,
      type: row.type,
      date: date.toISOString(),
      importKey: row.importKey,
    });
  }
};
