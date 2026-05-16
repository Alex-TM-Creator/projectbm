
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Search, User as UserIcon, DollarSign, X, MinusCircle, History } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { CustomerCredit, Customer, User as UserType, CustomerCreditMovement } from "@/lib/definitions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";

export default function CustomerCreditsPage() {
  const { toast } = useToast();
  const [user] = useAuthState(auth);
  const [credits, setCredits] = React.useState<CustomerCredit[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Add Credit Modal
  const [addCreditOpen, setAddCreditOpen] = React.useState(false);
  const [currentCredit, setCurrentCredit] = React.useState<Partial<CustomerCredit>>({});
  const [customerSearch, setCustomerSearch] = React.useState("");
  const [filteredCustomers, setFilteredCustomers] = React.useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);

  // Remove Credit Modal
  const [removeCreditOpen, setRemoveCreditOpen] = React.useState(false);
  const [creditToRemove, setCreditToRemove] = React.useState<CustomerCredit | null>(null);
  const [removalAmount, setRemovalAmount] = React.useState<number | "">("");
  const [removalReason, setRemovalReason] = React.useState("");

  // History Modal
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyCredit, setHistoryCredit] = React.useState<CustomerCredit | null>(null);
  const [historyMovements, setHistoryMovements] = React.useState<CustomerCreditMovement[]>([]);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [creditsSnap, customersSnap] = await Promise.all([
        getDocs(query(collection(db, "customerCredits"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "customers")),
      ]);
      
      setCredits(creditsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CustomerCredit)));
      setCustomers(customersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Customer)));
      
    } catch (error) {
      toast({
        title: "Erro ao buscar créditos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  React.useEffect(() => {
    if (customerSearch.length > 2) {
      const term = customerSearch.toLowerCase();
      setFilteredCustomers(
        customers.filter(c => c.name.toLowerCase().includes(term) || c.cpf?.includes(term) || c.cnpj?.includes(term))
      );
    } else {
      setFilteredCustomers([]);
    }
  }, [customerSearch, customers]);
  
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCurrentCredit(prev => ({...prev, customerId: customer.id, customerName: customer.name}));
    setCustomerSearch("");
    setFilteredCustomers([]);
  };

  const handleOpenAddDialog = () => {
    setCurrentCredit({ creditAmount: 0 });
    setSelectedCustomer(null);
    setAddCreditOpen(true);
  };
  
  const handleCloseAddDialog = () => {
    setCurrentCredit({});
    setSelectedCustomer(null);
    setAddCreditOpen(false);
  };
  
  const handleOpenRemoveDialog = (credit: CustomerCredit) => {
    setCreditToRemove(credit);
    setRemovalAmount("");
    setRemovalReason("");
    setRemoveCreditOpen(true);
  };
  
  const handleCloseRemoveDialog = () => {
    setCreditToRemove(null);
    setRemoveCreditOpen(false);
  };

  const handleViewHistory = async (credit: CustomerCredit) => {
      setHistoryCredit(credit);
      setHistoryOpen(true);
      setHistoryLoading(true);
      try {
          const q = query(collection(db, "customerCreditMovements"), where("customerId", "==", credit.customerId));
          const snap = await getDocs(q);
          const movements = snap.docs.map(d => ({id: d.id, ...d.data()} as CustomerCreditMovement));
          
          movements.sort((a, b) => {
             const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
             const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
             return timeB - timeA;
          });

          setHistoryMovements(movements);
      } catch (error) {
          toast({ title: "Erro ao buscar histórico", variant: "destructive" });
      } finally {
          setHistoryLoading(false);
      }
  };

  const handleCurrencyChange = (setter: React.Dispatch<React.SetStateAction<number | "">>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (rawValue === '') {
      setter('');
      return;
    }
    const numericValue = parseInt(rawValue, 10) / 100;
    setter(numericValue);
  };

  const formatCurrencyForInput = (value?: number | "") => {
    if (value === "" || value === undefined || value === null || isNaN(Number(value))) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(value));
  };
  

  const handleAddCredit = async () => {
    if (!currentCredit.customerId || !currentCredit.customerName || (currentCredit.creditAmount ?? 0) <= 0) {
        toast({ title: "Dados incompletos", description: "Selecione um cliente e insira um valor de crédito válido.", variant: "destructive" });
        return;
    }
    if (!user) {
        toast({ title: "Usuário não autenticado", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    try {
      const existingCreditQuery = query(collection(db, "customerCredits"), where("customerId", "==", currentCredit.customerId));
      const existingCreditSnap = await getDocs(existingCreditQuery);
      
      const note = `[+] ${formatCurrency(currentCredit.creditAmount || 0)} em ${format(new Date(), 'dd/MM/yyyy HH:mm')} por ${user.displayName}: ${currentCredit.notes || 'Lançamento manual.'}`.trim();
      const batch = writeBatch(db);

      if (!existingCreditSnap.empty) {
        const creditDocRef = existingCreditSnap.docs[0].ref;
        const existingData = existingCreditSnap.docs[0].data() as CustomerCredit;
        const newCreditAmount = existingData.creditAmount + (currentCredit.creditAmount || 0);
        const newBalance = (existingData.balance || 0) + (currentCredit.creditAmount || 0);
        
        batch.update(creditDocRef, {
            creditAmount: newCreditAmount,
            balance: newBalance,
            notes: `${existingData.notes || ''}\n${note}`,
            updatedAt: serverTimestamp(),
        });
        
        batch.set(doc(collection(db, "customerCreditMovements")), {
            customerId: currentCredit.customerId,
            type: 'addition',
            amount: currentCredit.creditAmount || 0,
            reason: currentCredit.notes || 'Lançamento manual de crédito.',
            userId: user.uid,
            userName: user.displayName || "N/A",
            createdAt: serverTimestamp()
        });

        await batch.commit();
        toast({ title: "Crédito Adicionado!", description: `O saldo de ${currentCredit.customerName} foi atualizado.` });
      } else {
        const newCreditRef = doc(collection(db, "customerCredits"));
        batch.set(newCreditRef, {
            customerId: currentCredit.customerId,
            customerName: currentCredit.customerName,
            creditAmount: currentCredit.creditAmount || 0,
            usedAmount: 0,
            balance: currentCredit.creditAmount || 0,
            notes: note,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: user.uid,
        });

        batch.set(doc(collection(db, "customerCreditMovements")), {
            customerId: currentCredit.customerId,
            type: 'addition',
            amount: currentCredit.creditAmount || 0,
            reason: currentCredit.notes || 'Lançamento inicial de crédito.',
            userId: user.uid,
            userName: user.displayName || "N/A",
            createdAt: serverTimestamp()
        });

        await batch.commit();
        toast({ title: "Crédito Lançado!", description: "O crédito foi registrado para o cliente." });
      }

      handleCloseAddDialog();
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao lançar crédito", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveCredit = async () => {
    if (!creditToRemove || !removalReason.trim() || Number(removalAmount) <= 0) {
      toast({ title: "Dados incompletos", description: "Preencha o valor a ser removido e o motivo.", variant: "destructive"});
      return;
    }
    if (Number(removalAmount) > creditToRemove.balance) {
      toast({ title: "Valor inválido", description: "O valor a ser removido não pode ser maior que o saldo atual.", variant: "destructive"});
      return;
    }
    
    if (!user) {
        toast({ title: "Erro de autenticação", description: "Você precisa estar logado para realizar esta operação.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    try {
        const batch = writeBatch(db);
        const creditDocRef = doc(db, "customerCredits", creditToRemove.id);
        const newBalance = creditToRemove.balance - Number(removalAmount);
        const newCreditAmount = creditToRemove.creditAmount - Number(removalAmount);
        
        batch.update(creditDocRef, {
            balance: newBalance,
            creditAmount: newCreditAmount, // We adjust the total credit as well
            notes: `${creditToRemove.notes || ''}\n[-] ${formatCurrency(Number(removalAmount))} em ${format(new Date(), 'dd/MM/yyyy HH:mm')} por ${user?.displayName || 'Sistema'}: ${removalReason}`.trim(),
            updatedAt: serverTimestamp(),
        });

        batch.set(doc(collection(db, "customerCreditMovements")), {
            customerId: creditToRemove.customerId,
            type: 'removal',
            amount: Number(removalAmount),
            reason: removalReason,
            userId: user.uid,
            userName: user.displayName || "N/A",
            createdAt: serverTimestamp()
        });
        
        await batch.commit();
        
        toast({ title: "Crédito Removido!", description: "O saldo do cliente foi atualizado." });
        handleCloseRemoveDialog();
        fetchData();
    } catch (error) {
       toast({ title: "Erro ao remover crédito", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "N/A";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);


  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <DollarSign /> Crédito Cliente
            </h1>
            <p className="text-muted-foreground">
              Gerencie o saldo de crédito dos seus clientes.
            </p>
          </div>
          <Button size="sm" className="gap-1" onClick={handleOpenAddDialog}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Lançar Crédito</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Créditos Ativos</CardTitle>
            <CardDescription>
              Total de {credits.length} clientes com crédito.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Origem do Crédito</TableHead>
                    <TableHead className="text-right">Saldo Atualizado</TableHead>
                    <TableHead>Última Atualização</TableHead>
                    <TableHead><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credits.map((credit) => (
                    <TableRow key={credit.id}>
                      <TableCell className="font-medium">{credit.customerName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{credit.orderNumber ? `Pedido #${credit.orderNumber}` : 'Lançamento manual'}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">{formatCurrency(credit.balance)}</TableCell>
                      <TableCell>{formatDate(credit.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                         <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewHistory(credit)}>
                              <History className="mr-2 h-4 w-4" />
                              Ver Histórico
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenRemoveDialog(credit)}>
                              <MinusCircle className="mr-2 h-4 w-4" />
                              Remover Crédito
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                   {credits.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-24">Nenhum crédito lançado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      
       {/* Add Credit Dialog */}
      <Dialog open={addCreditOpen} onOpenChange={setAddCreditOpen}>
         <DialogContent className="sm:max-w-[425px]" onCloseAutoFocus={handleCloseAddDialog}>
            <DialogHeader>
            <DialogTitle>Lançar Crédito para Cliente</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="customer-search">Cliente</Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="customer-search" placeholder="Buscar por nome ou CPF/CNPJ..." className="pl-10" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} disabled={!!selectedCustomer} />
                    {filteredCustomers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredCustomers.map(c => <div key={c.id} className="p-2 hover:bg-muted cursor-pointer" onClick={() => handleSelectCustomer(c)}>{c.name}</div>)}
                    </div>
                    )}
                </div>
                {selectedCustomer && (
                    <div className="mt-2 p-3 border rounded-lg bg-muted flex items-center justify-between">
                        <p className="font-semibold">{selectedCustomer.name}</p>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedCustomer(null); setCurrentCredit(p => ({...p, customerId: undefined, customerName: undefined}))}}>
                            <X className="h-4 w-4"/>
                        </Button>
                    </div>
                )}
            </div>
            <div className="space-y-2">
                <Label htmlFor="creditAmount">Valor do Crédito (R$)</Label>
                <Input id="creditAmount" type="text" value={formatCurrencyForInput(currentCredit.creditAmount)} onChange={handleCurrencyChange(value => setCurrentCredit(p => ({...p, creditAmount: Number(value)})))} placeholder="0,00" disabled={isSubmitting}/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" value={currentCredit.notes || ""} onChange={(e) => setCurrentCredit(p => ({...p, notes: e.target.value}))} placeholder="Ex: Devolução do pedido #123" disabled={isSubmitting}/>
            </div>
            </div>
            <DialogFooter>
            <Button variant="outline" onClick={handleCloseAddDialog} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleAddCredit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar Crédito"}
            </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Remove Credit Dialog */}
      <Dialog open={removeCreditOpen} onOpenChange={setRemoveCreditOpen}>
        <DialogContent className="sm:max-w-md" onCloseAutoFocus={handleCloseRemoveDialog}>
           <DialogHeader>
             <DialogTitle>Remover Crédito</DialogTitle>
             <DialogDescription>
                Remova parte do saldo de crédito de <strong>{creditToRemove?.customerName}</strong>.
             </DialogDescription>
           </DialogHeader>
           <div className="py-4 space-y-4">
             <div className="p-3 bg-muted rounded-md text-sm">
                <p className="text-muted-foreground">Saldo Atual</p>
                <p className="font-bold text-lg">{formatCurrency(creditToRemove?.balance || 0)}</p>
             </div>
              <div className="space-y-2">
                <Label htmlFor="removalAmount">Valor a Remover (R$)</Label>
                <Input
                    id="removalAmount"
                    type="text"
                    value={formatCurrencyForInput(removalAmount)}
                    onChange={handleCurrencyChange(setRemovalAmount)}
                    placeholder="0,00"
                    disabled={isSubmitting}
                />
              </div>
               <div className="space-y-2">
                <Label htmlFor="removalReason">Motivo da Remoção</Label>
                <Textarea
                    id="removalReason"
                    value={removalReason}
                    onChange={(e) => setRemovalReason(e.target.value)}
                    placeholder="Ex: Crédito concedido por engano, estorno de devolução, etc."
                    disabled={isSubmitting}
                />
              </div>
           </div>
           <DialogFooter>
              <Button variant="outline" onClick={handleCloseRemoveDialog} disabled={isSubmitting}>Cancelar</Button>
              <Button variant="destructive" onClick={handleRemoveCredit} disabled={isSubmitting || Number(removalAmount) <= 0 || !removalReason.trim()}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirmar Remoção"}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col sm:max-w-[70vw]">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico de Movimentações
             </DialogTitle>
             <DialogDescription>
                Extrato detalhado do cliente <strong className="text-foreground">{historyCredit?.customerName}</strong>. Saldo Atual: <span className="font-bold text-green-600">{formatCurrency(historyCredit?.balance || 0)}</span>.
             </DialogDescription>
           </DialogHeader>
           <div className="flex-1 overflow-y-auto py-2 pr-2">
              {historyLoading ? (
                 <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
              ) : historyMovements.length === 0 ? (
                 <div className="text-center h-40 flex flex-col items-center justify-center border border-dashed rounded-xl">
                    <p className="text-muted-foreground">Nenhuma movimentação registrada.</p>
                 </div>
              ) : (
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[160px]">Data e Hora</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Motivo / Observação</TableHead>
                            <TableHead>Responsável</TableHead>
                            <TableHead className="text-right">Valor Registrado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {historyMovements.map(mov => {
                            const isPositive = mov.type === 'addition' || mov.type === 'refund';
                            const isAdjustment = mov.type === 'adjustment';
                            const typeMap: Record<string, string> = {
                                'addition': 'Lançamento',
                                'refund': 'Estorno',
                                'removal': 'Remoção',
                                'consume': 'Uso em Venda',
                                'adjustment': 'Ajuste de Edição'
                            };
                            return (
                                <TableRow key={mov.id}>
                                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(mov.createdAt)}</TableCell>
                                    <TableCell>
                                      <Badge variant={isPositive ? "default" : (isAdjustment ? "outline" : "secondary")} className={isPositive ? "bg-green-600 hover:bg-green-700" : (isAdjustment ? "text-amber-600 border-amber-600" : "bg-destructive/10 text-destructive border-transparent hover:bg-destructive/20")}>
                                        {typeMap[mov.type] || mov.type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={mov.reason}>{mov.reason}</TableCell>
                                    <TableCell>{mov.userName}</TableCell>
                                    <TableCell className={`text-right font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>{isPositive ? '+' : '-'}{formatCurrency(mov.amount)}</TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
              )}
           </div>
           <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => { setHistoryOpen(false); setHistoryCredit(null); setHistoryMovements([]); }}>Fechar Extrato</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
