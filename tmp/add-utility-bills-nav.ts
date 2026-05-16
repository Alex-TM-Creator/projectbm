import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import * as path from 'path';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function registerNav() {
  console.log("Registrando aba 'Contas de Consumo'...");
  
  const navItem = {
    title: "Contas de Consumo",
    path: "utility-bills",
    icon: "LayoutGrid",
    visible: true,
    order: 30,
    parentId: null,
    createdAt: serverTimestamp()
  };

  const navRef = await addDoc(collection(db, "navigation"), navItem);
  const navId = navRef.id;
  console.log(`Aba registrada com ID: ${navId}`);

  // Agora adicionamos ao role de admin (geralmente 'admin' ou buscamos o roleId do usuário atual)
  // Vou adicionar ao role 'admin' se ele existir, ou buscar o roleId do primeiro administrador.
  const rolesSnap = await getDocs(collection(db, "roleAccess"));
  rolesSnap.forEach(async (roleDoc) => {
      // Adiciona a todos os perfis existentes para facilitar o teste inicial do usuário
      await updateDoc(doc(db, "roleAccess", roleDoc.id), {
          allowedNavIds: arrayUnion(navId)
      });
      console.log(`Acesso liberado para o perfil: ${roleDoc.id}`);
  });

  console.log("Processo concluído!");
  process.exit(0);
}

import { getDocs } from 'firebase/firestore';
registerNav().catch(err => {
    console.error(err);
    process.exit(1);
});
