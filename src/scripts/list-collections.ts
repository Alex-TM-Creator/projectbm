
import { db } from '../lib/firebase';
import { collection, getDocs, limit } from 'firebase/firestore';

async function listCollections() {
  // Firestore client SDK doesn't support listing collections easily without admin SDK
  // But we can try to guess or use a common one
  const commonCollections = [
    'salesOrders',
    'notasFiscais',
    'nfe',
    'vendas',
    'companyBranches',
    'branches',
    'users'
  ];

  for (const name of commonCollections) {
    try {
      const snap = await getDocs(collection(db, name));
      console.log(`Collection "${name}": ${snap.size} documents`);
    } catch (e) {
      console.log(`Collection "${name}": Error or not found`);
    }
  }
}

listCollections().catch(console.error);
