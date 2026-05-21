"use client";

import * as React from "react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  orderBy as firestoreOrderBy,
  Timestamp,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, startOfDay, endOfDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  RefreshCw,
  Search,
  Calendar as CalendarIcon,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Package,
  ChevronDown,
  ChevronUp,
  X,
  FileSpreadsheet,
  Filter,
  User as UserIcon,
  Eye,
} from "lucide-react";
import type { SalesOrder, SaleType, DeliveryType, User as UserType, Product } from "@/lib/definitions";
import { Parser } from "json2csv";

export default function SalesReportPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  
  // Date Range States (Default to current month start to today)
  const [startDate, setStartDate] = React.useState<string>(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = React.useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );

  // Firestore Data States
  const [orders, setOrders] = React.useState<SalesOrder[]>([]);
  const [saleTypes, setSaleTypes] = React.useState<SaleType[]>([]);
  const [deliveryTypes, setDeliveryTypes] = React.useState<DeliveryType[]>([]);
  const [users, setUsers] = React.useState<UserType[]>([]);
  const [allProducts, setAllProducts] = React.useState<Product[]>([]);
  
  // Selection / Filter States
  const [selectedSaleType, setSelectedSaleType] = React.useState<string>("all");
  const [selectedDeliveryType, setSelectedDeliveryType] = React.useState<string>("all");
  const [selectedSeller, setSelectedSeller] = React.useState<string>("all");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("all");
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  
  // Search terms for filters
  const [saleTypeSearchTerm, setSaleTypeSearchTerm] = React.useState<string>("");
  const [deliveryTypeSearchTerm, setDeliveryTypeSearchTerm] = React.useState<string>("");
  const [sellerSearchTerm, setSellerSearchTerm] = React.useState<string>("");

  // Popover open/close states
  const [isSaleTypePopoverOpen, setIsSaleTypePopoverOpen] = React.useState<boolean>(false);
  const [isDeliveryTypePopoverOpen, setIsDeliveryTypePopoverOpen] = React.useState<boolean>(false);
  const [isSellerPopoverOpen, setIsSellerPopoverOpen] = React.useState<boolean>(false);

  // UI States
  const [loading, setLoading] = React.useState<boolean>(true);
  const [loadingProducts, setLoadingProducts] = React.useState<boolean>(false);
  const [showProductDetails, setShowProductDetails] = React.useState<boolean>(false);
  const [removeFreight, setRemoveFreight] = React.useState<boolean>(false);
  const [removeServices, setRemoveServices] = React.useState<boolean>(false);
  const [expandedOrders, setExpandedOrders] = React.useState<Record<string, boolean>>({});
  const [productSearchTerm, setProductSearchTerm] = React.useState<string>("");
  const [isProductPopoverOpen, setIsProductPopoverOpen] = React.useState<boolean>(false);

  // Helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  const getSaleTypeName = (id: string) => {
    return saleTypes.find((t) => t.id === id)?.name || id;
  };

  const getDeliveryTypeName = (id: string) => {
    return deliveryTypes.find((t) => t.id === id)?.name || id;
  };

  const getSellerName = (id: string) => {
    return users.find((u) => u.id === id)?.name || id;
  };

  // Auto-seed navigation item
  const checkAndSeedNavigation = React.useCallback(async () => {
    try {
      const navQuery = query(
        collection(db, "navigation"),
        where("path", "==", "/dashboard/reports/sales")
      );
      const snap = await getDocs(navQuery);
      if (snap.empty) {
        // Find parent 'Relatórios'
        const allNav = await getDocs(collection(db, "navigation"));
        let parentId = null;
        const relatoriosItem = allNav.docs.find((d) =>
          d.data().title?.toLowerCase().includes("relatório")
        );
        if (relatoriosItem) {
          parentId = relatoriosItem.id;
        }

        // Find max order
        const orderQuery = query(
          collection(db, "navigation"),
          where("parentId", "==", parentId)
        );
        const orderSnap = await getDocs(orderQuery);
        const maxOrder = orderSnap.docs.reduce(
          (max, d) => Math.max(max, d.data().order || 0),
          0
        );

        await addDoc(collection(db, "navigation"), {
          title: "Relatório de Vendas",
          path: "/dashboard/reports/sales",
          icon: "BarChart3",
          order: maxOrder + 1,
          parentId: parentId,
          visible: true,
          createdAt: serverTimestamp(),
        });

        toast({
          title: "Menu Lateral Atualizado",
          description: "A aba 'Relatório de Vendas' foi adicionada com sucesso ao seu menu lateral.",
        });
      }
    } catch (err) {
      console.error("Erro ao cadastrar navegação:", err);
    }
  }, [toast]);

  // Initial Boot Queries
  React.useEffect(() => {
    if (!user) return;

    const fetchSupportingData = async () => {
      try {
        setLoadingProducts(true);
        const [saleTypesSnap, deliveryTypesSnap, usersSnap, productsSnap] = await Promise.all([
          getDocs(collection(db, "saleTypes")),
          getDocs(collection(db, "deliveryTypes")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "products")),
        ]);

        setSaleTypes(
          saleTypesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SaleType))
        );
        setDeliveryTypes(
          deliveryTypesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DeliveryType))
        );
        setUsers(
          usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as UserType))
        );
        setAllProducts(
          productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product))
        );

        await checkAndSeedNavigation();
      } catch (err) {
        console.error("Erro ao carregar dados auxiliares:", err);
        toast({
          title: "Erro de Carregamento",
          description: "Ocorreu um erro ao carregar os dados dos filtros.",
          variant: "destructive",
        });
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchSupportingData();
  }, [user, checkAndSeedNavigation, toast]);

  // Main Sales Query (by date range)
  const fetchSalesOrders = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const startTimestamp = Timestamp.fromDate(startOfDay(parseISO(startDate)));
      const endTimestamp = Timestamp.fromDate(endOfDay(parseISO(endDate)));

      const ordersQuery = query(
        collection(db, "salesOrders"),
        where("createdAt", ">=", startTimestamp),
        where("createdAt", "<=", endTimestamp),
        firestoreOrderBy("createdAt", "desc")
      );

      const ordersSnap = await getDocs(ordersQuery);
      const fetchedOrders = ordersSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt,
        } as SalesOrder;
      });

      setOrders(fetchedOrders);
    } catch (err) {
      console.error("Erro ao carregar pedidos de venda:", err);
      toast({
        title: "Erro ao buscar vendas",
        description: "Não foi possível carregar as vendas para o período selecionado.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, startDate, endDate, toast]);

  // Fetch orders on range change
  React.useEffect(() => {
    fetchSalesOrders();
  }, [fetchSalesOrders]);

  // Local Filter Logic (Filter fetched orders in memory)
  const filteredOrders = React.useMemo(() => {
    return orders.filter((order) => {
      // 1. Operation Type Filter
      if (selectedSaleType !== "all" && order.saleTypeId !== selectedSaleType) {
        return false;
      }
      // 2. Delivery Type Filter
      if (
        selectedDeliveryType !== "all" &&
        order.deliveryTypeId !== selectedDeliveryType
      ) {
        return false;
      }
      // 3. Seller Filter
      if (
        selectedSeller !== "all" &&
        order.createdByUserId !== selectedSeller
      ) {
        return false;
      }
      // 4. Specific Product Filter
      if (selectedProduct) {
        const hasProduct = order.items?.some(
          (item) => item.productId === selectedProduct.id
        );
        if (!hasProduct) {
          return false;
        }
      }
      // 5. Status Filter
      if (selectedStatus !== "all" && order.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [orders, selectedSaleType, selectedDeliveryType, selectedSeller, selectedStatus, selectedProduct]);

  // Options filtering for searchable selects
  const filteredSaleTypes = React.useMemo(() => {
    if (!saleTypeSearchTerm) return saleTypes;
    return saleTypes.filter((t) =>
      t.name.toLowerCase().includes(saleTypeSearchTerm.toLowerCase())
    );
  }, [saleTypes, saleTypeSearchTerm]);

  const filteredDeliveryTypes = React.useMemo(() => {
    if (!deliveryTypeSearchTerm) return deliveryTypes;
    return deliveryTypes.filter((t) =>
      t.name.toLowerCase().includes(deliveryTypeSearchTerm.toLowerCase())
    );
  }, [deliveryTypes, deliveryTypeSearchTerm]);

  const filteredUsers = React.useMemo(() => {
    const validUsers = users.filter((u) => u.name);
    if (!sellerSearchTerm) return validUsers;
    return validUsers.filter((u) =>
      u.name!.toLowerCase().includes(sellerSearchTerm.toLowerCase())
    );
  }, [users, sellerSearchTerm]);

  const getAdjustedOrderTotal = React.useCallback(
    (order: SalesOrder) => {
      let total = order.total || 0;
      if (removeFreight) {
        total -= order.freightValue || 0;
      }
      if (removeServices) {
        const servicesTotal =
          order.services?.reduce((acc, s) => acc + (s.price || 0), 0) || 0;
        total -= servicesTotal;
      }
      return total;
    },
    [removeFreight, removeServices]
  );

  // Calculations for KPIs based on current filtered orders
  const kpiStats = React.useMemo(() => {
    let totalRevenue = 0;
    let totalItemsCount = 0;

    filteredOrders.forEach((order) => {
      // Billed or pending or awaiting_approval (all active transactions contribute to revenue unless cancelled)
      if (order.status !== "cancelled") {
        totalRevenue += getAdjustedOrderTotal(order);
        order.items?.forEach((item) => {
          totalItemsCount += item.quantity || 0;
        });
      }
    });

    const averageTicket =
      filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;

    return {
      totalOrders: filteredOrders.length,
      totalRevenue,
      totalItemsCount,
      averageTicket,
    };
  }, [filteredOrders, getAdjustedOrderTotal]);

  // Clean all filters
  const clearFilters = () => {
    setSelectedSaleType("all");
    setSelectedDeliveryType("all");
    setSelectedSeller("all");
    setSelectedStatus("all");
    setSelectedProduct(null);
    setProductSearchTerm("");
    setSaleTypeSearchTerm("");
    setDeliveryTypeSearchTerm("");
    setSellerSearchTerm("");
    setExpandedOrders({});
  };

  // Toggle single order details
  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Apply expanded mode to all orders when "Listar produtos" is checked
  React.useEffect(() => {
    if (showProductDetails) {
      const newExpanded: Record<string, boolean> = {};
      filteredOrders.forEach((order) => {
        newExpanded[order.id] = true;
      });
      setExpandedOrders(newExpanded);
    } else {
      setExpandedOrders({});
    }
  }, [showProductDetails, filteredOrders]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "billed":
        return "Faturado";
      case "cancelled":
        return "Cancelado";
      case "pending":
        return "Pendente";
      case "returned":
        return "Devolvido";
      default:
        return status;
    }
  };

  const formatDecimalCSV = (num: number) => {
    if (num === undefined || num === null || isNaN(num)) return "0,00";
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Export Filtered Data to CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      toast({
        title: "Exportação vazia",
        description: "Não há vendas no filtro atual para exportar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataToExport = filteredOrders.flatMap((order) => {
        const orderDate = order.createdAt
          ? format(order.createdAt.toDate(), "dd/MM/yyyy HH:mm")
          : "N/A";

        // If we want detailed listing, output each item
        if (order.items && order.items.length > 0) {
          return order.items.map((item) => ({
            "Número Pedido": order.orderNumber,
            "Data Venda": orderDate,
            "Cliente": order.customerName,
            "Operação": getSaleTypeName(order.saleTypeId),
            "Tipo Entrega": getDeliveryTypeName(order.deliveryTypeId),
            "Vendedor": getSellerName(order.createdByUserId),
            "Status": getStatusLabel(order.status),
            "Produto": item.productName,
            "Qtd": item.quantity,
            "Unitário": formatDecimalCSV(item.unitPrice),
            "Total Item": formatDecimalCSV(item.total),
            "Total Geral Pedido": formatDecimalCSV(getAdjustedOrderTotal(order)),
          }));
        } else {
          return [
            {
              "Número Pedido": order.orderNumber,
              "Data Venda": orderDate,
              "Cliente": order.customerName,
              "Operação": getSaleTypeName(order.saleTypeId),
              "Tipo Entrega": getDeliveryTypeName(order.deliveryTypeId),
              "Vendedor": getSellerName(order.createdByUserId),
              "Status": getStatusLabel(order.status),
              "Produto": "Nenhum item",
              "Qtd": 0,
              "Unitário": formatDecimalCSV(0),
              "Total Item": formatDecimalCSV(0),
              "Total Geral Pedido": formatDecimalCSV(getAdjustedOrderTotal(order)),
            },
          ];
        }
      });

      const parser = new Parser({ delimiter: ";" });
      const csv = parser.parse(dataToExport);

      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio_vendas_${startDate}_a_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Sucesso!",
        description: "O relatório foi exportado com sucesso no formato CSV.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível gerar o arquivo CSV.",
        variant: "destructive",
      });
    }
  };

  // Filter products list based on autocomplete input search term
  const filteredProductsList = React.useMemo(() => {
    if (!productSearchTerm) return allProducts.slice(0, 50);
    const term = productSearchTerm.toLowerCase();
    return allProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.internalCode?.toLowerCase().includes(term) ||
          p.barcode?.toLowerCase().includes(term)
      )
      .slice(0, 50);
  }, [allProducts, productSearchTerm]);

  if (authLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Autenticando usuário...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Relatório de Vendas
          </h1>
          <p className="text-muted-foreground mt-1">
            Consulte o desempenho de vendas por períodos, operações, tipo de entrega, vendedor e produto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="shadow-sm gap-2"
            onClick={handleExportCSV}
            disabled={loading || filteredOrders.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            <span>Exportar Excel/CSV</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchSalesOrders}
            disabled={loading}
            className="shrink-0 shadow-sm"
          >
            <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-card/60 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total de Vendas
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {loading ? "..." : kpiStats.totalOrders}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pedidos efetuados no período
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card/60 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Faturamento Bruto
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {loading ? "..." : formatCurrency(kpiStats.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Excluindo pedidos cancelados
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card/60 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Itens Vendidos
            </CardTitle>
            <Package className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {loading ? "..." : kpiStats.totalItemsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Quantidade de produtos faturados
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card/60 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ticket Médio
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400">
              {loading ? "..." : formatCurrency(kpiStats.averageTicket)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Média por pedido de venda
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters Panel */}
      <Card className="border-none shadow-sm bg-card/50 backdrop-blur-md overflow-hidden">
        <CardHeader className="bg-muted/10 pb-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Filtros Personalizados
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Listar Produtos Detalhado</span>
                <Switch
                  checked={showProductDetails}
                  onCheckedChange={setShowProductDetails}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Remover Frete do Total</span>
                <Switch
                  checked={removeFreight}
                  onCheckedChange={setRemoveFreight}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Remover Serviços do Total</span>
                <Switch
                  checked={removeServices}
                  onCheckedChange={setRemoveServices}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          
          {/* Main Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            
            {/* Start Date */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">Data Inicial</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9 h-11 bg-background"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">Data Final</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9 h-11 bg-background"
                />
              </div>
            </div>

            {/* Operation Type Select with Search */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">Operação</Label>
              <Popover open={isSaleTypePopoverOpen} onOpenChange={setIsSaleTypePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-11 bg-background font-normal"
                  >
                    {selectedSaleType !== "all" ? (
                      <span className="truncate font-semibold text-primary">
                        {getSaleTypeName(selectedSaleType)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Todas as operações</span>
                    )}
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <div className="p-2 border-b flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      placeholder="Pesquisar..."
                      value={saleTypeSearchTerm}
                      onChange={(e) => setSaleTypeSearchTerm(e.target.value)}
                      className="w-full text-xs bg-transparent outline-none border-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    <button
                      className={`w-full text-left p-2 hover:bg-muted text-xs border-b last:border-0 transition-colors ${
                        selectedSaleType === "all" ? "bg-muted font-semibold text-primary" : ""
                      }`}
                      onClick={() => {
                        setSelectedSaleType("all");
                        setIsSaleTypePopoverOpen(false);
                      }}
                    >
                      Todas as operações
                    </button>
                    {filteredSaleTypes.map((type) => (
                      <button
                        key={type.id}
                        className={`w-full text-left p-2 hover:bg-muted text-xs border-b last:border-0 transition-colors ${
                          selectedSaleType === type.id ? "bg-muted font-semibold text-primary" : ""
                        }`}
                        onClick={() => {
                          setSelectedSaleType(type.id);
                          setIsSaleTypePopoverOpen(false);
                        }}
                      >
                        {type.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Delivery Type Select with Search */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">Tipo de Entrega</Label>
              <Popover open={isDeliveryTypePopoverOpen} onOpenChange={setIsDeliveryTypePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-11 bg-background font-normal"
                  >
                    {selectedDeliveryType !== "all" ? (
                      <span className="truncate font-semibold text-primary">
                        {getDeliveryTypeName(selectedDeliveryType)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Todas as entregas</span>
                    )}
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <div className="p-2 border-b flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      placeholder="Pesquisar..."
                      value={deliveryTypeSearchTerm}
                      onChange={(e) => setDeliveryTypeSearchTerm(e.target.value)}
                      className="w-full text-xs bg-transparent outline-none border-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    <button
                      className={`w-full text-left p-2 hover:bg-muted text-xs border-b last:border-0 transition-colors ${
                        selectedDeliveryType === "all" ? "bg-muted font-semibold text-primary" : ""
                      }`}
                      onClick={() => {
                        setSelectedDeliveryType("all");
                        setIsDeliveryTypePopoverOpen(false);
                      }}
                    >
                      Todas as entregas
                    </button>
                    {filteredDeliveryTypes.map((type) => (
                      <button
                        key={type.id}
                        className={`w-full text-left p-2 hover:bg-muted text-xs border-b last:border-0 transition-colors ${
                          selectedDeliveryType === type.id ? "bg-muted font-semibold text-primary" : ""
                        }`}
                        onClick={() => {
                          setSelectedDeliveryType(type.id);
                          setIsDeliveryTypePopoverOpen(false);
                        }}
                      >
                        {type.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Seller Select with Search */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">Vendedor</Label>
              <Popover open={isSellerPopoverOpen} onOpenChange={setIsSellerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-11 bg-background font-normal"
                  >
                    {selectedSeller !== "all" ? (
                      <span className="truncate font-semibold text-primary">
                        {getSellerName(selectedSeller)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Todos os vendedores</span>
                    )}
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="start">
                  <div className="p-2 border-b flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      placeholder="Pesquisar vendedor..."
                      value={sellerSearchTerm}
                      onChange={(e) => setSellerSearchTerm(e.target.value)}
                      className="w-full text-xs bg-transparent outline-none border-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    <button
                      className={`w-full text-left p-2 hover:bg-muted text-xs border-b last:border-0 transition-colors ${
                        selectedSeller === "all" ? "bg-muted font-semibold text-primary" : ""
                      }`}
                      onClick={() => {
                        setSelectedSeller("all");
                        setIsSellerPopoverOpen(false);
                      }}
                    >
                      Todos os vendedores
                    </button>
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        className={`w-full text-left p-2 hover:bg-muted text-xs border-b last:border-0 transition-colors ${
                          selectedSeller === user.id ? "bg-muted font-semibold text-primary" : ""
                        }`}
                        onClick={() => {
                          setSelectedSeller(user.id);
                          setIsSellerPopoverOpen(false);
                        }}
                      >
                        {user.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Status Select */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-11 bg-background">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="billed">Faturado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="returned">Devolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Product Filter Autocomplete & Clear Action */}
          <div className="flex flex-col md:flex-row items-end md:items-center justify-between gap-4 pt-2">
            
            {/* Product Specific Search Autocomplete Popover */}
            <div className="flex flex-col gap-1.5 w-full md:max-w-md">
              <Label className="text-xs text-muted-foreground font-semibold">Filtrar por Venda de Produto Específico</Label>
              <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-11 bg-background font-normal"
                    disabled={loadingProducts}
                  >
                    {selectedProduct ? (
                      <span className="truncate font-semibold text-primary">
                        {selectedProduct.name} ({selectedProduct.internalCode})
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Selecione um produto para filtrar...</span>
                    )}
                    {selectedProduct ? (
                      <X
                        className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProduct(null);
                          setProductSearchTerm("");
                        }}
                      />
                    ) : (
                      <Search className="h-4 w-4 shrink-0 opacity-50" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <div className="p-3 border-b flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      placeholder="Pesquisar produto por nome ou código..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="w-full text-sm bg-transparent outline-none border-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="max-h-[250px] overflow-y-auto">
                    {filteredProductsList.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground text-center">Nenhum produto encontrado</p>
                    ) : (
                      filteredProductsList.map((product) => (
                        <button
                          key={product.id}
                          className="w-full text-left p-2.5 hover:bg-muted text-xs flex items-center justify-between border-b last:border-0 transition-colors"
                          onClick={() => {
                            setSelectedProduct(product);
                            setIsProductPopoverOpen(false);
                          }}
                        >
                          <div className="truncate pr-2">
                            <p className="font-semibold truncate">{product.name}</p>
                            <p className="text-muted-foreground text-[10px]">Cód: {product.internalCode || "N/A"}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0 font-mono">
                            {formatCurrency(product.salePrice)}
                          </Badge>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Results count & Clear button */}
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-xs text-muted-foreground italic">
                {filteredOrders.length} pedido(s) encontrado(s).
              </span>
              {(selectedSaleType !== "all" ||
                selectedDeliveryType !== "all" ||
                selectedSeller !== "all" ||
                selectedStatus !== "all" ||
                selectedProduct !== null) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 h-10 transition-colors font-semibold"
                >
                  <X className="mr-1.5 h-4 w-4" />
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Results Table Section */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando pedidos de venda...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center border-2 border-dashed rounded-xl m-6">
              <ShoppingCart className="h-12 w-12 text-muted-foreground opacity-40 mb-4" />
              <h3 className="text-lg font-bold">Nenhum pedido de venda</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Não localizamos pedidos para os filtros selecionados. Altere o período de datas ou limpe os filtros.
              </p>
              <Button variant="outline" onClick={clearFilters} className="mt-6 font-semibold">
                Limpar todos os filtros
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground px-4">Pedido</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground">Data</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground">Cliente</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground">Operação</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground">Tipo de Entrega</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground">Vendedor</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground text-center">Status</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground text-right px-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const isExpanded = !!expandedOrders[order.id];
                    const orderDate = order.createdAt
                      ? format(order.createdAt.toDate(), "dd/MM/yyyy HH:mm")
                      : "N/A";

                    return (
                      <React.Fragment key={order.id}>
                        {/* Main row */}
                        <TableRow className="group hover:bg-muted/10 transition-colors border-b">
                          <TableCell className="text-center py-4 px-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => toggleOrderExpand(order.id)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-mono font-bold text-foreground px-4 py-4">
                            #{order.orderNumber}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-medium">
                            {orderDate}
                          </TableCell>
                          <TableCell className="font-semibold max-w-[200px] truncate">
                            {order.customerName}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-muted-foreground">
                            {getSaleTypeName(order.saleTypeId)}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            {getDeliveryTypeName(order.deliveryTypeId)}
                          </TableCell>
                          <TableCell className="text-xs font-medium flex items-center gap-1.5 py-4">
                            <UserIcon className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[120px]">
                              {getSellerName(order.createdByUserId)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <Badge
                              variant={
                                order.status === "billed"
                                  ? "default"
                                  : order.status === "cancelled"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className={
                                order.status === "billed"
                                  ? "bg-green-600 hover:bg-green-700 text-white font-bold"
                                  : ""
                              }
                            >
                              {order.status === "billed"
                                ? "Faturado"
                                : order.status === "cancelled"
                                ? "Cancelado"
                                : order.status === "pending"
                                ? "Pendente"
                                : order.status === "returned"
                                ? "Devolvido"
                                : order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground px-6 py-4">
                            {formatCurrency(getAdjustedOrderTotal(order))}
                          </TableCell>
                        </TableRow>

                        {/* Collapsible item listing */}
                        {isExpanded && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={9} className="p-4 border-b">
                              <div className="rounded-xl border bg-background/50 overflow-hidden shadow-inner ml-10 mr-6">
                                <Table>
                                  <TableHeader className="bg-muted/40">
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="text-[11px] font-bold text-muted-foreground">Produto</TableHead>
                                      <TableHead className="text-[11px] font-bold text-muted-foreground text-center w-20">Qtd</TableHead>
                                      <TableHead className="text-[11px] font-bold text-muted-foreground text-right w-32">Preço Unitário</TableHead>
                                      <TableHead className="text-[11px] font-bold text-muted-foreground text-right w-28">Desconto</TableHead>
                                      <TableHead className="text-[11px] font-bold text-muted-foreground text-right px-6 w-36">Total Item</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {order.items && order.items.length > 0 ? (
                                      order.items.map((item, idx) => (
                                        <TableRow key={idx} className="hover:bg-muted/10 last:border-0 border-b">
                                          <TableCell className="text-xs font-semibold py-2.5">
                                            {item.productName}
                                          </TableCell>
                                          <TableCell className="text-xs text-center py-2.5 font-mono">
                                            {item.quantity}
                                          </TableCell>
                                          <TableCell className="text-xs text-right py-2.5 font-mono">
                                            {formatCurrency(item.unitPrice)}
                                          </TableCell>
                                          <TableCell className="text-xs text-right py-2.5 text-rose-500 font-mono">
                                            {item.discountValue > 0
                                              ? item.discountType === "fixed"
                                                ? `-${formatCurrency(item.discountValue)}`
                                                : `-${item.discountValue}%`
                                              : "R$ 0,00"}
                                          </TableCell>
                                          <TableCell className="text-xs text-right px-6 py-2.5 font-mono font-bold text-foreground">
                                            {formatCurrency(item.total)}
                                          </TableCell>
                                        </TableRow>
                                      ))
                                    ) : (
                                      <TableRow>
                                        <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">
                                          Nenhum produto cadastrado para este pedido.
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
