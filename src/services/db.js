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
