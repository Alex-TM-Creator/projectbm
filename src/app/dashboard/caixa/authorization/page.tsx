"use client";

import * as React from "react";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { ClosingAuthorizationRequest, User as UserType, SalesPermissions } from "@/lib/definitions";
import { Loader2, GitFork, User as UserIcon, ShieldAlert, Frown, Check, X, RefreshCw, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { errorEmitter, FirestorePermissionError } from "@/lib/firebase-error-handler";

export default function CaixaAuthorizationPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<UserType | null>(null);
  const [requests, setRequests] = React.useState<ClosingAuthorizationRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState<string | null>(null);
  const [hasPermission, setHasPermission] = React.useState(false);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (timestamp: any) => format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        setHasPermission(false);
        setLoading(false);
        return;
      }
      const currentUserData = userDoc.data() as UserType;
      setUserData(currentUserData);

      // This is a placeholder for a real permission system.
      // In a real app, you'd check roles or a specific permission flag.
      const isAdmin = currentUserData.isAdmin;
      setHasPermission(isAdmin);

      if (isAdmin) {
        const reqsQuery = query(collection(db, "caixaClosingAuthorizations"), where("status", "==", "pending"));
        const reqsSnap = await getDocs(reqsQuery);
        const pendingRequests = reqsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClosingAuthorizationRequest));
        setRequests(pendingRequests.sort((a,b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0)));
      }
    } catch (error) {
      toast({ title: "Erro ao buscar solicitações", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (user && !authLoading) {
      fetchData();
    }
  }, [user, authLoading, fetchData]);
  
  const handleProcessRequest = async (requestId: string, caixaId: string, action: 'approve' | 'deny') => {
    if (!userData) return;
    setIsSubmitting(requestId);
    
    const requestData = requests.find(r => r.id === requestId);
    if (!requestData) {
        toast({ title: "Erro", description: "Solicitação não encontrada.", variant: "destructive" });
        setIsSubmitting(null);
        return;
    }
    
    const batch = writeBatch(db);
    const requestRef = doc(db, "caixaClosingAuthorizations", requestId);
    let updatedRequestData: any;
    
    if (action === 'approve') {
        const caixaRef = doc(db, "caixas", caixaId);
        const caixaUpdateData = {
            status: 'closed',
            closedAt: serverTimestamp(),
            closingBalance: requestData.expectedAmount,
            confirmedBalance: requestData.confirmedAmount,
            difference: requestData.difference,
            closingNotes: requestData.justification,
        };
        batch.update(caixaRef, caixaUpdateData);
        
        updatedRequestData = {
            status: 'approved',
            processedByUserId: userData.id,
            processedByUserName: userData.name,
            processedAt: serverTimestamp(),
        };
        batch.update(requestRef, updatedRequestData);
    } else { // Deny
        updatedRequestData = {
            status: 'denied',
            processedByUserId: userData.id,
            processedByUserName: userData.name,
            processedAt: serverTimestamp(),
        };
        batch.update(requestRef, updatedRequestData);
    }

    batch.commit()
        .then(() => {
            if (action === 'approve') {
                toast({ title: "Fechamento Aprovado!", description: "O caixa foi fechado com a divergência registrada." });
            } else {
                toast({ title: "Solicitação Negada", description: "O operador do caixa foi notificado." });
            }
            fetchData();
        })
        .catch(error => {
            errorEmitter.emit('permission-error', new FirestorePermissionError(error, {
                operation: 'write',
                path: 'caixas/caixaClosingAuthorizations',
                resource: {
                    caixaId: caixaId,
                    requestId: requestId,
                    action: action,
                },
            }));
        })
        .finally(() => {
            setIsSubmitting(null);
        });
  }

  if (loading || authLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!hasPermission) {
     return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
                <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4" />
                <CardTitle>Acesso Negado</CardTitle>
                <CardDescription>
                    Você não tem permissão para visualizar esta página.
                </CardDescription>
            </CardHeader>
        </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CardHeader className="p-0">
        <CardTitle className="text-3xl font-bold font-headline flex items-center gap-3">
          <ShieldCheck /> Autorizações de Fechamento de Caixa
        </CardTitle>
        <CardDescription>Aprove ou negue os fechamentos de caixa com divergência de valores.</CardDescription>
      </CardHeader>
       <div className="flex justify-end">
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
        </Button>
      </div>

      {requests.length === 0 ? (
         <Card>
            <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                <Frown className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="font-semibold">Nenhuma solicitação pendente</p>
                <p className="text-sm text-muted-foreground">Não há fechamentos de caixa aguardando sua aprovação no momento.</p>
            </CardContent>
         </Card>
      ) : (
        <div className="space-y-4">
            {requests.map(req => (
                <Card key={req.id}>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <UserIcon /> {req.userName}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-2 mt-1">
                                    <GitFork className="h-4 w-4"/> {req.branchName} - Solicitado em {formatDate(req.requestedAt)}
                                </CardDescription>
                            </div>
                             <Badge
                                className={cn(
                                    "text-lg",
                                    req.difference > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                )}
                            >
                                Diferença: {formatCurrency(req.difference)}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-3 bg-muted rounded-md text-sm">
                                <p className="text-muted-foreground">Valor Esperado</p>
                                <p className="font-semibold">{formatCurrency(req.expectedAmount)}</p>
                            </div>
                            <div className="p-3 bg-muted rounded-md text-sm">
                                <p className="text-muted-foreground">Valor Conferido</p>
                                <p className="font-semibold">{formatCurrency(req.confirmedAmount)}</p>
                            </div>
                        </div>
                        <div className="p-3 bg-background border rounded-md">
                            <p className="font-semibold text-sm">Justificativa do Operador:</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{req.justification}</p>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-end gap-2">
                         <Button
                            variant="destructive"
                            onClick={() => handleProcessRequest(req.id, req.caixaId, 'deny')}
                            disabled={isSubmitting === req.id}
                        >
                            {isSubmitting === req.id ? <Loader2 className="animate-spin h-4 w-4"/> : <X className="h-4 w-4"/>}
                            <span className="ml-2">Negar</span>
                        </Button>
                        <Button
                             onClick={() => handleProcessRequest(req.id, req.caixaId, 'approve')}
                             disabled={isSubmitting === req.id}
                        >
                             {isSubmitting === req.id ? <Loader2 className="animate-spin h-4 w-4"/> : <Check className="h-4 w-4"/>}
                             <span className="ml-2">Aprovar Fechamento</span>
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
      )}
    </div>
  );
}
