
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
  PackageCheck,
  PackageX,
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
import { format, parseISO, startOfToday, addDays, isSameDay, startOfDay, endOfDay } from "date-fns";
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


export default function DailyRoutePage() {
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

  // State for rescheduling
  const [rescheduleItem, setRescheduleItem] = React.useState<ScheduleItem | null>(null);
  const [newDeliveryDate, setNewDeliveryDate] = React.useState<Date | undefined>(undefined);
  const [isRescheduling, setIsRescheduling] = React.useState(false);
  
  // State for team assignment
  const [assignTeamOrder, setAssignTeamOrder] = React.useState<SalesOrder | null>(null);
  const [assignTeamAstec, setAssignTeamAstec] = React.useState<AssistanceRequest | null>(null);
  const [selectedTeamId, setSelectedTeamId] = React.useState<string>("");
  const [isAssigning, setIsAssigning] = React.useState(false);
  
  // State for rejection
  const [rejectOrder, setRejectOrder] = React.useState<SalesOrder | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [isRejecting, setIsRejecting] = React.useState(false);

  // State for printing selection
  const [selectedItemsToPrint, setSelectedItemsToPrint] = React.useState<Set<string>>(new Set());
  const [selectedAstecToPrint, setSelectedAstecToPrint] = React.useState<Set<string>>(new Set());

  // ASTEC Laudo Modal State
  const [laudoModalOpen, setLaudoModalOpen] = React.useState(false);
  const [currentRequest, setCurrentRequest] = React.useState<AssistanceRequest | null>(null);
  const [technicalAnalysis, setTechnicalAnalysis] = React.useState("");
  const [solution, setSolution] = React.useState("");
  const [isSubmittingLaudo, setIsSubmittingLaudo] = React.useState(false);


  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      const dateStart = startOfDay(selectedDate).toISOString();
      const dateEnd = endOfDay(selectedDate).toISOString();

      const ordersQuery = query(collection(db, "salesOrders"), where("deliveryDate", ">=", dateStart), where("deliveryDate", "<=", dateEnd));
      const astecQuery = query(collection(db, "astec"), where("scheduledDate", ">=", dateStart), where("scheduledDate", "<=", dateEnd));

      const [userSnap, ordersSnap, astecSnap, branchesSnap, companyBranchesSnap, teamsSnap, driversSnap, assistantsSnap, saleTypesSnap, deliveryTypesSnap, freightCepRangesSnap] = await Promise.all([
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
        getDocs(collection(db, "freightCepRanges")),
      ]);
      
      const currentUserData = userSnap.exists() ? userSnap.data() as UserType : null;
      setUserData(currentUserData);

      const billedOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder)).filter(order => order.status === 'billed');
      const astecRequests = astecSnap.docs.map(d => ({ id: d.id, ...d.data() } as AssistanceRequest));

      const customerIds = [...new Set([
        ...billedOrders.map(o => o.customerId),
        ...astecRequests.map(r => r.customerId)
      ])].filter(Boolean);
      
      const customersList: Customer[] = [];
      if (customerIds.length > 0) {
          // Firebase 'in' is limited to 10
          for (let i = 0; i < customerIds.length; i += 10) {
              const chunk = customerIds.slice(i, i + 10);
              const q = query(collection(db, "customers"), where("__name__", "in", chunk));
              const snap = await getDocs(q);
              snap.docs.forEach(d => customersList.push({ id: d.id, ...d.data() } as Customer));
          }
      }
      setCustomers(customersList);

      setAllBilledOrders(billedOrders);
      setAllAstecRequests(astecRequests);

      setBranches(branchesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Branch)));
      setCompanyBranches(companyBranchesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CompanyBranch)));
      setTeams(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
      setDrivers(driversSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver)));
      setAssistants(assistantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryAssistant)));
      setSaleTypes(saleTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleType)));
      setDeliveryTypes(deliveryTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryType)));
      setFreightCepRanges(freightCepRangesSnap.docs.map(doc => ({id: doc.id, ...doc.data()} as FreightCepRange)));

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, user, selectedDate]);
  
  React.useEffect(() => {
    if (user) {
        fetchData();
    }
  }, [fetchData, user]);

  React.useEffect(() => {
    if (loading) return;
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    
    // We already filtered by date from the DB, but this ensures precision.
    const ordersForDate = allBilledOrders
      .filter(order => order.deliveryDate?.split('T')[0] === dateKey)
      .map(o => ({ type: 'order', data: o } as ScheduleItem));

    const astecsForDate = allAstecRequests
      .filter(req => req.scheduledDate?.split('T')[0] === dateKey)
      .map(r => ({ type: 'astec', data: r } as ScheduleItem));
    
    setItemsForDay([...ordersForDate, ...astecsForDate]);
    setSelectedItemsToPrint(new Set());
    setSelectedAstecToPrint(new Set());
    
  }, [allBilledOrders, allAstecRequests, selectedDate, loading]);

  const summaryData = React.useMemo(() => {
    const orders = itemsForDay.filter(item => item.type === 'order').map(item => item.data as SalesOrder);
    const astecs = itemsForDay.filter(item => item.type === 'astec').map(item => item.data as AssistanceRequest);
    
    return {
      totalOrders: orders.length,
      totalAstecs: astecs.length,
      ordersConcluido: orders.filter(o => o.deliveryStatus === 'concluido').length,
      ordersPendente: orders.filter(o => !o.deliveryStatus || o.deliveryStatus === 'pending').length,
      ordersRejeitado: orders.filter(o => o.deliveryStatus === 'rejeitado').length,
      ordersReagendado: orders.filter(o => o.deliveryStatus === 'reagendado').length,
      astecsFinished: astecs.filter(a => a.status === 'finished').length,
      astecsInProgress: astecs.filter(a => a.status === 'in_progress').length,
      astecsPending: astecs.filter(a => a.status === 'pending').length,
      astecsCancelled: astecs.filter(a => a.status === 'cancelled').length,
    };
  }, [itemsForDay]);

  const getBranchName = (companyBranchId?: string) => {
    if (!companyBranchId) return 'N/A';
    const companyBranch = companyBranches.find(cb => cb.id === companyBranchId);
    if (!companyBranch) return 'N/A';
    return branches.find(b => b.id === companyBranch.branchId)?.name || 'N/A';
  };
  
  const getDriverName = (driverId?: string) => drivers.find(d => d.id === driverId)?.name || 'Não definido';
  const getAssistantNames = (assistantIds?: string[]) => {
    if (!assistantIds || assistantIds.length === 0) return 'Nenhum';
    return assistantIds.map(id => assistants.find(a => a.id === id)?.name || '').filter(Boolean).join(', ');
  }
  const getSaleTypeName = (id: string) => saleTypes.find(st => st.id === id)?.name || 'N/A';
  const getDeliveryTypeName = (id: string) => deliveryTypes.find(dt => dt.id === id)?.name || 'N/A';
  
  const getRegionNameFromCep = (cep?: string) => {
    if (!cep) return 'Região não encontrada';
    const numericCep = parseInt(cep.replace(/\D/g, ''), 10);
    const range = freightCepRanges.find(r => {
        const start = parseInt(r.cepStart, 10);
        const end = parseInt(r.cepEnd, 10);
        return numericCep >= start && numericCep <= end;
    });
    return range?.name || 'Fora da área de cobertura';
  };

  const handleOpenRescheduleModal = (item: ScheduleItem) => {
    setRescheduleItem(item);
    const currentDateString = item.type === 'order' ? item.data.deliveryDate : item.data.scheduledDate;
    if (currentDateString) {
        // Correct way to handle timezone offset for date picker
        const dateString = currentDateString.split('T')[0];
        setNewDeliveryDate(new Date(`${dateString}T12:00:00`));
    } else {
        setNewDeliveryDate(new Date());
    }
  };
  
  const handleOpenAssignTeamModal = (item: ScheduleItem) => {
    if (item.type === 'order') {
      setAssignTeamOrder(item.data);
      const team = teams.find(t => t.driverId === item.data.driverId);
      setSelectedTeamId(team?.id || "");
    } else {
      setAssignTeamAstec(item.data);
      const team = teams.find(t => t.driverId === item.data.driverId);
      setSelectedTeamId(team?.id || "");
    }
  };
  
  const handleOpenRejectModal = (order: SalesOrder) => {
    setRejectOrder(order);
    setRejectionReason(order.rejectionReason || "");
  }

  const handleConfirmReschedule = async () => {
    if (!rescheduleItem || !newDeliveryDate) return;

    setIsRescheduling(true);
    try {
        let docRef, updateData;
        if (rescheduleItem.type === 'order') {
            docRef = doc(db, "salesOrders", rescheduleItem.data.id);
            updateData = {
                deliveryDate: format(newDeliveryDate, "yyyy-MM-dd") + "T00:00:00.000Z",
                deliveryStatus: 'reagendado',
            };
        } else { // 'astec'
            docRef = doc(db, "astec", rescheduleItem.data.id);
            updateData = {
                scheduledDate: format(newDeliveryDate, "yyyy-MM-dd") + "T00:00:00.000Z",
                // You might want a specific status for rescheduled ASTEC calls
            };
        }

        await updateDoc(docRef, updateData);
        toast({ title: "Reagendamento Concluído!", description: `A atividade foi reagendada com sucesso.` });
        setRescheduleItem(null);
        setNewDeliveryDate(undefined);
        fetchData();
    } catch (error) {
      console.error("Error rescheduling:", error);
      toast({ title: "Erro ao reagendar", variant: "destructive" });
    } finally {
      setIsRescheduling(false);
    }
  };
  
  const handleConfirmAssignment = async () => {
    if (!assignTeamOrder && !assignTeamAstec) return;
    if (!selectedTeamId) {
        toast({ title: "Nenhuma equipe selecionada", variant: "destructive" });
        return;
    }
    
    setIsAssigning(true);
    try {
        const team = teams.find(t => t.id === selectedTeamId);
        if(!team) throw new Error("Equipe não encontrada");
        
        const driver = drivers.find(d => d.id === team.driverId);
        const assistantNames = team.assistantIds.map(id => assistants.find(a => a.id === id)?.name || '');

        const docRef = assignTeamOrder ? doc(db, "salesOrders", assignTeamOrder.id) : doc(db, "astec", assignTeamAstec!.id);
        
        await updateDoc(docRef, {
            driverId: team.driverId,
            driverName: driver?.name || 'N/A',
            assistantIds: team.assistantIds,
            assistantNames: assistantNames,
        });

        toast({ title: "Equipe Atribuída!", description: `A equipe foi vinculada com sucesso.` });
        setAssignTeamOrder(null);
        setAssignTeamAstec(null);
        setSelectedTeamId("");
        fetchData();

    } catch (error) {
        toast({ title: "Erro ao atribuir equipe", variant: "destructive" });
    } finally {
        setIsAssigning(false);
    }
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
    } catch(error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };
  
  const handleAstecStatusChange = async (requestId: string, newStatus: AssistanceRequest['status']) => {
    if (newStatus === 'in_progress') {
        const requestToUpdate = allAstecRequests.find(r => r.id === requestId);
        if (requestToUpdate) {
            setCurrentRequest(requestToUpdate);
            setTechnicalAnalysis('');
            setSolution('');
            setLaudoModalOpen(true);
        }
        return;
    }

    try {
      const docRef = doc(db, "astec", requestId);
      await updateDoc(docRef, { status: newStatus, updatedAt: new Date().toISOString() });
      toast({ title: "Status do chamado atualizado com sucesso!" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const handleSaveLaudoAndStatus = async () => {
    if (!currentRequest || !user || !technicalAnalysis.trim() || !solution.trim()) {
      toast({ title: "Campos obrigatórios", description: "Laudo técnico e solução são necessários.", variant: "destructive" });
      return;
    }
    
    setIsSubmittingLaudo(true);
    const batch = writeBatch(db);

    try {
      // 1. Update ASTEC status
      const astecRef = doc(db, "astec", currentRequest.id);
      batch.update(astecRef, { status: 'in_progress', updatedAt: new Date().toISOString() });

      // 2. Create new Laudo document
      const laudoRef = doc(collection(db, "astecLaudos"));
      batch.set(laudoRef, {
        astecId: currentRequest.id,
        orderNumber: currentRequest.orderNumber,
        customerName: currentRequest.customerName,
        productName: currentRequest.items[0]?.productName || 'N/A', // Assuming one product for now
        problemReported: currentRequest.problemDescription,
        technicalAnalysis: technicalAnalysis.trim(),
        solution: solution.trim(),
        status: 'Pendente',
        createdAt: serverTimestamp(),
        createdByUserId: user.uid,
        createdByUserName: user.displayName,
      });

      await batch.commit();

      toast({ title: "Status atualizado e laudo criado!", description: "O chamado agora está 'Em Andamento'." });
      setLaudoModalOpen(false);
      setCurrentRequest(null);
      fetchData();

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSubmittingLaudo(false);
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
    } catch(error) {
      toast({ title: "Erro ao rejeitar entrega", variant: "destructive" });
    } finally {
      setIsRejecting(false);
    }
  }
  
  const handleTogglePrintSelection = (itemId: string, itemType: 'order' | 'astec') => {
    if (itemType === 'order') {
      const newSelection = new Set(selectedItemsToPrint);
      if (newSelection.has(itemId)) {
        newSelection.delete(itemId);
      } else {
        newSelection.add(itemId);
      }
      setSelectedItemsToPrint(newSelection);
    } else { // astec
      const newSelection = new Set(selectedAstecToPrint);
      if (newSelection.has(itemId)) {
        newSelection.delete(itemId);
      } else {
        newSelection.add(itemId);
      }
      setSelectedAstecToPrint(newSelection);
    }
  };
  
  const handlePrintOrders = () => {
    if (selectedItemsToPrint.size === 0) return;
    const ids = Array.from(selectedItemsToPrint).join(',');
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    router.push(`/dashboard/scheduling/print/${dateStr}?ids=${ids}`);
  };

  const handlePrintAstecs = () => {
    if (selectedAstecToPrint.size === 0) return;
    const ids = Array.from(selectedAstecToPrint).join(',');
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    router.push(`/dashboard/scheduling/print-astec/${dateStr}?ids=${ids}`);
  };

  const itemsByBranch = itemsForDay.reduce((acc, item) => {
    let branchId = "unknown";
    if (item.type === 'order') {
        branchId = item.data.companyBranchId || 'unknown-order';
    } else {
        branchId = `astec-${item.data.branchName || 'unknown'}`;
    }
    
    if (!acc[branchId]) acc[branchId] = [];
    acc[branchId].push(item);
    return acc;
  }, {} as Record<string, ScheduleItem[]>);


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
            <Car /> Rota do Dia
          </h1>
          <p className="text-muted-foreground">
            Acompanhe e gerencie suas entregas e atendimentos do dia.
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
                    <CalendarPicker mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus locale={ptBR} disabled={(date) => date < new Date() && !isSameDay(date, new Date())}/>
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
      
       <Card>
            <CardHeader>
                <CardTitle>Resumo do Dia</CardTitle>
                <CardDescription>{format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2"><ShoppingCart className="h-5 w-5"/> Pedidos ({summaryData.totalOrders})</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <p className="flex justify-between">Concluídos: <Badge variant="secondary">{summaryData.ordersConcluido}</Badge></p>
                        <p className="flex justify-between">Pendentes: <Badge variant="secondary">{summaryData.ordersPendente}</Badge></p>
                        <p className="flex justify-between">Rejeitados: <Badge variant="secondary">{summaryData.ordersRejeitado}</Badge></p>
                        <p className="flex justify-between">Reagendados: <Badge variant="secondary">{summaryData.ordersReagendado}</Badge></p>
                    </div>
                </div>
                <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2"><Wrench className="h-5 w-5"/> Atendimentos ASTEC ({summaryData.totalAstecs})</h3>
                     <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <p className="flex justify-between">Finalizados: <Badge variant="secondary">{summaryData.astecsFinished}</Badge></p>
                        <p className="flex justify-between">Em Andamento: <Badge variant="secondary">{summaryData.astecsInProgress}</Badge></p>
                        <p className="flex justify-between">Pendentes: <Badge variant="secondary">{summaryData.astecsPending}</Badge></p>
                        <p className="flex justify-between">Cancelados: <Badge variant="secondary">{summaryData.astecsCancelled}</Badge></p>
                    </div>
                </div>
            </CardContent>
        </Card>
      
      <div className="flex justify-end gap-2">
          <Button onClick={handlePrintOrders} disabled={selectedItemsToPrint.size === 0}>
              <Printer className="h-4 w-4 mr-2"/>
              Imprimir Pedidos ({selectedItemsToPrint.size})
          </Button>
          <Button onClick={handlePrintAstecs} disabled={selectedAstecToPrint.size === 0}>
              <Printer className="h-4 w-4 mr-2"/>
              Imprimir ASTECs ({selectedAstecToPrint.size})
          </Button>
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
            {Object.entries(itemsByBranch).map(([branchId, items]) => (
                <Card key={branchId}>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GitFork className="h-5 w-5 text-primary" />
                        {branchId.startsWith('astec-') ? `ASTEC - ${branchId.replace('astec-', '')}` : (branchId === 'unknown' ? 'Atendimentos ASTEC (Sem Filial)' : (branchId === 'unknown-order' ? 'Pedidos (Sem Filial)' : getBranchName(branchId)))}
                      </CardTitle>
                  </CardHeader>
                  <CardContent>
                  {items.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {items.map((item) => {
                           if (item.type === 'order') {
                               const order = item.data;
                               const needsStairs = (order.services || []).some(s => s.serviceName.toLowerCase().includes('subida de escada'));
                               const statusColor = getStatusBorderColor(order.deliveryStatus);
                               const region = getRegionNameFromCep(order.deliveryAddress?.cep);

                               return (
                                <Card key={order.id} className={cn("bg-card flex flex-col transition-all border-2", statusColor)}>
                                  <CardHeader>
                                      <div className="flex items-start justify-between">
                                          <div>
                                              <CardTitle className="text-base">Pedido #{order.orderNumber}</CardTitle>
                                              <CardDescription>{order.customerName}</CardDescription>
                                          </div>
                                          <Checkbox 
                                            checked={selectedItemsToPrint.has(order.id)} 
                                            onCheckedChange={() => handleTogglePrintSelection(order.id, 'order')}
                                            aria-label={`Selecionar pedido ${order.orderNumber}`}
                                          />
                                      </div>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm text-muted-foreground flex-1">
                                      <ul className="space-y-2">
                                        <li className="flex items-center gap-2"><MapPin className="h-4 w-4 flex-shrink-0" /><span>{order.deliveryAddress ? `${order.deliveryAddress.neighborhood}, ${order.deliveryAddress.city}`: "Endereço não informado"}</span></li>
                                        <li className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 flex-shrink-0" /><span>{getSaleTypeName(order.saleTypeId)}</span></li>
                                        <li className="flex items-center gap-2"><Truck className="h-4 w-4 flex-shrink-0" /><span>{getDeliveryTypeName(order.deliveryTypeId)}</span></li>
                                        <li className="flex items-center gap-2"><User className="h-4 w-4 flex-shrink-0" /><span>{order.createdByUserName}</span></li>
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
                                      <div className="mt-4 pt-3 border-t border-dashed">
                                          <h4 className="font-semibold text-foreground text-xs mb-2">EQUIPE DE ENTREGA</h4>
                                          <div className="flex items-center gap-2"><Car className="h-4 w-4 flex-shrink-0" /><span>{getDriverName(order.driverId)}</span></div>
                                          <div className="flex items-center gap-2"><Users className="h-4 w-4 flex-shrink-0" /><span>{getAssistantNames(order.assistantIds)}</span></div>
                                           {needsStairs && (
                                            <div className="bg-yellow-400 text-yellow-900 font-bold text-xs p-2 rounded-md text-center mt-3">
                                                Requer subida de escada
                                            </div>
                                          )}
                                      </div>
                                  </CardContent>
                                  <CardFooter className="flex flex-col gap-2">
                                       <div className="flex flex-col w-full gap-2">
                                        <Button variant="destructive" size="sm" className="w-full" onClick={() => handleStatusChange(order.id, 'rejeitado')} disabled={order.deliveryStatus === 'concluido' || order.deliveryStatus === 'rejeitado'}>
                                            <X className="h-4 w-4 mr-2"/> Rejeitar
                                        </Button>
                                        <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange(order.id, 'concluido')} disabled={order.deliveryStatus === 'concluido' || order.deliveryStatus === 'rejeitado'}>
                                            <Check className="h-4 w-4 mr-2"/> Concluir
                                        </Button>
                                      </div>
                                    <Button variant="secondary" size="sm" className="w-full" onClick={() => handleOpenRescheduleModal(item)}>
                                      <CalendarPlus className="h-4 w-4 mr-2" /> Reagendar
                                    </Button>
                                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleOpenAssignTeamModal(item)}>
                                      <Users className="h-4 w-4 mr-2" /> Atribuir Equipe
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
                                      <div className="flex items-start justify-between">
                                          <div>
                                              <CardTitle className="text-base text-amber-900 dark:text-amber-300 flex items-center gap-2"><Wrench/>Atendimento ASTEC #{req.assistanceNumber}</CardTitle>
                                              <CardDescription>{req.customerName}</CardDescription>
                                          </div>
                                          <Checkbox 
                                            checked={selectedAstecToPrint.has(req.id)} 
                                            onCheckedChange={() => handleTogglePrintSelection(req.id, 'astec')}
                                            aria-label={`Selecionar ASTEC ${req.assistanceNumber}`}
                                          />
                                      </div>
                                  </CardHeader>
                                  <CardContent className="flex-1 space-y-2 text-sm">
                                      {address && (
                                        <div className="space-y-1">
                                          <p className="flex items-center gap-2"><MapPin className="h-4 w-4 flex-shrink-0" /><span>{address.neighborhood}, {address.city}</span></p>
                                        </div>
                                      )}
                                      <p className="flex items-center gap-2"><User className="h-4 w-4 flex-shrink-0" /><span>{req.createdByUserName}</span></p>
                                      <div className="mt-4 pt-3 border-t border-dashed">
                                          <h4 className="font-semibold text-foreground text-xs mb-2">EQUIPE DE ATENDIMENTO</h4>
                                          <div className="flex items-center gap-2"><Car className="h-4 w-4 flex-shrink-0" /><span>{getDriverName(req.driverId)}</span></div>
                                          <div className="flex items-center gap-2"><Users className="h-4 w-4 flex-shrink-0" /><span>{getAssistantNames(req.assistantIds)}</span></div>
                                      </div>
                                       <div className="pt-2 border-t">
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
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full">
                                          <MoreHorizontal className="mr-2 h-4 w-4"/> Ações do Chamado
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleAstecStatusChange(req.id, 'in_progress')}>Em Andamento</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleAstecStatusChange(req.id, 'finished')}>Finalizado</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleAstecStatusChange(req.id, 'cancelled')} className="text-destructive">Cancelado</DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                    <Button variant="secondary" size="sm" className="w-full" onClick={() => handleOpenRescheduleModal(item)}>
                                      <CalendarPlus className="h-4 w-4 mr-2" /> Reagendar
                                    </Button>
                                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleOpenAssignTeamModal(item)}>
                                      <Users className="h-4 w-4 mr-2" /> Atribuir Equipe
                                    </Button>
                                  </CardFooter>
                                </Card>
                             )
                           }
                        })}
                        </div>
                  ) : (
                    <div className="col-span-full text-center text-sm text-muted-foreground py-10">
                      Nenhuma atividade agendada para este dia nesta filial.
                    </div>
                  )}
                  </CardContent>
                </Card>
            ))}
        </div>
      )}
      
      {rescheduleItem && (
         <Dialog open={!!rescheduleItem} onOpenChange={() => setRescheduleItem(null)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Reagendar {rescheduleItem.type === 'order' ? `Pedido #${rescheduleItem.data.orderNumber}` : `Atendimento #${rescheduleItem.data.assistanceNumber}`}</DialogTitle>
                    <DialogDescription>Selecione a nova data para a atividade.</DialogDescription>
                </DialogHeader>
                <div className="flex justify-center py-4">
              <CalendarPicker
                mode="single"
                selected={newDeliveryDate}
                onSelect={setNewDeliveryDate}
                locale={ptBR}
                disabled={(date) => date < new Date() && !isSameDay(date, new Date())}
              />
            </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => setRescheduleItem(null)}>Cancelar</Button>
                    <Button onClick={handleConfirmReschedule} disabled={isRescheduling}>
                        {isRescheduling && (<Loader2 className="mr-2 h-4 w-4 animate-spin" />)}
                        Confirmar Nova Data
                    </Button>
                </DialogFooter>
            </DialogContent>
         </Dialog>
      )}

      {(assignTeamOrder || assignTeamAstec) && (
         <Dialog open={!!assignTeamOrder || !!assignTeamAstec} onOpenChange={() => { setAssignTeamOrder(null); setAssignTeamAstec(null); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Atribuir Equipe ao Pedido #{(assignTeamOrder || assignTeamAstec)?.orderNumber || assignTeamAstec?.assistanceNumber}</DialogTitle>
                    <DialogDescription>Selecione a equipe que fará esta entrega ou atendimento.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione uma equipe..." />
                        </SelectTrigger>
                        <SelectContent>
                            {teams.map(team => (
                                <SelectItem key={team.id} value={team.id}>
                                    <div className="flex flex-col">
                                        <span>{team.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            Motorista: {team.driverName}
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => { setAssignTeamOrder(null); setAssignTeamAstec(null); }}>Cancelar</Button>
                    <Button onClick={handleConfirmAssignment} disabled={isAssigning || !selectedTeamId}>
                        {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirmar Equipe
                    </Button>
                </DialogFooter>
            </DialogContent>
         </Dialog>
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

      {currentRequest && (
        <Dialog open={laudoModalOpen} onOpenChange={setLaudoModalOpen}>
            <DialogContent>
            <DialogHeader>
                <DialogTitle>Registrar Laudo Técnico</DialogTitle>
                <DialogDescription>
                Preencha as informações do laudo para o chamado #{currentRequest?.assistanceNumber}. O status será alterado para "Em Andamento".
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                <Label htmlFor="technical-analysis">Análise Técnica</Label>
                <Textarea
                    id="technical-analysis"
                    value={technicalAnalysis}
                    onChange={(e) => setTechnicalAnalysis(e.target.value)}
                    placeholder="Descreva a análise técnica, defeitos encontrados, etc."
                    rows={5}
                />
                </div>
                <div className="space-y-2">
                <Label htmlFor="solution">Solução Aplicada / Proposta</Label>
                <Textarea
                    id="solution"
                    value={solution}
                    onChange={(e) => setSolution(e.target.value)}
                    placeholder="Descreva a solução aplicada ou a ser proposta para o cliente."
                    rows={3}
                />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setLaudoModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveLaudoAndStatus} disabled={isSubmittingLaudo}>
                {isSubmittingLaudo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Salvar e Mudar Status
                </Button>
            </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
