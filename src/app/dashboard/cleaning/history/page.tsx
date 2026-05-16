

"use client";

import * as React from "react";
import { Loader2, RefreshCw, History, Printer, Pencil, Plus, Minus, Save, Trash2, User as UserIcon, Search, Building2, Package, Banknote, Calendar, Frown } from "lucide-react";
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, where, addDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter as TableFoot
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { CleaningRequest, CleaningRequestItem, CleaningProduct, Status, RoleAccess, NavigationItem, Company, PriceColumnConfig } from "@/lib/definitions";
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";


export default function CleaningHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [requests, setRequests] = React.useState<CleaningRequest[]>([]);
  const [products, setProducts] = React.useState<CleaningProduct[]>([]);
  const [statuses, setStatuses] = React.useState<Status[]>([]);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [priceColumnConfig, setPriceColumnConfig] = React.useState<PriceColumnConfig>({ id: 'priceColumnConfig' });
  const [loading, setLoading] = React.useState(true);
  
  const [editingRequest, setEditingRequest] = React.useState<CleaningRequest | null>(null);
  const [requestToDelete, setRequestToDelete] = React.useState<CleaningRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [productSearchTerm, setProductSearchTerm] = React.useState("");
  const [orderItemSearchTerm, setOrderItemSearchTerm] = React.useState("");
  const [globalSearchTerm, setGlobalSearchTerm] = React.useState("");

  const filteredRequests = React.useMemo(() => {
    if (!globalSearchTerm) return requests;
    const lower = globalSearchTerm.toLowerCase();
    return requests.filter(r => 
       r.branchName.toLowerCase().includes(lower) || 
       (r.userName && r.userName.toLowerCase().includes(lower))
    );
  }, [requests, globalSearchTerm]);

  const summaryMetrics = React.useMemo(() => {
     let totalValue = 0;
     filteredRequests.forEach(r => totalValue += (r.totalValue || 0));
     return { count: filteredRequests.length, totalValue };
  }, [filteredRequests]);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [requestsSnap, productsSnap, statusesSnap, companiesSnap, configSnap] = await Promise.all([
        getDocs(query(collection(db, "cleaningRequests"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "cleaningProducts"), orderBy("name"))),
        getDocs(query(collection(db, "statuses"), orderBy("name"))),
        getDocs(query(collection(db, "companies"), orderBy("name"))),
        getDoc(doc(db, "settings", "priceColumnConfig")),
      ]);
      setRequests(requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CleaningRequest)));
      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CleaningProduct)));
      setStatuses(statusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Status)));
      setCompanies(companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company)));
      if (configSnap.exists()) {
        setPriceColumnConfig(configSnap.data() as PriceColumnConfig);
      }
    } catch (error) {
      toast({ title: "Erro ao buscar histórico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "Data inválida";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };
  
  const handleEditClick = (request: CleaningRequest) => {
    setEditingRequest(JSON.parse(JSON.stringify(request))); // Deep copy
    setProductSearchTerm("");
    setOrderItemSearchTerm("");
  };

  const handleProductSelection = (productId: string) => {
    if (!editingRequest) return;
    
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setEditingRequest(prev => {
        if (!prev) return null;
        const existingItem = prev.items.find(item => item.productId === productId);
        if (existingItem) {
            return { ...prev, items: prev.items.filter(item => item.productId !== productId) };
        } else {
            return { ...prev, items: [...prev.items, { 
                productId: product.id, 
                productName: product.name, 
                quantity: 1, 
                price: product.price,
                price2: product.price2,
                price3: product.price3
            }] };
        }
    });
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (!editingRequest || newQuantity < 1) return;
    setEditingRequest(prev => {
        if (!prev) return null;
        const newItems = prev.items.map(item => item.productId === productId ? { ...item, quantity: newQuantity } : item);
        const newTotalValue = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return { ...prev, items: newItems, totalValue: newTotalValue };
    });
  };

  const handleRemoveItem = (productId: string) => {
    if (!editingRequest) return;
    setEditingRequest(prev => {
        if (!prev) return null;
        const newItems = prev.items.filter(item => item.productId !== productId);
        const newTotalValue = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return { ...prev, items: newItems, totalValue: newTotalValue };
    });
  };

  const handleSaveChanges = async () => {
    if (!editingRequest) return;
    
    setIsSubmitting(true);
    try {
        const docRef = doc(db, "cleaningRequests", editingRequest.id);
        const itemsToSave = editingRequest.items;
        const totalValue = itemsToSave.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        await updateDoc(docRef, {
            items: itemsToSave,
            totalValue: totalValue
        });
        toast({ title: "Pedido Atualizado!", description: "As alterações foram salvas com sucesso." });
        setEditingRequest(null);
        fetchData();
    } catch (error) {
        toast({ title: "Erro ao salvar", description: "Não foi possível atualizar o pedido.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleStatusChange = async (request: CleaningRequest, newStatusId: string) => {
    try {
        const docRef = doc(db, "cleaningRequests", request.id);
        await updateDoc(docRef, { statusId: newStatusId });
        setRequests(prev => prev.map(r => r.id === request.id ? {...r, statusId: newStatusId} : r));
        toast({ title: "Status Atualizado!" });

        // Notification Logic
        const newStatus = statuses.find(s => s.id === newStatusId);
        if (newStatus?.shouldNotify) {
            const navItemsSnap = await getDocs(query(collection(db, 'navigation'), where('path', '==', '/dashboard/cleaning/history')));
            if(navItemsSnap.empty) return;
            const historyNavItemId = navItemsSnap.docs[0].id;

            const roleAccessSnap = await getDocs(query(collection(db, "roleAccess"), where('allowedNavIds', 'array-contains', historyNavItemId)));
            const targetRoleIds = roleAccessSnap.docs.map(doc => (doc.data() as RoleAccess).roleId);
            
            if (targetRoleIds.length > 0) {
                 const startDate = new Date();
                 const endDate = new Date();
                 endDate.setDate(startDate.getDate() + 1);

                 await addDoc(collection(db, "notifications"), {
                    title: "Atualização de Pedido de Limpeza",
                    text: `O pedido para a filial ${request.branchName} foi atualizado para: ${newStatus.name}.`,
                    createdAt: serverTimestamp(),
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    targetRoleIds,
                    link: "/dashboard/cleaning/history",
                    showOnEveryLogin: false,
                 });
            }
        }
    } catch (error) {
        console.error("Error updating status or sending notification:", error);
        toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };
  
  const handleDelete = async () => {
    if (!requestToDelete) return;
    try {
        await deleteDoc(doc(db, "cleaningRequests", requestToDelete.id));
        toast({ title: "Pedido Deletado", variant: "destructive" });
        fetchData();
    } catch (error) {
        toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
        setRequestToDelete(null);
    }
  };
  
  const getCompanyName = (companyId: string | null | undefined): string => companies.find(c => c.id === companyId)?.name || '';

  const totalValueForEditing = React.useMemo(() => editingRequest?.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0, [editingRequest]);
  const totalValue2ForEditing = React.useMemo(() => editingRequest?.items.reduce((sum, item) => sum + ((item.price2 || 0) * item.quantity), 0) || 0, [editingRequest]);
  const totalValue3ForEditing = React.useMemo(() => editingRequest?.items.reduce((sum, item) => sum + ((item.price3 || 0) * item.quantity), 0) || 0, [editingRequest]);


  const filteredProductsForEdit = React.useMemo(() => {
    if (!productSearchTerm) {
      return products;
    }
    return products.filter(product =>
      product.name.toLowerCase().includes(productSearchTerm.toLowerCase())
    );
  }, [products, productSearchTerm]);

  const filteredOrderItems = React.useMemo(() => {
    if (!editingRequest) return [];
    if (!orderItemSearchTerm) {
      return editingRequest.items;
    }
    return editingRequest.items.filter(item =>
      item.productName.toLowerCase().includes(orderItemSearchTerm.toLowerCase())
    );
  }, [editingRequest, orderItemSearchTerm]);

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <History className="text-primary h-8 w-8" /> Histórico de Pedidos
            </h1>
            <p className="text-muted-foreground text-sm">
              Visualize e gerencie as requisições de material de limpeza.
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="rounded-xl shadow-soft">
              <RefreshCw className={loading ? 'animate-spin h-4 w-4' : 'h-4 w-4'} />
          </Button>
        </div>

        {/* Dashboard Cards Top */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary"><Building2 className="h-5 w-5" /></div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Pedidos Filtrados</span>
                  </div>
                  <p className="text-xl font-bold font-mono tracking-tighter truncate">{summaryMetrics.count}</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-green-500/10 rounded-xl text-green-600"><Banknote className="h-5 w-5" /></div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Valor Global Estimado</span>
                  </div>
                  <p className="text-xl font-bold font-mono tracking-tighter truncate text-green-600">{formatCurrency(summaryMetrics.totalValue)}</p>
                </CardContent>
              </Card>
          </div>
        )}

        <Card className="border-none shadow-glass bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/10 pb-6 p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <CardTitle className="text-lg font-headline">Registros de Limpeza</CardTitle>
                    <CardDescription>
                      {loading ? "Carregando..." : `${filteredRequests.length} solicitações encontradas.`}
                    </CardDescription>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar filial ou usuário..."
                    className="pl-10 bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/20"
                    value={globalSearchTerm}
                    onChange={(e) => setGlobalSearchTerm(e.target.value)}
                  />
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 rounded-2xl border border-dashed border-border/50 bg-background/20">
                <Frown className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground font-medium">Nenhum pedido encontrado com este filtro.</p>
              </div>
            ) : (
             <AlertDialog>
              <Accordion type="multiple" className="w-full space-y-3">
                {filteredRequests.map(request => {
                  const currentStatus = statuses.find(s => s.id === request.statusId);
                  const totalValue2 = request.items.reduce((sum, item) => {
                      const product = products.find(p => p.id === item.productId);
                      return sum + ((product?.price2 || 0) * item.quantity);
                  }, 0);
                  const totalValue3 = request.items.reduce((sum, item) => {
                      const product = products.find(p => p.id === item.productId);
                      return sum + ((product?.price3 || 0) * item.quantity);
                  }, 0);
                  return (
                  <AccordionItem value={request.id} key={request.id} className="border border-border/50 rounded-2xl overflow-hidden transition-all hover:border-primary/20 hover:shadow-sm bg-background/40">
                    <AccordionTrigger className="p-5 hover:no-underline hover:bg-muted/5 group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-4 pr-4 text-left">
                            <div className="flex-1 space-y-1">
                                <p className="font-bold text-lg text-foreground/80 group-hover:text-primary transition-colors cursor-pointer">{request.branchName}</p>
                                <div className="text-[10px] text-muted-foreground/60 flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 uppercase font-bold tracking-wider">
                                    <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md"><UserIcon className="h-3 w-3" /> {request.userName}</span>
                                    <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md"><Calendar className="h-3 w-3" /> {formatDate(request.createdAt)}</span>
                                </div>
                            </div>
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                                {currentStatus && (
                                    <Badge style={{ backgroundColor: currentStatus.color, color: '#fff' }} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                                        {currentStatus.name}
                                    </Badge>
                                )}
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest hidden md:block border-b border-transparent">Total</span>
                                    <p className="text-xl font-bold font-mono tracking-tighter text-foreground">{formatCurrency(request.totalValue)}</p>
                                </div>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-1">
                      <div className="flex flex-col sm:flex-row justify-end items-center gap-4 mb-4 pb-4 border-b border-border/10">
                        <div className="flex items-center gap-2">
                            <Label htmlFor={`status-${request.id}`} className="text-xs font-bold uppercase tracking-widest text-muted-foreground mr-1">Status:</Label>
                            <Select value={request.statusId || ""} onValueChange={(value) => handleStatusChange(request, value)}>
                                <SelectTrigger id={`status-${request.id}`} className="w-[180px] h-9 rounded-xl bg-background/50 border-border/50 text-xs font-semibold">
                                    <SelectValue placeholder="Definir Status" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {statuses.map(status => (
                                        <SelectItem key={status.id} value={status.id} className="font-medium text-xs">{status.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="rounded-xl h-9">
                                        <Pencil className="mr-2 h-3.5 w-3.5 text-primary" /> Gerenciar
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl">
                                    <DropdownMenuItem onClick={() => handleEditClick(request)} className="font-medium">
                                        <Pencil className="mr-2 h-4 w-4 text-primary"/> Editar Itens
                                    </DropdownMenuItem>
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="font-medium">
                                            <Printer className="mr-2 h-4 w-4 text-foreground/70" />
                                            <span>Imprimir Guia</span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                            <DropdownMenuSubContent className="rounded-xl">
                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/cleaning/history/${request.id}`)} className="font-medium">
                                                    Com Valores Monetários
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/cleaning/history/${request.id}?showValues=false`)} className="font-medium text-muted-foreground">
                                                    Formato Simplificado (Sem Valores)
                                                </DropdownMenuItem>
                                            </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                    </DropdownMenuSub>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem className="text-red-600 font-medium hover:bg-destructive/10" onSelect={(e) => { e.preventDefault(); setRequestToDelete(request); }}>
                                          <Trash2 className="mr-2 h-4 w-4"/> Deletar Pedido
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                      </div>
                      <div className="bg-background/20 rounded-xl overflow-hidden border border-border/10">
                          <Table>
                              <TableHeader className="bg-muted/10">
                                  <TableRow className="border-border/10">
                                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-3 h-auto">Produto Solicitado</TableHead>
                                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-3 h-auto text-center w-32">Qtd.</TableHead>
                                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-3 h-auto text-right">{getCompanyName(priceColumnConfig.price1CompanyId) || "Subtotal 1"}</TableHead>
                                      {priceColumnConfig.price2CompanyId && <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-3 h-auto text-right">{getCompanyName(priceColumnConfig.price2CompanyId)}</TableHead>}
                                      {priceColumnConfig.price3CompanyId && <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-3 h-auto text-right">{getCompanyName(priceColumnConfig.price3CompanyId)}</TableHead>}
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {request.items.map(item => {
                                      const product = products.find(p => p.id === item.productId);
                                      return (
                                      <TableRow key={item.productId} className="border-border/5 hover:bg-primary/5 transition-colors">
                                          <TableCell className="font-bold text-sm text-foreground/80 py-3">{item.productName}</TableCell>
                                          <TableCell className="text-center py-3"><Badge variant="outline" className="font-mono bg-background text-xs">{item.quantity}</Badge></TableCell>
                                          <TableCell className="text-right font-mono font-medium py-3 text-primary">{formatCurrency(item.price * item.quantity)}</TableCell>
                                          {priceColumnConfig.price2CompanyId && <TableCell className="text-right font-mono text-muted-foreground py-3">{formatCurrency((product?.price2 || 0) * item.quantity)}</TableCell>}
                                          {priceColumnConfig.price3CompanyId && <TableCell className="text-right font-mono text-muted-foreground py-3">{formatCurrency((product?.price3 || 0) * item.quantity)}</TableCell>}
                                      </TableRow>
                                  )})}
                              </TableBody>
                               <TableFoot>
                                  <TableRow className="bg-muted/5">
                                      <TableCell colSpan={2} className="text-right text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-4">Total</TableCell>
                                      <TableCell className="text-right font-bold font-mono text-base text-foreground py-4">{formatCurrency(request.totalValue)}</TableCell>
                                      {priceColumnConfig.price2CompanyId && <TableCell className="text-right font-bold font-mono text-base text-muted-foreground/70 py-4">{formatCurrency(totalValue2)}</TableCell>}
                                      {priceColumnConfig.price3CompanyId && <TableCell className="text-right font-bold font-mono text-base text-muted-foreground/70 py-4">{formatCurrency(totalValue3)}</TableCell>}
                                  </TableRow>
                              </TableFoot>
                          </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )})}
              </Accordion>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Essa ação não pode ser desfeita. Isso irá deletar permanentemente o pedido para a filial <strong className="mx-1">{requestToDelete?.branchName}</strong>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRequestToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Sim, deletar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      </div>
      
      {editingRequest && (
        <Dialog open={true} onOpenChange={(open) => !open && setEditingRequest(null)}>
          <DialogContent className="max-w-5xl rounded-3xl p-6 bg-background/95 backdrop-blur-3xl border-border/20 shadow-glass">
              <DialogHeader className="mb-4">
                  <DialogTitle className="text-2xl font-headline flex items-center gap-2 text-primary">
                    <Pencil className="h-6 w-6"/> Editar Pedido <span className="text-foreground/80 font-medium text-lg ml-2 block">({editingRequest.branchName})</span>
                  </DialogTitle>
                  <DialogDescription className="text-sm">Altere os produtos e a quantidade do pedido atual antes de salvá-lo novamamente.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-2 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                <div className="lg:col-span-1">
                    <Card className="border-none shadow-soft bg-card/60 rounded-3xl overflow-hidden h-full flex flex-col">
                        <CardHeader className="bg-muted/10 border-b border-border/10 p-5">
                            <CardTitle className="text-base font-headline">Produtos Disponíveis</CardTitle>
                            <div className="relative mt-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar produto..."
                                    value={productSearchTerm}
                                    onChange={(e) => setProductSearchTerm(e.target.value)}
                                    className="pl-10 bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/20 h-9 text-sm"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-[300px]">
                            <div className="space-y-2">
                                {filteredProductsForEdit.map(product => {
                                    const isChecked = editingRequest.items.some(i => i.productId === product.id);
                                    return (
                                    <div key={product.id} className={`flex items-start space-x-3 rounded-2xl border p-3 transition-colors cursor-pointer ${isChecked ? 'border-primary/50 bg-primary/5 shadow-sm' : 'border-border/30 hover:border-primary/30 hover:bg-muted/5'}`} onClick={() => handleProductSelection(product.id)}>
                                        <Checkbox 
                                            id={`edit-product-${product.id}`} 
                                            checked={isChecked} 
                                            onCheckedChange={() => handleProductSelection(product.id)} 
                                            onClick={(e) => e.stopPropagation()}
                                            className="mt-1"
                                        />
                                        <div className="flex-1 space-y-1">
                                            <Label htmlFor={`edit-product-${product.id}`} className="font-bold text-foreground/90 cursor-pointer pointer-events-none text-xs">{product.name}</Label>
                                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                {priceColumnConfig.price1CompanyId && <Badge variant="secondary" className="text-[9px] font-mono font-medium px-2 py-0">{formatCurrency(product.price)}</Badge>}
                                            </div>
                                        </div>
                                    </div>
                                )})}
                                {filteredProductsForEdit.length === 0 && (
                                    <div className="text-center text-muted-foreground py-8 flex flex-col items-center gap-2">
                                         <Search className="h-6 w-6 text-muted-foreground/30" />
                                        <p className="text-xs">Nenhum produto encontrado.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2">
                    <Card className="border-none shadow-glass bg-card/60 backdrop-blur-md rounded-3xl overflow-hidden h-full flex flex-col">
                        <CardHeader className="bg-muted/5 border-b border-border/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                           <CardTitle className="text-base font-headline">Itens do Pedido</CardTitle>
                             <div className="relative w-full sm:w-64">
                                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar item anexado..."
                                    value={orderItemSearchTerm}
                                    onChange={(e) => setOrderItemSearchTerm(e.target.value)}
                                    className="pl-10 bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/20 h-9 text-sm"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-0 min-h-[300px]">
                            {editingRequest.items.length > 0 ? (
                                <Table>
                                    <TableHeader className="bg-muted/20 sticky top-0 backdrop-blur-md z-10">
                                        <TableRow className="border-border/10">
                                            <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-3 h-auto">Produto</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-3 h-auto text-center w-28">Qtd.</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-3 h-auto text-right">{getCompanyName(priceColumnConfig.price1CompanyId) || "Subtotal"}</TableHead>
                                            {priceColumnConfig.price2CompanyId && <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-3 h-auto text-right hidden sm:table-cell">{getCompanyName(priceColumnConfig.price2CompanyId)}</TableHead>}
                                            {priceColumnConfig.price3CompanyId && <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground py-3 h-auto text-right hidden sm:table-cell">{getCompanyName(priceColumnConfig.price3CompanyId)}</TableHead>}
                                            <TableHead className="w-10"><span className="sr-only">Remover</span></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredOrderItems.map(item => (
                                            <TableRow key={item.productId} className="border-border/5 hover:bg-primary/5 transition-colors">
                                                <TableCell className="font-bold text-xs text-foreground/80 py-3">{item.productName}</TableCell>
                                                <TableCell className="py-3">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <Button size="icon" variant="outline" className="h-6 w-6 rounded-lg" onClick={() => handleQuantityChange(item.productId, item.quantity - 1)} disabled={item.quantity <= 1}>
                                                            <Minus className="h-3 w-3"/>
                                                        </Button>
                                                        <Input type="number" value={item.quantity} onChange={e => handleQuantityChange(item.productId, parseInt(e.target.value))} className="w-12 h-6 text-center font-mono text-xs rounded-md bg-background/50 border-border/50 no-spinners px-1" min="1"/>
                                                        <Button size="icon" variant="outline" className="h-6 w-6 rounded-lg" onClick={() => handleQuantityChange(item.productId, item.quantity + 1)}>
                                                            <Plus className="h-3 w-3"/>
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono font-medium text-primary text-right py-3 text-xs">{formatCurrency(item.price * item.quantity)}</TableCell>
                                                {priceColumnConfig.price2CompanyId && <TableCell className="font-mono text-muted-foreground text-right py-3 text-xs hidden sm:table-cell">{formatCurrency((item.price2 || 0) * item.quantity)}</TableCell>}
                                                {priceColumnConfig.price3CompanyId && <TableCell className="font-mono text-muted-foreground text-right py-3 text-xs hidden sm:table-cell">{formatCurrency((item.price3 || 0) * item.quantity)}</TableCell>}
                                                <TableCell className="text-center py-3">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => handleRemoveItem(item.productId)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        <span className="sr-only">Remover</span>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFoot>
                                        <TableRow className="bg-muted/10 border-t border-border/10">
                                            <TableCell colSpan={2} className="text-right text-[10px] uppercase font-bold tracking-widest py-4">Total Avaliado</TableCell>
                                            <TableCell className="text-right font-bold font-mono text-sm text-foreground py-4">{formatCurrency(totalValueForEditing)}</TableCell>
                                            {priceColumnConfig.price2CompanyId && <TableCell className="text-right font-bold font-mono text-sm text-muted-foreground/70 py-4 hidden sm:table-cell">{formatCurrency(totalValue2ForEditing)}</TableCell>}
                                            {priceColumnConfig.price3CompanyId && <TableCell className="text-right font-bold font-mono text-sm text-muted-foreground/70 py-4 hidden sm:table-cell">{formatCurrency(totalValue3ForEditing)}</TableCell>}
                                            <TableCell />
                                        </TableRow>
                                    </TableFoot>
                                </Table>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[200px]">
                                    <Package className="h-10 w-10 text-muted-foreground/30 mb-3"/>
                                    <p className="text-sm text-muted-foreground font-medium">Selecione os produtos que participam do pedido.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
              </div>
              <DialogFooter className="mt-4 pt-4 border-t border-border/10">
                  <Button variant="outline" className="rounded-xl h-11" onClick={() => setEditingRequest(null)} disabled={isSubmitting}>Cancelar Edição</Button>
                  <Button onClick={handleSaveChanges} className="rounded-xl h-11 shadow-md hover:scale-[1.02] transition-transform" disabled={isSubmitting || editingRequest.items.length === 0}>
                      {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="mr-2 h-4 w-4"/>}
                      Confirmar Alterações
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      )}
    </>
  );
}
