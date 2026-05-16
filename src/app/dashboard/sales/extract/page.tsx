
"use client";

import * as React from "react";
import {
  Loader2,
  RefreshCw,
  Frown,
  Undo2,
  User as UserIcon,
  ShoppingCart,
  GitFork,
  CreditCard,
  Search,
  FileX,
  CalendarIcon,
  ChevronDown,
  X,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { SalesOrder, Service, SaleType, Branch, CompanyBranch, User } from "@/lib/definitions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


type StatementItem = {
  order: SalesOrder;
  branchName: string;
  saleTypeName: string;
  sellerName: string;
  services: { [serviceId: string]: number };
  totalReceived: number;
  proportionalFreight: number;
  proportionalServices: number;
  netReceived: number;
  isReversal: boolean;
  eventDate: any;
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


export default function SalesExtractPage() {
  const { toast } = useToast();
  const [reportData, setReportData] = React.useState<StatementItem[]>([]);
  const [allServices, setAllServices] = React.useState<Service[]>([]);
  const [allUsers, setAllUsers] = React.useState<User[]>([]);
  const [allBranches, setAllBranches] = React.useState<Branch[]>([]);
  const [allSaleTypes, setAllSaleTypes] = React.useState<SaleType[]>([]);
  const [allCompanyBranches, setAllCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Filters State
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [selectedBranchIds, setSelectedBranchIds] = React.useState<string[]>([]);
  const [selectedSellerIds, setSelectedSellerIds] = React.useState<string[]>([]);
  const [selectedSaleTypeIds, setSelectedSaleTypeIds] = React.useState<string[]>([]);
  const [displayLimit, setDisplayLimit] = React.useState(20);

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
        servicesSnap,
        branchesSnap,
        companyBranchesSnap,
        saleTypesSnap,
        usersSnap,
      ] = await Promise.all([
        getDocs(query(collection(db, "salesOrders"))),
        getDocs(query(collection(db, "services"))),
        getDocs(query(collection(db, "branches"))),
        getDocs(collection(db, "companyBranches")),
        getDocs(query(collection(db, "saleTypes"))),
        getDocs(collection(db, "users")),
      ]);

      const services = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service));
      const branches = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch));
      const companyBranches = companyBranchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyBranch));
      const saleTypes = saleTypesSnap.docs.map(d => ({ id: d.id, ...d.data() } as SaleType));
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));

      setAllServices(services);
      setAllUsers(users);
      setAllBranches(branches);
      setAllSaleTypes(saleTypes);
      setAllCompanyBranches(companyBranches);

      const getBranchName = (companyBranchId?: string) => {
        if (!companyBranchId) return 'N/A';
        const companyBranch = companyBranches.find(cb => cb.id === companyBranchId);
        if (!companyBranch) return 'N/A';
        return branches.find(b => b.id === companyBranch.branchId)?.name || 'N/A';
      };

      const getSaleTypeName = (id: string) => saleTypes.find(st => st.id === id)?.name || 'N/A';

      let data: StatementItem[] = [];

      ordersSnap.docs.forEach(doc => {
        const order = { id: doc.id, ...doc.data() } as SalesOrder;

        // Group paid installments by date
        const paidInstallmentsByDate = (order.payments || [])
          .flatMap(p => p.installments || [])
          .filter(inst => inst.paidAt)
          .reduce((acc, inst) => {
            const date = inst.paidAt?.toDate ? format(inst.paidAt.toDate(), 'yyyy-MM-dd') : format(new Date(inst.paidAt || 0), 'yyyy-MM-dd');
            if (!acc[date]) {
              acc[date] = { totalReceived: 0, dateObj: inst.paidAt };
            }
            acc[date].totalReceived += inst.value;
            return acc;
          }, {} as Record<string, { totalReceived: number; dateObj: any }>);

        // Create a statement item for each day with payments
        Object.entries(paidInstallmentsByDate).forEach(([date, { totalReceived, dateObj }]) => {
          const receivedRatio = order.total > 0 ? totalReceived / order.total : 0;
          const proportionalFreight = (order.freightValue || 0) * receivedRatio;
          const proportionalServicesMap: { [serviceId: string]: number } = {};
          (order.services || []).forEach(service => {
            proportionalServicesMap[service.serviceId] = service.price * receivedRatio;
          });
          const proportionalServicesTotal = Object.values(proportionalServicesMap).reduce((sum, val) => sum + val, 0);
          const netReceived = totalReceived - proportionalFreight - proportionalServicesTotal;

          data.push({
            order,
            branchName: getBranchName(order.companyBranchId),
            saleTypeName: getSaleTypeName(order.saleTypeId),
            sellerName: order.createdByUserName,
            services: proportionalServicesMap,
            totalReceived: totalReceived,
            proportionalFreight,
            proportionalServices: proportionalServicesTotal,
            netReceived: netReceived,
            isReversal: false,
            eventDate: dateObj,
          });
        });

        // Handle reversals (cancellations/returns)
        if (order.status === 'cancelled' || order.status === 'returned') {
          const reversalEventDate = order.status === 'cancelled' ? order.cancelledAt : order.returnedAt;
          if (reversalEventDate) {
            const totalPaidBeforeReversal = (order.payments || [])
              .flatMap(p => p.installments || [])
              .filter(inst => inst.reversalStatus === 'reversal_approved' || inst.paid)
              .reduce((sum, inst) => sum + inst.value, 0);

            if (totalPaidBeforeReversal > 0) {
              const receivedRatio = order.total > 0 ? totalPaidBeforeReversal / order.total : 0;
              const proportionalFreight = (order.freightValue || 0) * receivedRatio;
              const proportionalServicesMap: { [serviceId: string]: number } = {};
              (order.services || []).forEach(service => {
                proportionalServicesMap[service.serviceId] = service.price * receivedRatio;
              });
              const proportionalServicesTotal = Object.values(proportionalServicesMap).reduce((sum, val) => sum + val, 0);
              const netReceived = totalPaidBeforeReversal - proportionalFreight - proportionalServicesTotal;

              data.push({
                order,
                branchName: getBranchName(order.companyBranchId),
                saleTypeName: getSaleTypeName(order.saleTypeId),
                sellerName: order.createdByUserName,
                services: proportionalServicesMap,
                totalReceived: -totalPaidBeforeReversal,
                proportionalFreight: -proportionalFreight,
                proportionalServices: -proportionalServicesTotal,
                netReceived: -netReceived,
                isReversal: true,
                eventDate: reversalEventDate,
              });
            }
          }
        }
      });

      setReportData(data);
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao carregar extrato", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = React.useMemo(() => {
    return reportData.filter(item => {
      // Date Range Filter
      if (dateRange?.from) {
        const eventDate = item.eventDate?.toDate ? item.eventDate.toDate() : new Date(item.eventDate || 0);
        if (!eventDate || !isWithinInterval(eventDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) })) {
          return false;
        }
      }
      // Branch Filter
      if (selectedBranchIds.length > 0 && !selectedBranchIds.some(branchId => {
        const companyBranch = allCompanyBranches.find(cb => cb.id === item.order.companyBranchId);
        return companyBranch?.branchId === branchId;
      })) {
        return false;
      }
      // Seller Filter
      if (selectedSellerIds.length > 0 && !selectedSellerIds.includes(item.order.createdByUserId)) {
        return false;
      }
      // Sale Type Filter
      if (selectedSaleTypeIds.length > 0 && !selectedSaleTypeIds.includes(item.order.saleTypeId)) {
        return false;
      }
      // Search Term Filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          item.order.orderNumber.toString().includes(searchTerm) ||
          item.sellerName.toLowerCase().includes(term) ||
          item.order.customerName.toLowerCase().includes(term)
        );
      }
      return true;
    }).sort((a, b) => {
      const dateA = a.eventDate?.toDate ? a.eventDate.toDate() : new Date(a.eventDate || 0);
      const dateB = b.eventDate?.toDate ? b.eventDate.toDate() : new Date(b.eventDate || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [reportData, searchTerm, dateRange, selectedBranchIds, selectedSellerIds, selectedSaleTypeIds, allCompanyBranches, allBranches]);

  const clearFilters = () => {
    setSearchTerm("");
    setDateRange(undefined);
    setSelectedBranchIds([]);
    setSelectedSellerIds([]);
    setDisplayLimit(20);
  };

  // Reset pagination when filters change
  React.useEffect(() => {
    setDisplayLimit(20);
  }, [searchTerm, dateRange, selectedBranchIds, selectedSellerIds, selectedSaleTypeIds]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };
  const formatTime = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "HH:mm:ss", { locale: ptBR });
  };

  const reportTotals = React.useMemo(() => {
    return filteredData.reduce((acc, item) => {
      // Sum totalVenda only for non-reversal entries to avoid double counting/subtracting
      if (!item.isReversal) {
        acc.totalVenda += item.order.total;
        acc.totalFrete += (item.order.freightValue || 0);
        allServices.forEach(service => {
          if (!acc.totalServicos[service.id]) acc.totalServicos[service.id] = 0;
          const serviceInOrder = (item.order.services || []).find(s => s.serviceId === service.id);
          if (serviceInOrder) {
            acc.totalServicos[service.id] += serviceInOrder.price;
          }
        });
      }

      acc.totalRecebido += item.totalReceived;
      acc.totalFreteProporcional += item.proportionalFreight;
      acc.totalServicosProporcional += item.proportionalServices;
      acc.totalLiquido += item.netReceived;
      return acc;
    }, {
      totalVenda: 0,
      totalFrete: 0,
      totalServicos: {} as { [serviceId: string]: number },
      totalRecebido: 0,
      totalFreteProporcional: 0,
      totalServicosProporcional: 0,
      totalLiquido: 0,
    });
  }, [filteredData, allServices]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            Extrato de Vendas
          </h1>
          <p className="text-muted-foreground">
            Acompanhe os valores recebidos e comissões por venda.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendas com Recebimentos</CardTitle>
          <CardDescription>
            {loading ? "Carregando..." : `${filteredData.length} transações encontradas.`}
          </CardDescription>
          <div className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="date" variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "LLL dd, y", { locale: ptBR })} - ${format(dateRange.to, "LLL dd, y", { locale: ptBR })}` : format(dateRange.from, "LLL dd, y")) : <span>Filtrar por data...</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} />
                </PopoverContent>
              </Popover>
              <MultiSelectFilter
                placeholder="Filtrar por filial..."
                options={allBranches.map(b => ({ value: b.id, label: b.name }))}
                selectedValues={selectedBranchIds}
                onSelectionChange={handleFilterChange(setSelectedBranchIds)}
              />
              <MultiSelectFilter
                placeholder="Filtrar por vendedor..."
                options={allUsers.filter(u => u.roleId).map(u => ({ value: u.id, label: u.name }))}
                selectedValues={selectedSellerIds}
                onSelectionChange={handleFilterChange(setSelectedSellerIds)}
              />
              <MultiSelectFilter
                placeholder="Filtrar por operação..."
                options={allSaleTypes.map(st => ({ value: st.id, label: st.name }))}
                selectedValues={selectedSaleTypeIds}
                onSelectionChange={handleFilterChange(setSelectedSaleTypeIds)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                <Input
                  placeholder="Buscar por nº do pedido, vendedor ou cliente..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="ghost" onClick={clearFilters} className="text-destructive hover:text-destructive">
                <X className="mr-2 h-4 w-4" />
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
              <Frown className="h-16 w-16 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">Nenhum registro encontrado</h2>
              <p className="mt-2 text-sm text-muted-foreground">Tente ajustar os filtros.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="font-bold bg-muted text-base">
                      <TableHead colSpan={6}>Total</TableHead>
                      <TableHead className="text-right">{formatCurrency(reportTotals.totalVenda)}</TableHead>
                      <TableHead className="text-right">{formatCurrency(reportTotals.totalFrete)}</TableHead>
                      {allServices.map(s => {
                        const totalService = reportTotals.totalServicos[s.id] || 0;
                        return <TableHead key={s.id} className="text-right">{formatCurrency(totalService)}</TableHead>
                      })}
                      <TableHead className="text-right">{formatCurrency(reportTotals.totalRecebido)}</TableHead>
                      <TableHead className="text-right">{formatCurrency(reportTotals.totalFreteProporcional)}</TableHead>
                      {allServices.map(s => {
                        const totalServiceProporcional = filteredData.reduce((acc, item) => acc + (item.isReversal ? -(item.services[s.id] || 0) : (item.services[s.id] || 0)), 0);
                        return <TableHead key={`total-prop-${s.id}`} className="text-right">{formatCurrency(totalServiceProporcional)}</TableHead>
                      })}
                      <TableHead className="text-right">{formatCurrency(reportTotals.totalLiquido)}</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead>Nº Pedido</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Filial</TableHead>
                      <TableHead>Operação</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Total Venda</TableHead>
                      <TableHead className="text-right">Frete Total</TableHead>
                      {allServices.map(s => <TableHead key={s.id} className="text-right">{s.name}</TableHead>)}
                      <TableHead className="text-right">Recebido</TableHead>
                      <TableHead className="text-right">Frete (Prop.)</TableHead>
                      {allServices.map(s => <TableHead key={`prop-${s.id}`} className="text-right">{s.name} (Prop.)</TableHead>)}
                      <TableHead className="text-right">Líquido Recebido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.slice(0, displayLimit).map((item, index) => (
                      <TableRow key={`${item.order.id}-${item.isReversal}-${index}`} className={item.isReversal ? "bg-destructive/10" : ""}>
                        <TableCell className="font-mono flex items-center gap-2">
                          {item.isReversal && (
                            item.order.status === 'cancelled'
                              ? <FileX className="h-4 w-4 text-destructive" />
                              : <Undo2 className="h-4 w-4 text-blue-500" />
                          )}
                          #{item.order.orderNumber}
                        </TableCell>
                        <TableCell>{formatDate(item.eventDate)}</TableCell>
                        <TableCell>{formatTime(item.eventDate)}</TableCell>
                        <TableCell>{item.branchName}</TableCell>
                        <TableCell>{item.saleTypeName}</TableCell>
                        <TableCell>{item.sellerName}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.isReversal ? -item.order.total : item.order.total)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.isReversal ? -(item.order.freightValue || 0) : (item.order.freightValue || 0))}</TableCell>
                        {allServices.map(s => <TableHead key={s.id} className="text-right">{formatCurrency(item.isReversal ? -((item.order.services || []).find(os => os.serviceId === s.id)?.price || 0) : ((item.order.services || []).find(os => os.serviceId === s.id)?.price || 0))}</TableHead>)}
                        <TableCell className={cn("text-right font-semibold", item.isReversal ? "text-destructive" : "text-green-600")}>{formatCurrency(item.totalReceived)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(item.proportionalFreight)}</TableCell>
                        {allServices.map(s => <TableCell key={`prop-val-${s.id}`} className="text-right text-muted-foreground">{formatCurrency(item.isReversal ? -(item.services[s.id] || 0) : (item.services[s.id] || 0))}</TableCell>)}
                        <TableCell className={cn("text-right font-bold", item.isReversal ? "text-destructive" : "text-primary")}>{formatCurrency(item.netReceived)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {displayLimit < filteredData.length && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 pb-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setDisplayLimit(prev => prev + 20)}
                    className="w-full sm:w-auto font-semibold"
                  >
                    <ChevronDown className="mr-2 h-4 w-4" />
                    Carregar Mais (+20)
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => setDisplayLimit(filteredData.length)}
                    className="w-full sm:w-auto font-bold"
                  >
                    Carregar Tudo ({filteredData.length})
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
