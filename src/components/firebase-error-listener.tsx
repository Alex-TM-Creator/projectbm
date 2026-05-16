
'use client';

import * as React from 'react';
import { errorEmitter, FirestorePermissionError } from '@/lib/firebase-error-handler';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from './ui/badge';
import { CodeBlock } from '@/components/code-block';

export function FirebaseErrorListener() {
  const { toast } = useToast();
  const [error, setError] = React.useState<FirestorePermissionError | null>(null);

  React.useEffect(() => {
    const handleError = (e: FirestorePermissionError) => {
      console.error("Caught Firestore Permission Error:", e);
      setError(e);
      toast({
        title: 'Erro de Permissão do Firestore',
        description: 'Uma operação foi bloqueada pelas regras de segurança. Veja os detalhes.',
        variant: 'destructive',
        duration: 10000,
      });
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  if (!error) {
    return null;
  }

  const generatedRule = `
    match /${error.context.path}/{documentId} {
      // Allow ${error.context.operation} operations for authenticated users
      allow ${error.context.operation}: if request.auth != null;
    }
  `;

  return (
    <AlertDialog open={!!error} onOpenChange={() => setError(null)}>
      <AlertDialogContent className="max-w-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl">Erro de Permissão do Firestore</AlertDialogTitle>
          <AlertDialogDescription>
            A solicitação para o Firestore foi bloqueada pelas suas regras de segurança.
            Abaixo estão os detalhes do erro para ajudar a depurá-lo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 my-4 text-sm">
            <div className="space-y-1">
                <h3 className="font-semibold">Operação Bloqueada</h3>
                <p>
                    A operação de <Badge variant="secondary">{error.context.operation}</Badge> na coleção <Badge variant="outline">'{error.context.path}'</Badge> falhou.
                </p>
            </div>

            {error.context.resource && (
                 <div className="space-y-2">
                    <h3 className="font-semibold">Dados da Requisição</h3>
                    <CodeBlock>
                      <code>
                        {JSON.stringify(error.context.resource, null, 2)}
                      </code>
                    </CodeBlock>
                 </div>
            )}
           
            <div className="space-y-2">
                <h3 className="font-semibold">Sugestão de Regra</h3>
                <p className="text-xs text-muted-foreground">Para permitir esta operação específica, você pode adicionar a seguinte regra ao seu arquivo <code className="font-mono">firestore.rules</code>. Lembre-se que esta é uma sugestão e pode precisar de ajustes para o seu caso de uso.</p>
                <CodeBlock>
                  <code>
                    {generatedRule.trim()}
                  </code>
                </CodeBlock>
            </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setError(null)}>Fechar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
