'use client';

import { EventEmitter } from 'events';

// In a real app, you'd want to ensure this is a singleton.
// For this example, a simple export will do.
export const errorEmitter = new EventEmitter();

export type FirestoreOperationContext = {
  operation: 'read' | 'write' | 'delete';
  path: string;
  resource?: any;
};

export class FirestorePermissionError extends Error {
  constructor(
    public originalError: any,
    public context: FirestoreOperationContext
  ) {
    super(`Firestore permission denied for ${context.operation} on ${context.path}`);
    this.name = 'FirestorePermissionError';
  }
}
