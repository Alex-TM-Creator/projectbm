
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Calendar as CalendarIcon,
  Frown,
  ChevronLeft,
  ChevronRight,
  User,
  GitFork,
  MapPin,
  Car,
  Users,
  ShoppingCart,
  Truck,
  Printer,
  X,
  AlertCircle,
  RefreshCw,
  Check,
  Wrench,
  CalendarPlus,
  Home,
  Phone,
  MoreHorizontal,
  FileText,
  Clock,
  Hourglass,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  getDoc,
  writeBatch,
  serverTimestamp,
  addDoc,
  limit,
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
import { useToast } from "@/hooks/use-toast";
import type { SalesOrder, Branch, CompanyBranch, Driver, DeliveryAssistant, Team, SaleType, DeliveryType, DeliveryStatus, User as UserType, AssistanceRequest, Customer, FreightCepRange } from "@/lib/definitions";
import { format, parseISO, startOfToday, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type ScheduleItem =
  | { type: 'order', data: SalesOrder }
  | { type: 'astec', data: AssistanceRequest };

const astecStatusConfig: Record<AssistanceRequest['status'], { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ReactNode; className?: string }> = {
  pending: { label: "Pendente", variant: "destructive", icon: <Clock className="h-3 w-3" /> },
  in_progress: { label: "Em Andamento", variant: "outline", icon: <Hourglass className="h-3 w-3" />, className: "text-yellow-600 border-yellow-500" },
  finished: { label: "Finalizado", variant: "default", icon: <CheckCircle className="h-3 w-3" />, className: "bg-green-600 hover:bg-green-700" },
  cancelled: { label: "Cancelado", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
};


export default function MyRoutePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<UserType | null>(null);
  const [allBilledOrders, setAllBilledOrders] = React.useState<SalesOrder[]>([]);
  const [allAstecRequests, setAllAstecRequests] = React.useState<AssistanceRequest[]>([]);
  const [itemsForDay, setItemsForDay] = React.useState<ScheduleItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedDate, setSelectedDate] = React.useState<Date>(startOfToday());
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [assistants, setAssistants] = React.useState<DeliveryAssistant[]>([]);
  const [saleTypes, setSaleTypes] = React.useState<SaleType[]>([]);
  const [deliveryTypes, setDeliveryTypes] = React.useState<DeliveryType[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [freightCepRanges, setFreightCepRanges] = React.useState<FreightCepRange[]>([]);

  // State for rejection
  const [rejectOrder, setRejectOrder] = React.useState<SalesOrder | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [isRejecting, setIsRejecting] = React.useState(false);


  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      const ordersQuery = query(collection(db, "salesOrders"), where("status", "==", "billed"));
      const astecQuery = query(collection(db, "astec"));

      const [userSnap, ordersSnap, astecSnap, branchesSnap, companyBranchesSnap, teamsSnap, driversSnap, assistantsSnap, saleTypesSnap, deliveryTypesSnap, customersSnap, freightCepRangesSnap] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDocs(ordersQuery),
        getDocs(astecQuery),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "companyBranches")),
        getDocs(collection(db, "teams")),
        getDocs(collection(db, "drivers")),
        getDocs(collection(db, "deliveryAssistants")),
        getDocs(collection(db, "saleTypes")),
        getDocs(collection(db, "deliveryTypes")),
        getDocs(collection(db, "customers")),
        getDocs(collection(db, "freightCepRanges")),
      ]);

      const currentUserData = userSnap.exists() ? userSnap.data() as UserType : null;
      setUserData(currentUserData);

      const billedOrders = ordersSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as SalesOrder))
        .filter(order => !!order.deliveryDate);

      const astecRequests = astecSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as AssistanceRequest))
        .filter(req => !!req.scheduledDate);

      setAllBilledOrders(billedOrders);
      setAllAstecRequests(astecRequests);

      setBranches(branchesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Branch)));
      setCompanyBranches(companyBranchesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CompanyBranch)));
      setTeams(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
      setDrivers(driversSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver)));
      setAssistants(assistantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryAssistant)));
      setSaleTypes(saleTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleType)));
      setDeliveryTypes(deliveryTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryType)));
      setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      setFreightCepRanges(freightCepRangesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FreightCepRange)));

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  React.useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  React.useEffect(() => {
    if (loading || !userData) return;

    const dateKey = format(selectedDate, "yyyy-MM-dd");
    let userDeliveries: SalesOrder[] = [];
    let userAstecs: AssistanceRequest[] = [];

    const driverRecord = drivers.find(d => d.userId === userData.id);
    const assistantRecord = assistants.find(a => a.userId === userData.id);

    if (driverRecord) {
      userDeliveries = allBilledOrders.filter(order => order.driverId === driverRecord.id);
      userAstecs = allAstecRequests.filter(req => req.driverId === driverRecord.id);
    } else if (assistantRecord) {
      userDeliveries = allBilledOrders.filter(order =>
        order.assistantIds && order.assistantIds.includes(assistantRecord.id)
      );
      userAstecs = allAstecRequests.filter(req =>
        req.assistantIds && req.assistantIds.includes(assistantRecord.id)
      );
    }

    const ordersForDate = userDeliveries
      .filter(order => order.deliveryDate?.split('T')[0] === dateKey)
      .map(o => ({ type: 'order', data: o } as ScheduleItem));

    const astecsForDate = userAstecs
      .filter(req => req.scheduledDate?.split('T')[0] === dateKey)
      .map(r => ({ type: 'astec', data: r } as ScheduleItem));

    setItemsForDay([...ordersForDate, ...astecsForDate]);

  }, [allBilledOrders, allAstecRequests, selectedDate, loading, userData, drivers, assistants, teams]);

  const getBranchName = (companyBranchId?: string) => {
    if (!companyBranchId) return 'N/A';
    const companyBranch = companyBranches.find(cb => cb.id === companyBranchId);
    if (!companyBranch) return 'N/A';
    return branches.find(b => b.id === companyBranch.branchId)?.name || 'N/A';
  };

  const getSaleTypeName = (id: string) => saleTypes.find(st => st.id === id)?.name || 'N/A';
  const getDeliveryTypeName = (id: string) => deliveryTypes.find(dt => dt.id === id)?.name || 'N/A';

  const handleOpenRejectModal = (order: SalesOrder) => {
    setRejectOrder(order);
    setRejectionReason(order.rejectionReason || "");
  }

  const handleStatusChange = async (orderId: string, status: DeliveryStatus) => {
    if (status === 'rejeitado') {
      const order = allBilledOrders.find(o => o.id === orderId);
      if (order) handleOpenRejectModal(order);
      return;
    }

    try {
      const orderRef = doc(db, "salesOrders", orderId);
      await updateDoc(orderRef, { deliveryStatus: status });
      toast({ title: "Status da entrega atualizado!" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const handleAstecStatusChange = async (requestId: string, newStatus: AssistanceRequest['status']) => {
    try {
      const docRef = doc(db, "astec", requestId);
      await updateDoc(docRef, { status: newStatus, updatedAt: new Date().toISOString() });
      toast({ title: "Status do chamado atualizado com sucesso!" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };


  const handleConfirmRejection = async () => {
    if (!rejectOrder || !rejectionReason.trim()) {
      toast({ title: "Observação obrigatória", description: "É necessário informar o motivo da rejeição.", variant: "destructive" });
      return;
    }
    setIsRejecting(true);
    try {
      const orderRef = doc(db, "salesOrders", rejectOrder.id);
      await updateDoc(orderRef, {
        deliveryStatus: 'rejeitado',
        rejectionReason: rejectionReason,
      });
      toast({ title: "Entrega Rejeitada!", description: "O status do pedido foi atualizado." });
      setRejectOrder(null);
      setRejectionReason("");
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao rejeitar entrega", variant: "destructive" });
    } finally {
      setIsRejecting(false);
    }
  }

  const getStatusBorderColor = (status?: DeliveryStatus) => {
    switch (status) {
      case 'concluido': return 'border-green-500 ring-green-500';
      case 'reagendado': return 'border-yellow-500 ring-yellow-500';
      case 'rejeitado': return 'border-red-500 ring-red-500';
      default: return 'border-border';
    }
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Car /> Minha Rota
          </h1>
          <p className="text-muted-foreground">
            Acompanhe e gerencie suas entregas do dia.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setSelectedDate(prev => addDays(prev, -1))}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "PPP", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarPicker mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus locale={ptBR} disabled={(date) => date < new Date() && !isSameDay(date, new Date())} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={() => setSelectedDate(prev => addDays(prev, 1))}>
            Próximo
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      {loading || authLoading ? (
        <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : itemsForDay.length === 0 ? (
        <Card className="flex flex-col items-center justify-center h-96 text-center">
          <CardContent>
            <Frown className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="font-semibold">Nenhuma atividade agendada para você hoje.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {itemsForDay.map((item) => {
              if (item.type === 'order') {
                const order = item.data;
                const needsStairs = (order.services || []).some(s => s.serviceName.toLowerCase().includes('subida de escada'));
                const statusColor = getStatusBorderColor(order.deliveryStatus);

                return (
                  <Card key={order.id} className={cn("bg-card flex flex-col transition-all border-2", statusColor)}>
                    <CardHeader>
                      <CardTitle className="text-base">Pedido #{order.orderNumber}</CardTitle>
                      <CardDescription>{order.customerName}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground flex-1">
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span>
                            {order.deliveryAddress
                              ? `${order.deliveryAddress.neighborhood}, ${order.deliveryAddress.city}`
                              : "Endereço não informado"}
                          </span>
                        </li>
                        <li className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 flex-shrink-0" /><span>{getSaleTypeName(order.saleTypeId)}</span></li>
                        <li className="flex items-center gap-2"><Truck className="h-4 w-4 flex-shrink-0" /><span>{getDeliveryTypeName(order.deliveryTypeId)}</span></li>
                        <li className="flex items-center gap-2"><GitFork className="h-4 w-4 flex-shrink-0" /><span>{getBranchName(order.companyBranchId)}</span></li>
                      </ul>
                      {order.rejectionReason && (
                        <div className="p-2 rounded-md bg-destructive/10 text-destructive text-xs flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-semibold">Motivo da Rejeição:</span>
                            <p>{order.rejectionReason}</p>
                          </div>
                        </div>
                      )}
                      {needsStairs && (
                        <div className="bg-yellow-400 text-yellow-900 font-bold text-xs p-2 rounded-md text-center mt-3">
                          Requer subida de escada
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex gap-2">
                      <Button variant="destructive" size="sm" className="w-full" onClick={() => handleStatusChange(order.id, 'rejeitado')} disabled={order.deliveryStatus === 'concluido' || order.deliveryStatus === 'rejeitado'}>
                        <X className="h-4 w-4 mr-2" /> Rejeitar
                      </Button>
                      <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange(order.id, 'concluido')} disabled={order.deliveryStatus === 'concluido' || order.deliveryStatus === 'rejeitado'}>
                        <Check className="h-4 w-4 mr-2" /> Concluir
                      </Button>
                    </CardFooter>
                  </Card>
                )
              } else {
                const req = item.data;
                const customer = customers.find(c => c.id === req.customerId);
                const address = req.deliveryAddress || customer?.addresses[0];
                const currentAstecStatus = astecStatusConfig[req.status] || { label: 'Desconhecido', variant: 'secondary', icon: <Wrench /> };
                return (
                  <Card key={req.id} className="bg-amber-50 dark:bg-amber-900/20 border-amber-500/50 flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-base text-amber-900 dark:text-amber-300 flex items-center gap-2"><Wrench />Atendimento ASTEC #{req.assistanceNumber}</CardTitle>
                      <CardDescription>{req.customerName}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-2 text-sm">
                      {address && (
                        <div className="space-y-1">
                          <p className="flex items-center gap-2"><MapPin className="h-4 w-4 flex-shrink-0" /><span>{address.neighborhood}, {address.city}</span></p>
                        </div>
                      )}
                      <p className="flex items-center gap-2"><User className="h-4 w-4 flex-shrink-0" /><span>{req.createdByUserName}</span></p>
                      <div className="pt-2">
                        <p className="font-semibold">Problema Relatado:</p>
                        <p className="text-muted-foreground text-xs p-2 bg-background rounded-md">{req.problemDescription}</p>
                      </div>
                      <div className="pt-2">
                        <Button variant={currentAstecStatus.variant} className={cn("gap-1.5 w-full pointer-events-none", currentAstecStatus.className)}>
                          {currentAstecStatus.icon}
                          {currentAstecStatus.label}
                        </Button>
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                      <Button variant="destructive" size="sm" className="w-full" onClick={() => handleAstecStatusChange(req.id, 'cancelled')} disabled={req.status === 'finished' || req.status === 'cancelled'}>
                        <X className="h-4 w-4 mr-2" /> Cancelar
                      </Button>
                      <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleAstecStatusChange(req.id, 'finished')} disabled={req.status === 'finished' || req.status === 'cancelled'}>
                        <Check className="h-4 w-4 mr-2" /> Finalizar
                      </Button>
                    </CardFooter>
                  </Card>
                )
              }
            })}
          </div>
        </div>
      )}

      {rejectOrder && (
        <Dialog open={!!rejectOrder} onOpenChange={() => setRejectOrder(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar Entrega do Pedido #{rejectOrder.orderNumber}</DialogTitle>
              <DialogDescription>Por favor, informe o motivo da rejeição da entrega.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="rejection-reason">Motivo da Rejeição</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Endereço não localizado, cliente ausente..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOrder(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleConfirmRejection} disabled={isRejecting || !rejectionReason}>
                {isRejecting ? <Loader2 className="animate-spin" /> : <X className="mr-2" />}
                Confirmar Rejeição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

