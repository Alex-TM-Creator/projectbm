
"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  User as UserIcon,
  ChevronRight,
  MoreHorizontal,
  Package,
  Check,
  X,
  Truck,
  Minus,
  Plus,
  Printer,
  RefreshCw,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy as firestoreOrderBy,
  doc,
  updateDoc,
  serverTimestamp,
  where,
  writeBatch,
  addDoc,
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
} from "@/components/ui/card";
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
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { TransferOrder, Branch, StockingLocation, User, TransferOrderItem, Product } from "@/lib/definitions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

const statusConfig: { [key in TransferOrder['status']]: { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string } } = {
  pending: { label: "Pendente", variant: "secondary" },
  separating: { label: "Em Separação", variant: "outline" },
  in_transit: { label: "Em Trânsito", variant: "default" },
  received: { label: "Recebido", variant: "default", className: "bg-green-600 hover:bg-green-700" },
  received_partially: { label: "Recebido Parcialmente", variant: "default", className: "bg-yellow-500 hover:bg-yellow-600" },
  returned: { label: "Devolvido", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export default function TransferHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<User | null>(null);
  const [orders, setOrders] = React.useState<TransferOrder[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [stockingLocations, setStockingLocations] = React.useState<StockingLocation[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  const [isReceiving, setIsReceiving] = React.useState(false);
  const [receivingOrder, setReceivingOrder] = React.useState<TransferOrder | null>(null);
  const [receivedItems, setReceivedItems] = React.useState<Map<string, number>>(new Map());


  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      const userDocSnap = await getDoc(doc(db, "users", user.uid));
      const currentUserData = userDocSnap.exists() ? userDocSnap.data() as User : null;
      setUserData(currentUserData);

      let ordersQuery;
      if (currentUserData?.isAdmin) {
        ordersQuery = query(collection(db, "transferOrders"), firestoreOrderBy("createdAt", "desc"));
      } else if (currentUserData?.branchId) {
        const originQuery = query(collection(db, "transferOrders"), where("originBranchId", "==", currentUserData.branchId));
        const destinationQuery = query(collection(db, "transferOrders"), where("destinationBranchId", "==", currentUserData.branchId));
        const [originSnap, destinationSnap] = await Promise.all([ getDocs(originQuery), getDocs(destinationQuery) ]);
        const combinedOrders = new Map<string, TransferOrder>();
        originSnap.docs.forEach(d => combinedOrders.set(d.id, { id: d.id, ...d.data() } as TransferOrder));
        destinationSnap.docs.forEach(d => combinedOrders.set(d.id, { id: d.id, ...d.data() } as TransferOrder));
        const sortedOrders = Array.from(combinedOrders.values()).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setOrders(sortedOrders);
      } else {
        setOrders([]);
      }
      
      if(currentUserData?.isAdmin && ordersQuery) {
         const ordersSnap = await getDocs(ordersQuery);
         setOrders(ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as TransferOrder)));
      }

      const [branchesSnap, locationsSnap, productsSnap] = await Promise.all([
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "stockingLocations")),
        getDocs(collection(db, "products")),
      ]);

      setBranches(branchesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Branch)));
      setStockingLocations(locationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockingLocation)));
      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));

    } catch (error) {
      toast({ title: "Erro ao buscar histórico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  React.useEffect(() => {
    if (user && !authLoading) {
      fetchData();
    }
  }, [fetchData, user, authLoading]);
  
  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || 'N/A';
  const getProductInfo = (productId: string) => products.find(p => p.id === productId);

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "N/A";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };
  
  const handleOpenReceiveModal = (order: TransferOrder) => {
    setReceivingOrder(order);
    const initialQuantities = new Map<string, number>();
    order.items.forEach(item => {
      initialQuantities.set(item.productId, item.quantity);
    });
    setReceivedItems(initialQuantities);
  };

  const handleCloseReceiveModal = () => {
    setReceivingOrder(null);
    setReceivedItems(new Map());
  };
  
  const handleReceivedQuantityChange = (productId: string, quantity: number) => {
    const originalItem = receivingOrder?.items.find(i => i.productId === productId);
    if (!originalItem || quantity < 0 || quantity > originalItem.quantity) {
      toast({ title: "Quantidade inválida", description: "A quantidade recebida não pode ser maior que a enviada ou negativa.", variant: "destructive" });
      return;
    }
    const newItems = new Map(receivedItems);
    newItems.set(productId, quantity);
    setReceivedItems(newItems);
  };
  
  const handleConfirmReception = async () => {
    if (!receivingOrder || !userData) return;

    setIsReceiving(true);
    const batch = writeBatch(db);
    try {
        const destinationDefaultLocation = stockingLocations.find(loc => loc.branchId === receivingOrder.destinationBranchId);
        const originDefaultLocation = stockingLocations.find(loc => loc.branchId === receivingOrder.originBranchId);
        
        if (!destinationDefaultLocation || !originDefaultLocation) {
            toast({ title: "Local de estoque não encontrado", description: "As filiais de origem e destino precisam ter um local de estocagem padrão.", variant: "destructive" });
            setIsReceiving(false);
            return;
        }

        let isPartial = false;
        const updatedItems: TransferOrderItem[] = [];

        for (const item of receivingOrder.items) {
            const receivedQuantity = receivedItems.get(item.productId) ?? 0;
            const returnedQuantity = item.quantity - receivedQuantity;

            if (receivedQuantity > 0) {
                const stockQuery = query(collection(db, "productStock"), where("productId", "==", item.productId), where("stockingLocationId", "==", destinationDefaultLocation.id));
                const stockSnap = await getDocs(stockQuery);
                if (!stockSnap.empty) {
                    const stockDoc = stockSnap.docs[0];
                    batch.update(stockDoc.ref, { quantity: (stockDoc.data().quantity || 0) + receivedQuantity });
                } else {
                    batch.set(doc(collection(db, "productStock")), { productId: item.productId, stockingLocationId: destinationDefaultLocation.id, quantity: receivedQuantity });
                }
                 batch.set(doc(collection(db, "stockMovements")), { productId: item.productId, stockingLocationId: destinationDefaultLocation.id, type: 'transfer', quantityChange: receivedQuantity, reason: 'Entrada por Transferência', relatedDocId: receivingOrder.id, createdAt: serverTimestamp(), userId: userData.id, userName: userData.name });
            }

            if (returnedQuantity > 0) {
                isPartial = true;
                const stockQuery = query(collection(db, "productStock"), where("productId", "==", item.productId), where("stockingLocationId", "==", originDefaultLocation.id));
                const stockSnap = await getDocs(stockQuery);
                if (!stockSnap.empty) {
                    const stockDoc = stockSnap.docs[0];
                    batch.update(stockDoc.ref, { quantity: (stockDoc.data().quantity || 0) + returnedQuantity });
                } else {
                    batch.set(doc(collection(db, "productStock")), { productId: item.productId, stockingLocationId: originDefaultLocation.id, quantity: returnedQuantity });
                }
                 batch.set(doc(collection(db, "stockMovements")), { productId: item.productId, stockingLocationId: originDefaultLocation.id, type: 'transfer', quantityChange: returnedQuantity, reason: 'Devolução por Transferência Parcial', relatedDocId: receivingOrder.id, createdAt: serverTimestamp(), userId: userData.id, userName: userData.name });
            }
            updatedItems.push({ ...item, receivedQuantity });
        }
        
        const docRef = doc(db, "transferOrders", receivingOrder.id);
        batch.update(docRef, {
            status: isPartial ? 'received_partially' : 'received',
            items: updatedItems,
            receivedAt: serverTimestamp(),
            receivedByUserId: userData.id,
            receivedByName: userData.name,
        });
        
        await batch.commit();
        toast({ title: "Recebimento Confirmado!", description: "O estoque foi atualizado com sucesso."});
        handleCloseReceiveModal();
        fetchData();
        
    } catch(error) {
        console.error(error);
        toast({ title: "Erro ao confirmar recebimento", variant: "destructive" });
    } finally {
        setIsReceiving(false);
    }
  }


  const handleUpdateStatus = async (order: TransferOrder, status: TransferOrder['status']) => {
    if (!userData) return;
    const docRef = doc(db, "transferOrders", order.id);
    const batch = writeBatch(db);

    try {
      const updateData: Partial<TransferOrder> = { 
        status,
        updatedByUserId: userData.id,
        updatedByName: userData.name,
      };
      
      const originDefaultLocation = stockingLocations.find(loc => loc.branchId === order.originBranchId);
     
      if (status === 'in_transit') {
        if (!originDefaultLocation) {
          toast({ title: "Local de estoque não encontrado", description: `A filial de origem (${getBranchName(order.originBranchId)}) não possui um local de estocagem padrão.`, variant: "destructive" });
          return;
        }
        updateData.shippedAt = serverTimestamp();
        updateData.shippedByUserId = userData.id;
        updateData.shippedByName = userData.name;
        
        for (const item of order.items) {
          const stockQuery = query(collection(db, "productStock"), where("productId", "==", item.productId), where("stockingLocationId", "==", originDefaultLocation.id));
          const stockSnap = await getDocs(stockQuery);

          if (!stockSnap.empty) {
            const stockDoc = stockSnap.docs[0];
            const currentQuantity = stockDoc.data().quantity || 0;
            batch.update(stockDoc.ref, { quantity: currentQuantity - item.quantity });
          } else {
             batch.set(doc(collection(db, "productStock")), {
                 productId: item.productId,
                 stockingLocationId: originDefaultLocation.id,
                 quantity: -item.quantity
             });
          }

          batch.set(doc(collection(db, "stockMovements")), {
            productId: item.productId,
            stockingLocationId: originDefaultLocation.id,
            type: 'transfer',
            quantityChange: -item.quantity,
            reason: 'Saída por Transferência',
            relatedDocId: order.id,
            createdAt: serverTimestamp(),
            userId: userData.id,
            userName: userData.name,
          });
        }
      } else if (status === 'returned') {
          // If the order is returned BEFORE being shipped
          if (order.status === 'pending' || order.status === 'separating') {
             // No stock movement needed, just change the status
          } else if (order.status === 'in_transit') {
             // If it's in transit, it needs to be returned to origin stock
             if (!originDefaultLocation) {
                toast({ title: "Local de estoque de origem não encontrado", variant: "destructive" });
                return;
             }
              for (const item of order.items) {
                const stockQuery = query(collection(db, "productStock"), where("productId", "==", item.productId), where("stockingLocationId", "==", originDefaultLocation.id));
                const stockSnap = await getDocs(stockQuery);
                if (!stockSnap.empty) {
                    const stockDoc = stockSnap.docs[0];
                    batch.update(stockDoc.ref, { quantity: (stockDoc.data().quantity || 0) + item.quantity });
                }
                 batch.set(doc(collection(db, "stockMovements")), { productId: item.productId, stockingLocationId: originDefaultLocation.id, type: 'transfer', quantityChange: item.quantity, reason: 'Devolução de Transferência', relatedDocId: order.id, createdAt: serverTimestamp(), userId: userData.id, userName: userData.name });
              }
          }
      }
      
      batch.update(docRef, updateData);
      await batch.commit();

      toast({ title: "Status Atualizado!", description: `O pedido agora está como "${statusConfig[status].label}".`});
      fetchData();
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao atualizar status", description: "Ocorreu um problema ao tentar atualizar o pedido e o estoque.", variant: "destructive" });
    }
  };


  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Histórico de Transferências</h1>
          <p className="text-muted-foreground">Visualize e gerencie todas as solicitações de transferência de estoque.</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
        </Button>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Ordens de Transferência</CardTitle>
            <CardDescription>{orders.length} ordens encontradas.</CardDescription>
        </CardHeader>
        <CardContent>
            {loading ? (
                 <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
                <Accordion type="multiple" className="w-full space-y-3">
                    {orders.map(order => {
                        const currentStatus = statusConfig[order.status] || { label: "Desconhecido", variant: "secondary" };
                        const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
                        const canManageOrigin = userData?.isAdmin || userData?.branchId === order.originBranchId;
                        const canManageDestination = userData?.isAdmin || userData?.branchId === order.destinationBranchId;

                        return (
                            <AccordionItem value={order.id} key={order.id} className="border rounded-lg">
                                <AccordionTrigger className="p-4 hover:no-underline text-left">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2">
                                        <div className="flex items-center gap-3 font-semibold text-lg">
                                            <GitFork className="h-5 w-5"/>
                                            <span>{getBranchName(order.originBranchId)}</span>
                                            <ChevronRight className="h-5 w-5 text-muted-foreground"/>
                                            <span>{getBranchName(order.destinationBranchId)}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <UserIcon className="h-4 w-4"/>
                                                <span>{order.requesterName}</span>
                                            </div>
                                             <Badge variant={currentStatus.variant} className={currentStatus.className}>{currentStatus.label}</Badge>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 pt-0">
                                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-muted-foreground mb-4 pb-4 border-b">
                                        <div>
                                            <p><strong className="text-foreground">Criado em:</strong> {formatDate(order.createdAt)}</p>
                                            {order.shippedAt && <p><strong className="text-foreground">Enviado em:</strong> {formatDate(order.shippedAt)} por {order.shippedByName || 'N/A'}</p>}
                                            {order.receivedAt && <p><strong className="text-foreground">Recebido em:</strong> {formatDate(order.receivedAt)} por {order.receivedByName || 'N/A'}</p>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="sm">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="ml-2">Ações</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Ações do Pedido</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/transfers/history/${order.id}`)}>
                                                        <Printer className="mr-2 h-4 w-4" /> Imprimir
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuLabel>Alterar Status</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(order, 'separating')} disabled={order.status !== 'pending' || !canManageOrigin}>
                                                      <Package className="mr-2 h-4 w-4" /> Em Separação
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(order, 'in_transit')} disabled={order.status !== 'separating' || !canManageOrigin}>
                                                      <Truck className="mr-2 h-4 w-4" /> Em Trânsito
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleOpenReceiveModal(order)} disabled={order.status !== 'in_transit' || !canManageDestination}>
                                                      <Check className="mr-2 h-4 w-4" /> Receber
                                                    </DropdownMenuItem>
                                                     <DropdownMenuItem onClick={() => handleUpdateStatus(order, 'returned')} disabled={order.status === 'received' || order.status === 'returned' || order.status === 'cancelled' || !canManageDestination}>
                                                      <X className="mr-2 h-4 w-4 text-destructive" /> Devolvido
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                     </div>
                                      <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Produto</TableHead>
                                                <TableHead className="w-24 text-right">Enviado</TableHead>
                                                <TableHead className="w-24 text-right">Recebido</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {order.items.map(item => {
                                                const product = getProductInfo(item.productId);
                                                return (
                                                <TableRow key={item.productId}>
                                                    <TableCell>
                                                        <div className="font-medium">{item.productName}</div>
                                                        {product?.internalCode && <div className="text-xs text-muted-foreground font-mono">Cód: {product.internalCode}</div>}
                                                    </TableCell>
                                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                                    <TableCell className="text-right font-semibold">{item.receivedQuantity ?? ' - '}</TableCell>
                                                </TableRow>
                                            )})}
                                        </TableBody>
                                      </Table>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    })}
                </Accordion>
            )}
        </CardContent>
      </Card>

       {receivingOrder && (
         <Dialog open={!!receivingOrder} onOpenChange={(open) => !open && handleCloseReceiveModal()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Confirmar Recebimento de Transferência</DialogTitle>
                    <DialogDescription>
                        Confirme as quantidades recebidas para cada produto. Se uma quantidade menor for inserida, o saldo retornará ao estoque de origem.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto p-1">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead className="w-24 text-center">Enviado</TableHead>
                                <TableHead className="w-40 text-center">Recebido</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {receivingOrder.items.map(item => (
                                <TableRow key={item.productId}>
                                    <TableCell>{item.productName}</TableCell>
                                    <TableCell className="text-center">{item.quantity}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-center gap-2">
                                             <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleReceivedQuantityChange(item.productId, (receivedItems.get(item.productId) || 0) - 1)}><Minus className="h-4 w-4"/></Button>
                                             <Input 
                                                type="number" 
                                                className="h-8 w-16 text-center" 
                                                value={receivedItems.get(item.productId) || ''}
                                                onChange={e => handleReceivedQuantityChange(item.productId, parseInt(e.target.value, 10) || 0)}
                                                max={item.quantity}
                                                min={0}
                                             />
                                             <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleReceivedQuantityChange(item.productId, (receivedItems.get(item.productId) || 0) + 1)}><Plus className="h-4 w-4"/></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={handleCloseReceiveModal} disabled={isReceiving}>Cancelar</Button>
                    <Button onClick={handleConfirmReception} disabled={isReceiving}>
                        {isReceiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                        Confirmar Recebimento
                    </Button>
                </DialogFooter>
            </DialogContent>
         </Dialog>
       )}
    </div>
  );
}
