
"use client";

import * as React from "react";
import {
  Loader2,
  ShieldAlert,
  Frown,
  RefreshCw,
  Check,
  X,
  FileText,
  ShieldCheck,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useToast } from "@/hooks/use-toast";
import type { DiscountApproval, User as UserType, SalesPermissions } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function DiscountReleasePage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [approvals, setApprovals] = React.useState<DiscountApproval[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasPermission, setHasPermission] = React.useState(false);
  
  const [selectedApproval, setSelectedApproval] = React.useState<DiscountApproval | null>(null);
  const [actionType, setActionType] = React.useState<'approve' | 'deny' | null>(null);
  const [releaseNotes, setReleaseNotes] = React.useState("");


  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      const [userSnap, permsSnap, approvalsSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "settings", "salesPermissions")),
          getDocs(query(collection(db, "discountApprovals"))), // Fetch all, then filter
      ]);
      
      const currentUser = userSnap.exists() ? userSnap.data() as UserType : null;
      const permissions = permsSnap.exists() ? permsSnap.data() as SalesPermissions : {};
      
      const canRelease = currentUser?.isAdmin || 
                         permissions.canReleaseDiscount?.roleIds?.includes(currentUser?.roleId || '') || 
                         permissions.canReleaseDiscount?.userIds?.includes(currentUser?.id || '');

      setHasPermission(canRelease);

      if (canRelease) {
        const allApprovals = approvalsSnap.docs.map(d => ({ id: d.id, ...d.data() } as DiscountApproval));
        const pendingApprovals = allApprovals
          .filter(a => a.status === 'pending')
          .sort((a, b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0));
        setApprovals(pendingApprovals);
      } else {
        setApprovals([]);
      }

    } catch (error) {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (user && !authLoading) {
      fetchData();
    }
  }, [user, authLoading, fetchData]);

  const handleOpenModal = (approval: DiscountApproval, type: 'approve' | 'deny') => {
    setSelectedApproval(approval);
    setActionType(type);
    setReleaseNotes("");
  };

  const handleCloseModal = () => {
    setSelectedApproval(null);
    setActionType(null);
    setReleaseNotes("");
  };

  const handleSubmit = async () => {
    if (!selectedApproval || !actionType || !user) return;
    
    setIsSubmitting(true);
    try {
      const docRef = doc(db, "discountApprovals", selectedApproval.id);
      await updateDoc(docRef, {
        status: actionType === 'approve' ? 'approved' : 'denied',
        releasedBy: user.displayName,
        releasedAt: serverTimestamp(),
        releaseNotes: releaseNotes,
      });

      // Also update the original sales order
      const orderRef = doc(db, "salesOrders", selectedApproval.orderId);
      await updateDoc(orderRef, {
        status: actionType === 'approve' ? 'pending' : 'cancelled', // Or another status for denied
      });

      toast({ title: `Pedido ${actionType === 'approve' ? 'Aprovado' : 'Negado'}!`, description: "O status do pedido foi atualizado." });
      handleCloseModal();
      fetchData();

    } catch (error) {
      toast({ title: "Erro ao processar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`.replace('.', ',');
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "Data inválida";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  if (loading || authLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <ShieldCheck /> Liberação de Desconto
          </h1>
          <p className="text-muted-foreground">
            Aprove ou negue pedidos com desconto acima do limite permitido.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos Aguardando Aprovação</CardTitle>
          <CardDescription>
            {hasPermission ? `${approvals.length} pedidos necessitam de sua atenção.` : "Você não tem permissão para visualizar esta página."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasPermission ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                <ShieldAlert className="h-16 w-16 text-destructive" />
                <h2 className="mt-4 text-xl font-semibold">Acesso Negado</h2>
                <p className="mt-2 text-sm text-muted-foreground text-center">
                    Seu perfil não tem permissão para liberar descontos.
                </p>
            </div>
          ) : approvals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                <Frown className="h-16 w-16 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">Nenhuma pendência</h2>
                <p className="mt-2 text-sm text-muted-foreground text-center">
                    Não há pedidos aguardando liberação de desconto no momento.
                </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido Nº</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Desconto (%)</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.map(approval => (
                  <TableRow key={approval.id}>
                    <TableCell className="font-mono">#{approval.orderNumber}</TableCell>
                    <TableCell>{approval.sellerName}</TableCell>
                    <TableCell>{approval.customerName}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{formatPercentage(approval.totalDiscountPercentage)}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(approval.requestedAt)}</TableCell>
                    <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleOpenModal(approval, 'deny')}>
                            <X className="h-4 w-4 mr-2"/> Negar
                        </Button>
                        <Button size="sm" onClick={() => handleOpenModal(approval, 'approve')}>
                            <Check className="h-4 w-4 mr-2"/> Aprovar
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {selectedApproval && (
        <Dialog open={!!selectedApproval} onOpenChange={handleCloseModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className={actionType === 'approve' ? "text-green-600" : "text-red-600"}>
                {actionType === 'approve' ? 'Aprovar Pedido' : 'Negar Pedido'} #{selectedApproval.orderNumber}
              </DialogTitle>
              <DialogDescription>
                Revise as informações e adicione uma nota se necessário. Esta ação é irreversível.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
               <p>Vendedor: <strong>{selectedApproval.sellerName}</strong></p>
               <p>Cliente: <strong>{selectedApproval.customerName}</strong></p>
               <div className="flex items-center gap-2">Desconto Solicitado: <Badge variant="destructive">{formatPercentage(selectedApproval.totalDiscountPercentage)}</Badge></div>
               <div className="space-y-2">
                  <Label htmlFor="release-notes">Observações (Opcional)</Label>
                  <Textarea id="release-notes" value={releaseNotes} onChange={e => setReleaseNotes(e.target.value)} placeholder="Ex: Liberado devido à negociação X..."/>
               </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={handleCloseModal}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} variant={actionType === 'approve' ? 'default' : 'destructive'}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (actionType === 'approve' ? <Check className="mr-2 h-4 w-4"/> : <X className="mr-2 h-4 w-4"/>)}
                  Confirmar {actionType === 'approve' ? 'Aprovação' : 'Negação'}
                </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
