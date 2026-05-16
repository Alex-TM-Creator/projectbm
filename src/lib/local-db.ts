
/**
 * Motor de Banco de Dados Local (localStorage)
 * Simula operações do Firestore de forma síncrona e local.
 */

export const localDb = {
  /**
   * Obtém todos os documentos de uma coleção
   */
  getCollection: <T>(collectionName: string): T[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(`conecta_db_${collectionName}`);
    return data ? JSON.parse(data) : [];
  },

  /**
   * Salva uma coleção inteira
   */
  saveCollection: <T>(collectionName: string, data: T[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`conecta_db_${collectionName}`, JSON.stringify(data));
  },

  /**
   * Busca documentos que correspondam a um critério (similar ao where)
   */
  query: <T>(collectionName: string, filterFn: (item: T) => boolean): T[] => {
    const items = localDb.getCollection<T>(collectionName);
    return items.filter(filterFn);
  },

  /**
   * Adiciona ou atualiza um documento
   */
  setDoc: <T extends { id: string }>(collectionName: string, docData: T): void => {
    const items = localDb.getCollection<T>(collectionName);
    const index = items.findIndex(item => item.id === docData.id);
    
    if (index > -1) {
      items[index] = { ...items[index], ...docData };
    } else {
      items.push(docData);
    }
    
    localDb.saveCollection(collectionName, items);
  },

  /**
   * Adiciona um novo documento com ID gerado
   */
  addDoc: <T extends { id?: string }>(collectionName: string, docData: T): string => {
    const id = docData.id || Math.random().toString(36).substring(2, 15);
    const newItem = { ...docData, id } as T & { id: string };
    localDb.setDoc(collectionName, newItem);
    return id;
  },

  /**
   * Remove um documento
   */
  deleteDoc: (collectionName: string, id: string): void => {
    const items = localDb.getCollection<{ id: string }>(collectionName);
    const filtered = items.filter(item => item.id !== id);
    localDb.saveCollection(collectionName, filtered);
  },

  /**
   * Busca avançada por texto em múltiplos campos
   */
  search: <T>(collectionName: string, term: string, fields: (keyof T)[]): T[] => {
    const items = localDb.getCollection<T>(collectionName);
    const lowerTerm = term.toLowerCase();
    
    return items.filter(item => {
      return fields.some(field => {
        const val = item[field];
        if (typeof val === 'string') {
          return val.toLowerCase().includes(lowerTerm);
        }
        if (typeof val === 'number') {
          return val.toString().includes(lowerTerm);
        }
        return false;
      });
    });
  }
};
