
"use client";

import * as React from "react";
import {
  Loader2,
  Filter,
  RefreshCw,
  Frown,
  Calendar as CalendarIcon,
  ChevronDown,
  X,
  Printer,
  Check,
  PackageCheck,
  Truck,
  Hourglass,
  XCircle,
  Clock,
  CheckCircle,
  Save,
  Send,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { SalesOrder, AssistanceRequest, Branch, Driver, Team, CompanyBranch, DeliveryPaymentOrder, DeliveryPaymentOrderItem } from "@/lib/definitions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format, isValid, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";


type ReportItem = {
  id: string;
  type: 'Pedido' | 'ASTEC';
  number: number;
  date: string;
  branchName: string;
  teamName: string;
  driverName: string;
  baseFreight: number;
  finalFreight: number;
  isRescheduled: boolean;
  status: string;
};

const statusConfig: { [key: string]: { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ReactNode; className?: string } } = {
  // Order Statuses
  pending: { label: "Pendente", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  concluido: { label: "Concluído", variant: "default", icon: <CheckCircle className="h-3 w-3" />, className: "bg-green-600 hover:bg-green-700" },
  rejeitado: { label: "Rejeitado", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  reagendado: { label: "Reagendado", variant: "outline", icon: <CalendarIcon className="h-3 w-3" />, className: "text-yellow-600 border-yellow-500" },
  // ASTEC Statuses
  in_progress: { label: "Em Andamento", variant: "outline", icon: <Hourglass className="h-3 w-3" />, className: "text-yellow-600 border-yellow-500" },
  finished: { label: "Finalizado", variant: "default", icon: <CheckCircle className="h-3 w-3" />, className: "bg-green-600 hover:bg-green-700" },
  cancelled: { label: "Cancelado", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
};


const MultiSelectFilter = ({
  placeholder,
  options,
  selectedValues,
  onSelectionChange,
}: {
  placeholder: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onSelectionChange: (value: string) => void;
}) => {
    
  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      options.forEach(opt => onSelectionChange(opt.value));
    } else {
      options.forEach(opt => {
        if (!selectedValues.includes(opt.value)) {
          onSelectionChange(opt.value);
        }
      });
    }
  }

  const selectedLabels = selectedValues.length > 2 
    ? `${selectedValues.length} selecionados` 
    : options.filter(opt => selectedValues.includes(opt.value)).map(opt => opt.label).join(', ');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">{selectedValues.length > 0 ? selectedLabels : placeholder}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto">
        <DropdownMenuLabel>{placeholder}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={options.length > 0 && selectedValues.length === options.length}
          onCheckedChange={handleSelectAll}
          onSelect={e => e.preventDefault()}
        >
          Selecionar Todos
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={() => onSelectionChange(option.value)}
            onSelect={e => e.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default function DeliveryPaymentPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [allOrders, setAllOrders] = React.useState<SalesOrder[]>([]);
  const [allAstecs, setAllAstecs] = React.useState<AssistanceRequest[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [teams, setTeams] = React.useState<Team[]>([]);
  
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const [selectedBranches, setSelectedBranches] = React.useState<string[]>([]);
  const [selectedDrivers, setSelectedDrivers] = React.useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) => {
    setter(prev => {
        const newSelection = [...prev];
        const index = newSelection.indexOf(id);
        if (index > -1) {
            newSelection.splice(index, 1);
        } else {
            newSelection.push(id);
        }
        return newSelection;
    });
  };

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [
        ordersSnap,
        astecsSnap,
        branchesSnap,
        companyBranchesSnap,
        driversSnap,
        teamsSnap,
      ] = await Promise.all([
        getDocs(query(collection(db, "salesOrders"), where("deliveryStatus", "==", "concluido"))),
        getDocs(query(collection(db, "astec"), where("status", "==", "finished"))),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "companyBranches")),
        getDocs(collection(db, "drivers")),
        getDocs(collection(db, "teams")),
      ]);

      setAllOrders(ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SalesOrder)));
      setAllAstecs(astecsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AssistanceRequest)));
      setBranches(branchesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Branch)));
      setCompanyBranches(companyBranchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompanyBranch)));
      setDrivers(driversSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Driver)));
      setTeams(teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Team)));
    } catch (error) {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData: ReportItem[] = React.useMemo(() => {
    const fromDate = dateRange?.from;
    const toDate = dateRange?.to;

    const getBranchIdFromItem = (item: SalesOrder | AssistanceRequest): string | null => {
        if ('companyBranchId' in item) { // It's a SalesOrder
            const order = item as SalesOrder;
            const companyBranch = companyBranches.find(cb => cb.id === order.companyBranchId);
            return companyBranch?.branchId || null;
        }
        return (item as AssistanceRequest).branchId || null;
    };
    
    const getBranchNameFromItem = (item: SalesOrder | AssistanceRequest): string => {
        if ('companyBranchId' in item) { // It's a SalesOrder
          const order = item as SalesOrder;
          const companyBranch = companyBranches.find(cb => cb.id === order.companyBranchId);
          if (!companyBranch) return 'N/A';
          return branches.find(b => b.id === companyBranch.branchId)?.name || 'N/A';
        }
        return (item as AssistanceRequest).branchName || 'N/A';
    }
    
    const allItems: ({item: SalesOrder | AssistanceRequest, itemType: 'Pedido' | 'ASTEC', itemDate: string, itemNumber: number, status: string})[] = [
      ...allOrders.map(o => ({item: o, itemType: 'Pedido' as const, itemDate: o.deliveryDate!, itemNumber: o.orderNumber, status: o.deliveryStatus || 'pending'})),
      ...allAstecs.map(a => ({item: a, itemType: 'ASTEC' as const, itemDate: a.scheduledDate!, itemNumber: a.assistanceNumber || 0, status: a.status}))
    ];

    const results = allItems
      .filter(({ itemDate }) => {
        if (!itemDate || !fromDate) return true;
        const localDateString = itemDate.split('T')[0];
        const itemDateLocal = new Date(`${localDateString}T12:00:00`);
        if (!isValid(itemDateLocal)) return false;
        return isWithinInterval(itemDateLocal, { start: startOfDay(fromDate), end: endOfDay(toDate || fromDate) });
      })
      .filter(({ item }) => {
        const branchId = getBranchIdFromItem(item);
        if (selectedBranches.length > 0 && (!branchId || !selectedBranches.includes(branchId))) return false;
        
        if (selectedDrivers.length > 0 && item.driverId && !selectedDrivers.includes(item.driverId)) return false;
        
        if (selectedTeams.length > 0) {
            const team = teams.find(t => t.driverId === item.driverId);
            if (!team || !selectedTeams.includes(team.id)) return false;
        }

        return true;
      })
      .map(({item, itemType, itemDate, itemNumber, status}) => {
        const branchName = getBranchNameFromItem(item);
        const driver = drivers.find(d => d.id === item.driverId);
        const team = teams.find(t => t.driverId === item.driverId);

        let baseFreight = item.freightValue || 0;
        let finalFreight = baseFreight;
        
        if (driver && driver.discounts && driver.discounts.length > 0) {
            driver.discounts.forEach(discount => {
                if (discount.type === 'fixed') {
                    finalFreight -= discount.value;
                } else if (discount.type === 'percentage') {
                    finalFreight -= finalFreight * (discount.value / 100);
                }
            });
        }
        
        const isRescheduled = itemType === 'Pedido' && (item as SalesOrder).deliveryStatus === 'reagendado';

        return {
          id: item.id,
          type: itemType,
          number: itemNumber,
          date: itemDate,
          branchName: branchName,
          teamName: team?.name || "N/A",
          driverName: driver?.name || "N/A",
          baseFreight: baseFreight,
          finalFreight: finalFreight,
          isRescheduled: isRescheduled,
          status: status,
        };
      });
      
      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return results;
  }, [dateRange, selectedBranches, selectedDrivers, selectedTeams, allOrders, allAstecs, branches, companyBranches, drivers, teams]);

  const totalFreight = filteredData.reduce((sum, item) => sum + item.finalFreight, 0);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const [year, month, day] = dateString.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
    } catch(e) {
        console.warn("Could not parse date:", dateString, e);
        return "Data inválida";
    }
  };
  
  const handleGeneratePaymentOrder = async () => {
    if (filteredData.length === 0 || !selectedDrivers.length || selectedDrivers.length > 1) {
      toast({ title: "Seleção inválida", description: "Por favor, filtre por exatamente um motorista para gerar a ordem.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
        const driverId = selectedDrivers[0];
        const driverName = drivers.find(d => d.id === driverId)?.name || 'N/A';
        const itemsToPay: DeliveryPaymentOrderItem[] = filteredData.map(item => ({
            itemId: item.id,
            type: item.type,
            number: item.number,
            date: item.date,
            baseFreight: item.baseFreight,
            finalFreight: item.finalFreight,
        }));

        const newOrder: Omit<DeliveryPaymentOrder, 'id'> = {
            driverId,
            driverName,
            periodStartDate: dateRange?.from?.toISOString() || new Date().toISOString(),
            periodEndDate: dateRange?.to?.toISOString() || new Date().toISOString(),
            totalAmount: totalFreight,
            items: itemsToPay,
            status: 'pending',
            generatedAt: new Date().toISOString(),
        };

        const docRef = await addDoc(collection(db, 'deliveryPaymentOrders'), newOrder);
        toast({ title: "Ordem de Pagamento Gerada!", description: "A ordem foi salva e pode ser consultada no histórico." });
        router.push(`/dashboard/delivery-payment/history/${docRef.id}`);

    } catch (error) {
        console.error(error);
        toast({ title: "Erro ao gerar ordem", variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  };

  const clearAllFilters = () => {
    setSelectedBranches([]);
    setSelectedDrivers([]);
    setSelectedTeams([]);
    setDateRange({ from: new Date(), to: new Date() });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Ordem de Pagamento (Entrega)</h1>
          <p className="text-muted-foreground">Gere ordens de pagamento para os motoristas com base nas entregas concluídas.</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            <Popover>
                <PopoverTrigger asChild>
                    <Button id="date" variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "LLL dd, y", {locale: ptBR})} - ${format(dateRange.to, "LLL dd, y", {locale: ptBR})}` : format(dateRange.from, "LLL dd, y")) : <span>Selecione a data</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR}/>
                </PopoverContent>
            </Popover>

            <MultiSelectFilter
              placeholder="Filial"
              options={branches.map(b => ({value: b.id, label: b.name}))}
              selectedValues={selectedBranches}
              onSelectionChange={handleFilterChange(setSelectedBranches)}
            />
            <MultiSelectFilter
              placeholder="Motorista"
              options={drivers.map(d => ({value: d.id, label: d.name}))}
              selectedValues={selectedDrivers}
              onSelectionChange={handleFilterChange(setSelectedDrivers)}
            />
             <MultiSelectFilter
              placeholder="Equipe"
              options={teams.map(t => ({value: t.id, label: t.name}))}
              selectedValues={selectedTeams}
              onSelectionChange={handleFilterChange(setSelectedTeams)}
            />
            <Button variant="ghost" onClick={clearAllFilters}>
              <X className="mr-2 h-4 w-4" /> Limpar Filtros
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : filteredData.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                <Frown className="h-16 w-16 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">Nenhum registro encontrado</h2>
                <p className="mt-2 text-sm text-muted-foreground">Tente ajustar os filtros para encontrar resultados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido/ASTEC</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead className="text-right">Frete a Receber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => {
                  const currentStatus = statusConfig[item.status] || { label: item.status, variant: "secondary", icon: <PackageCheck className="h-3 w-3" /> };
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant={item.type === 'Pedido' ? "default" : "outline"} className={cn(item.type === 'ASTEC' && "text-amber-600 border-amber-500")}>
                          {item.type} #{item.number}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(item.date)}</TableCell>
                       <TableCell>
                        <Badge variant={currentStatus.variant} className={cn("gap-1.5", currentStatus.className)}>
                          {currentStatus.icon}
                          {currentStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.branchName}</TableCell>
                      <TableCell>{item.teamName}</TableCell>
                      <TableCell>{item.driverName}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(item.finalFreight)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="text-lg font-bold">
                    <TableCell colSpan={6} className="text-right">Total a Pagar</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalFreight)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
        <CardFooter>
            <Button 
                onClick={handleGeneratePaymentOrder} 
                disabled={isSubmitting || filteredData.length === 0 || selectedDrivers.length !== 1}
            >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                Gerar Ordem de Pagamento
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

    
