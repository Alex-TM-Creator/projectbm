
"use client";

import * as React from "react";
import { 
  Search, 
  Calendar as CalendarIcon, 
  Filter, 
  Printer, 
  Trash2, 
  MoreVertical, 
  Mail, 
  MessageSquare, 
  FileText, 
  XCircle, 
  Settings2, 
  FileEdit,
  Download, 
  Undo, 
  RefreshCcw, 
  Copy, 
  ExternalLink, 
  Tag, 
  Truck,
  LayoutGrid,
  List,
  PlusSquare
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { 
  collection, 
  getDocs, 
  query, 
  doc, 
  getDoc,
  orderBy,
  where,
  limit as firestoreLimit
} from "firebase/firestore";
import type { User, CompanyBranch, SalesOrder, NaturezaOperacao } from "@/lib/definitions";
import { IssueNfeModal } from "@/components/dashboard/issue-nfe-modal";

export default function EmissaoNfePage() {
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<User | null>(null);
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedNotes, setSelectedNotes] = React.useState<string[]>([]);
  const [orders, setOrders] = React.useState<SalesOrder[]>([]);
  const [naturezas, setNaturezas] = React.useState<NaturezaOperacao[]>([]);
  const [isIssueModalOpen, setIsIssueModalOpen] = React.useState(false);
  const [selectedOrderForNfe, setSelectedOrderForNfe] = React.useState<SalesOrder | null>(null);
  
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [visibleCount, setVisibleCount] = React.useState(20);

  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [userDocSnap, companyBranchesSnap] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDocs(collection(db, "companyBranches"))
      ]);

      const branches = companyBranchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyBranch));

      if (userDocSnap.exists()) {
        const uData = { id: user.uid, ...userDocSnap.data() } as User;
        setUserData(uData);
        
        if (uData.isAdmin) {
          setCompanyBranches(branches);
          setSelectedBranchId("all");
        } else {
          const userBranch = branches.filter(b => b.id === uData.companyBranchId);
          setCompanyBranches(userBranch);
          setSelectedBranchId(uData.companyBranchId || "all");
        }
      }

      // Fetch Sales Orders with readyForNfe=true and Naturezas
      const [ordersSnap, naturezasSnap] = await Promise.all([
        getDocs(query(
          collection(db, "salesOrders"),
          where("readyForNfe", "==", true),
          firestoreLimit(200)
        )),
        getDocs(collection(db, "naturezas_operacao"))
      ]);
      
      const fetchedOrders = ordersSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as SalesOrder))
        .sort((a: any, b: any) => {
          const dateA = a.readyForNfeAt?.toDate ? a.readyForNfeAt.toDate().getTime() : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0);
          const dateB = b.readyForNfeAt?.toDate ? b.readyForNfeAt.toDate().getTime() : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0);
          return dateB - dateA;
        });
      setOrders(fetchedOrders);
      setNaturezas(naturezasSnap.docs.map(d => ({ id: d.id, ...d.data() } as NaturezaOperacao)));

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (user && !authLoading) {
      fetchData();
    }
  }, [user, authLoading, fetchData]);

  const filteredOrders = React.useMemo(() => {
    return orders.filter(order => {
      // Branch filter
      if (selectedBranchId !== "all" && order.companyBranchId !== selectedBranchId) {
        return false;
      }

      // Date range filter
      if (dateRange?.from) {
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        if (!isWithinInterval(orderDate, { 
          start: startOfDay(dateRange.from), 
          end: endOfDay(dateRange.to || dateRange.from) 
        })) {
          return false;
        }
      }

      // Search term filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          (order.orderNumber || "").toString().includes(term) ||
          (order.customerName || "").toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [orders, selectedBranchId, dateRange, searchTerm]);

  // Reset visibleCount when filters change
  React.useEffect(() => {
    setVisibleCount(20);
  }, [searchTerm, selectedBranchId, dateRange]);

  const displayedOrders = React.useMemo(() => {
    return filteredOrders.slice(0, visibleCount);
  }, [filteredOrders, visibleCount]);

  const toggleSelectAll = () => {
    if (selectedNotes.length === filteredOrders.length) {
      setSelectedNotes([]);
    } else {
      setSelectedNotes(filteredOrders.map(n => n.id));
    }
  };

  const toggleSelectNote = (id: string) => {
    setSelectedNotes(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: any) => {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return format(d, "dd/MM/yyyy");
  };

  const getStatusBadge = (order: SalesOrder) => {
    switch (order.status) {
      case "billed":
        return { label: "Emitida DANFE", className: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800" };
      case "cancelled":
        return { label: "Cancelada", className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" };
      default:
        // Any order in the NF-e queue that hasn't been billed yet is pending issuance
        return { label: "Pendente", className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800" };
    }
  };

  const getOrderIcons = (order: SalesOrder) => {
    const icons: string[] = ["V"];
    if (order.status === "billed") {
      icons.push("C", "E");
    }
    // In a real scenario, we would check if email was sent, etc.
    return icons;
  };

  const handleOpenIssueModal = (order: SalesOrder) => {
    setSelectedOrderForNfe(order);
    setIsIssueModalOpen(true);
  };

  if (loading || authLoading) {
    return <div className="flex h-[50vh] items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-2 md:p-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <h1 className="text-xl font-bold text-foreground">Notas Fiscais de Saída</h1>
          <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
            <SelectTrigger className="w-fit border-none bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 h-8 gap-1 font-bold text-emerald-600 focus:ring-0">
              <SelectValue placeholder="Selecione a filial" />
            </SelectTrigger>
            <SelectContent>
              {userData?.isAdmin && <SelectItem value="all">Todas as lojas</SelectItem>}
              {companyBranches.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>{branch.nome_fantasia || branch.razao_social}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="border-none shadow-sm bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 border rounded-lg px-2 bg-white dark:bg-zinc-800 h-10 w-8 flex-shrink-0 justify-center text-emerald-600">
              <Filter className="h-4 w-4" />
            </div>
            
            <div className="relative flex-1 min-w-[200px]">
              <Input
                placeholder="Pesquisar por nome, CPF/CNPJ ou nº da nota"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="pl-3 pr-10 h-10 rounded-lg border-zinc-200 dark:border-zinc-700 focus-visible:ring-emerald-500"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <div className="flex items-center gap-2 border rounded-lg px-3 bg-white dark:bg-zinc-800 h-10 text-sm text-emerald-600 font-medium cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                  <CalendarIcon className="h-4 w-4" />
                  <span>
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/yyyy")} até {format(dateRange.to, "dd/MM/yyyy")}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy")
                      )
                    ) : (
                      <span>Selecione um período</span>
                    )}
                  </span>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-1 ml-auto">
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg border-zinc-200 text-emerald-600">
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg border-zinc-200 text-zinc-400">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Actions Header */}
      <div className="flex items-center justify-between px-2 text-zinc-400">
        <div className="flex items-center gap-4">
          <Checkbox 
            checked={selectedNotes.length > 0 && selectedNotes.length === filteredOrders.length}
            onCheckedChange={toggleSelectAll}
            className="border-zinc-300 rounded-[4px]"
          />
          <button onClick={() => fetchData()} className="text-emerald-500 hover:text-emerald-600 transition-colors">
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
           <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors text-emerald-600">
             <List className="h-4 w-4" />
           </button>
           <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors">
             <LayoutGrid className="h-4 w-4" />
           </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
        <Table>
          <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50">
            <TableRow className="hover:bg-transparent border-b-zinc-200 dark:border-b-zinc-800">
              <TableHead className="w-12"></TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-zinc-400 py-3">Pedido</TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-zinc-400 py-3">Número NF-e</TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-zinc-400 py-3">Data emissão</TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-zinc-400 py-3">Nome</TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-zinc-400 py-3">Situação</TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-zinc-400 py-3 text-right">Valor (R$)</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedOrders.map((note) => {
              const status = getStatusBadge(note);
              const icons = getOrderIcons(note);
              return (
                <TableRow key={note.id} className="group border-b-zinc-100 dark:border-b-zinc-900 last:border-0">
                  <TableCell className="py-3">
                    <Checkbox 
                      checked={selectedNotes.includes(note.id)}
                      onCheckedChange={() => toggleSelectNote(note.id)}
                      className="border-zinc-300 rounded-[4px]"
                    />
                  </TableCell>
                  <TableCell className="text-sm font-medium text-zinc-600 dark:text-zinc-300">#{note.orderNumber}</TableCell>
                  <TableCell className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{(note as any).nfeNumber ?? '—'}</TableCell>
                  <TableCell className="text-sm text-zinc-500">{formatDate(note.createdAt)}</TableCell>
                  <TableCell className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{note.customerName}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] font-bold px-3 py-0.5 rounded-full",
                        status.className
                      )}
                    >
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-bold text-zinc-700 dark:text-zinc-200 text-right tabular-nums">
                    {formatCurrency(note.total).replace("R$", "").trim()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64 max-h-[350px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-0 rounded-lg shadow-xl border-zinc-200 dark:border-zinc-800">
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <Mail className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Enviar por e-mail</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <MessageSquare className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Enviar por Whatsapp</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <FileText className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Enviar espelho NF</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />
                        
                        <DropdownMenuItem 
                          className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                          onClick={() => handleOpenIssueModal(note)}
                        >
                          <PlusSquare className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Emitir NF-e</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <XCircle className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Cancelar NF-e</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <Settings2 className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Outras opções de NF-e</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <FileEdit className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Carta de correção</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <PlusSquare className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">NFe complementar</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />

                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <Download className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Gerar PDF DANFE</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <Undo className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Estornar contas</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <RefreshCcw className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Gerar devolução</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />

                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <Copy className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Clonar nota</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <ExternalLink className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Clonar para entrada</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />

                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <Printer className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Imprimir DANFE</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <Printer className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Imprimir DANFE Simplificado</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <Tag className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Imprimir etiquetas</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <Printer className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Imprimir espelho NF</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                          <Truck className="h-4 w-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Imprimir etiqueta de transporte</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
        {visibleCount < filteredOrders.length && (
          <div className="p-4 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/30 dark:bg-zinc-900/10 flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => setVisibleCount(prev => prev + 20)}
              className="h-9 px-8 text-xs font-bold border-zinc-200 dark:border-zinc-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all hover:border-emerald-200"
            >
              Carregar mais registros
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium px-2">
         <p>Total: {filteredOrders.length} registro(s)</p>
         <div className="flex items-center gap-4">
            <p>Valor total: <span className="text-foreground">{formatCurrency(filteredOrders.reduce((acc, n) => acc + n.total, 0))}</span></p>
         </div>
      </div>

      <IssueNfeModal 
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        order={selectedOrderForNfe}
        naturezas={naturezas}
        branches={companyBranches}
      />
    </div>
  );
}
