
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

async function seedNavigation() {
  const navRef = collection(db, 'navigation');
  
  // Check if it already exists
  const q = query(navRef, where('path', '==', '/dashboard/naturezas-operacao'));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    // Find the max order
    const allSnap = await getDocs(navRef);
    const maxOrder = Math.max(...allSnap.docs.map(doc => doc.data().order || 0), 0);
    
    await addDoc(navRef, {
      title: 'Naturezas de Operação',
      path: '/dashboard/naturezas-operacao',
      icon: 'ArrowLeftRight',
      order: maxOrder + 1,
      parentId: null,
      visible: true
    });
    console.log('Navigation item added successfully.');
  } else {
    console.log('Navigation item already exists.');
  }
}

seedNavigation().catch(console.error);
