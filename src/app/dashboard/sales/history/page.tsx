

"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  writeBatch,
  getDoc,
  addDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  limit,
  orderBy as firestoreOrderBy,
  increment,
  runTransaction,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { DateRange } from "react-day-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { useToast } from "@/hooks/use-toast";
import type { SalesOrder, Customer, PaymentMethod, Installment, SaleType, Branch, CompanyBranch, User as UserType, SalesPermissions, Caixa, CaixaTransaction, ProductModality, CustomerCredit, StockingLocation, ProductStock } from "@/lib/definitions";
import { format, parseISO, isPast, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, GitFork, User as UserIcon, ShoppingCart, CreditCard, History, Undo2, ChevronDown, ChevronRight, ShieldAlert, FileText, Pencil, Trash2, Eye, MoreHorizontal, Check, X, Printer, Package, Search, CalendarIcon, DollarSign, Redo2, Copy } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";


const statusConfig: { [key in SalesOrder['status']]: { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string; icon: React.ReactNode } } = {
  pending: { label: "Pendente", variant: "secondary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  awaiting_approval: { label: "Aguardando Aprovação", variant: "outline", className: "text-yellow-600 border-yellow-500", icon: <ShieldAlert className="h-3 w-3" /> },
  billed: { label: "Faturado", variant: "default", className: "bg-green-600 hover:bg-green-700", icon: <Check className="h-3 w-3" /> },
  cancelled: { label: "Cancelado", variant: "destructive", icon: <X className="h-3 w-3" /> },
  returned: { label: "Devolvido", variant: "outline", className: "text-blue-600 border-blue-500", icon: <Undo2 className="h-3 w-3" /> },
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
      // Deselect all by calling onSelectionChange for each selected item
      selectedValues.forEach(value => onSelectionChange(value));
    } else {
      // Select all unselected items
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
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>{placeholder}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={options.length > 0 && selectedValues.length === options.length}
          onCheckedChange={handleSelectAll}
          onSelect={(e: Event) => e.preventDefault()}
        >
          Selecionar Todos
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={() => onSelectionChange(option.value)}
            onSelect={(e: Event) => e.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
};

export default function SalesHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdToEdit = searchParams.get('orderId');

  const [user, authLoading] = useAuthState(auth);
  const [currentUserData, setCurrentUserData] = React.useState<UserType | null>(null);
  const [orders, setOrders] = React.useState<SalesOrder[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [allUsers, setAllUsers] = React.useState<UserType[]>([]);
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [productModalities, setProductModalities] = React.useState<ProductModality[]>([]);
  const [saleTypes, setSaleTypes] = React.useState<SaleType[]>([]);
  const [stockingLocations, setStockingLocations] = React.useState<StockingLocation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [orderToDelete, setOrderToDelete] = React.useState<SalesOrder | null>(null);

  const [orderToCancel, setOrderToCancel] = React.useState<SalesOrder | null>(null);
  const [creditConfiguration, setCreditConfiguration] = React.useState<{
    order: SalesOrder;
    selectedItems: string[];
    itemLocations: Record<string, string>; // productId -> stockingLocationId
    includeFreight: boolean;
    includeServices: boolean;
  } | null>(null);

  const [cancelConfiguration, setCancelConfiguration] = React.useState<{
    order: SalesOrder;
    itemLocations: Record<string, string>;
    cancelFreight: boolean;
    cancelServices: boolean;
  } | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = React.useState("");
  const [branchFilter, setBranchFilter] = React.useState<string>("all");
  const [selectedSellers, setSelectedSellers] = React.useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 20;

  const [showCaixaClosedModal, setShowCaixaClosedModal] = React.useState(false);

  const [userPermissions, setUserPermissions] = React.useState({
    canViewAll: false,
    canViewOwn: true,
    canEditOwn: false,
    viewableBranchIds: [] as string[],
  });
  const [canManageOrders, setCanManageOrders] = React.useState(false);

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) => {
    setter((prev: string[]) => {
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
    if (!user) return;
    try {
      setLoading(true);

      const [
        userDocSnap,
        permsSnap,
        branchesSnap,
        companyBranchesSnap,
        paymentMethodsSnap,
        modalitiesSnap,
        saleTypesSnap,
        stockingLocationsSnap,
        allUsersSnap,
      ] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDoc(doc(db, "settings", "salesPermissions")),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "companyBranches")),
        getDocs(collection(db, "paymentMethods")),
        getDocs(collection(db, "productModalities")),
        getDocs(collection(db, "saleTypes")),
        getDocs(collection(db, "stockingLocations")),
        getDocs(collection(db, "users")),
      ]);

      const fetchedUserData = userDocSnap.exists() ? { id: userDocSnap.id, ...userDocSnap.data() } as UserType : null;
      setCurrentUserData(fetchedUserData);

      const permissions = permsSnap.exists() ? permsSnap.data() as SalesPermissions : {};
      const allCompanyBranches = companyBranchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyBranch));

      const canViewAll = fetchedUserData?.isAdmin || permissions.viewAllOrders?.userIds?.includes(user.uid) || permissions.viewAllOrders?.roleIds?.includes(fetchedUserData?.roleId || '');

      let permittedBranchIds: string[] = [];
      if (permissions.viewBranchOrders?.roles?.[fetchedUserData?.roleId || '']) {
        permittedBranchIds.push(...permissions.viewBranchOrders.roles[fetchedUserData!.roleId!]);
      }
      if (permissions.viewBranchOrders?.users?.[user.uid]) {
        permittedBranchIds = [...new Set([...permittedBranchIds, ...permissions.viewBranchOrders.users[user.uid]])];
      }

      const canViewBranch = permittedBranchIds.length > 0;
      const canViewOwn = permissions.canViewOwnOrders?.roleIds?.includes(fetchedUserData?.roleId || '') || permissions.canViewOwnOrders?.userIds?.includes(user.uid);
      const allowEditingOwn = !!permissions.canViewOwnOrders?.allowEditingOwn;
      const hasSpecificPermissions = canViewAll || canViewBranch || canViewOwn;

      setUserPermissions({
        canViewAll: !!canViewAll,
        canViewOwn: hasSpecificPermissions ? !!canViewOwn : true,
        canEditOwn: !!(allowEditingOwn && canViewOwn),
        viewableBranchIds: permittedBranchIds,
      });

      setCanManageOrders(!!canViewAll || canViewBranch);

      let finalOrders: SalesOrder[] = [];

      // OTIMIZAÇÃO: Buscar apenas os últimos pedidos ordenados globalmente pela data (createdAt) para evitar erros de composite index do Firestore, 
      // já que agora orderNumber repete por filial.
      const ordersQuery = query(collection(db, "salesOrders"), firestoreOrderBy("createdAt", "desc"), limit(canViewAll ? 150 : 400));
      const ordersSnap = await getDocs(ordersQuery);
      let allRecentOrders = ordersSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as SalesOrder));

      if (canViewAll) {
         finalOrders = allRecentOrders;
      } else if (canViewBranch) {
        const companyBranchIdsToQuery = allCompanyBranches
          .filter(cb => permittedBranchIds.includes(cb.branchId))
          .map(cb => cb.id);
        finalOrders = allRecentOrders.filter(o => companyBranchIdsToQuery.includes(o.companyBranchId || ""));
      } else { // Default to own orders
        finalOrders = allRecentOrders.filter(o => o.createdByUserId === user.uid);
      }

      setOrders(finalOrders);

      // Set other data
      setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
      setCompanyBranches(allCompanyBranches);
      setPaymentMethods(paymentMethodsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod)));
      setCustomers([]); // Removido por performance: dependia de tabelas colossais. Buscas parciais locais operam pelos dados injetados no order.
      setProductModalities(modalitiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductModality)));
      setSaleTypes(saleTypesSnap.docs.map(d => ({ id: d.id, ...d.data() } as SaleType)));
      setStockingLocations(stockingLocationsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockingLocation)));
      setAllUsers(allUsersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserType)));


    } catch (error) {
      console.error("Error fetching sales history:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const filteredOrders = React.useMemo(() => {
    return orders.filter(order => {
      // Branch Filter
      if (branchFilter !== "all" && order.companyBranchId) {
        const companyBranch = companyBranches.find(cb => cb.id === order.companyBranchId);
        if (!companyBranch || companyBranch.branchId !== branchFilter) {
          return false;
        }
      }
      // Seller Filter
      if (selectedSellers.length > 0 && !selectedSellers.includes(order.createdByUserId)) {
        return false;
      }
      // Status Filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(order.status)) {
        return false;
      }
      // Date Range Filter
      if (dateRange?.from && order.createdAt?.toDate) {
        const orderDate = order.createdAt.toDate();
        if (!isWithinInterval(orderDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to || dateRange.from) })) {
          return false;
        }
      }
      // Search Term Filter
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const customer = customers.find(c => c.id === order.customerId);
      const customerPhones = customer?.phones.map(p => p.number.replace(/\D/g, '')).join(' ') || '';

      return (
        (order.orderNumber || 0).toString().includes(searchTerm) ||
        order.customerName.toLowerCase().includes(term) ||
        (customer?.cpf && customer.cpf.replace(/\D/g, '').includes(searchTerm)) ||
        customerPhones.includes(searchTerm)
      );
    });
  }, [orders, customers, searchTerm, branchFilter, companyBranches, selectedSellers, selectedStatuses, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE));

  const paginatedOrders = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage, ITEMS_PER_PAGE]);

  // Reset to page 1 whenever filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, branchFilter, selectedSellers, selectedStatuses, dateRange]);

  React.useEffect(() => {
    // Força o scroll para o topo ao montar a página
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  React.useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  const getBranchName = (companyBranchId?: string) => {
    if (!companyBranchId) return 'N/A';
    const companyBranch = companyBranches.find(cb => cb.id === companyBranchId);
    if (!companyBranch) return 'N/A';
    return branches.find(b => b.id === companyBranch.branchId)?.name || 'N/A';
  };

  const getSaleTypeName = (id: string) => saleTypes.find(st => st.id === id)?.name || 'N/A';

  const handleOpenCreditConfigurationModal = (order: SalesOrder) => {
    const allItemIds = order.items.map(item => item.productId);
    setCreditConfiguration({
      order,
      selectedItems: allItemIds,
      itemLocations: {}, // Initialize as empty
      includeFreight: true,
      includeServices: true,
    });
    setOrderToCancel(null);
  };

  const handleCreditConfigChange = (field: 'includeFreight' | 'includeServices', value: boolean) => {
    if (!creditConfiguration) return;
    setCreditConfiguration(prev => ({ ...prev!, [field]: value }));
  };

  const handleCreditItemSelection = (productId: string) => {
    if (!creditConfiguration) return;
    setCreditConfiguration(prev => {
      const newSelectedItems = [...prev!.selectedItems];
      const newItemLocations = { ...prev!.itemLocations };
      const index = newSelectedItems.indexOf(productId);
      
      if (index > -1) {
        newSelectedItems.splice(index, 1);
        delete newItemLocations[productId];
      } else {
        newSelectedItems.push(productId);
        newItemLocations[productId] = "";
      }
      
      return { ...prev!, selectedItems: newSelectedItems, itemLocations: newItemLocations };
    });
  };

  const handleToggleAllCreditItems = (isChecked: boolean) => {
    if (!creditConfiguration) return;
    setCreditConfiguration(prev => ({
      ...prev!,
      selectedItems: isChecked ? prev!.order.items.map(item => item.productId) : [],
      itemLocations: isChecked 
        ? prev!.order.items.reduce((acc, item) => ({ ...acc, [item.productId]: "" }), {}) 
        : {},
    }));
  };

  const handleItemLocationChange = (productId: string, locationId: string) => {
    if (!creditConfiguration) return;
    setCreditConfiguration(prev => ({
      ...prev!,
      itemLocations: { ...prev!.itemLocations, [productId]: locationId }
    }));
  };

  const availableStockingLocations = React.useMemo(() => {
    if (!currentUserData) return [];
    return stockingLocations.filter(loc => {
      if (loc.isActive === false) return false;
      if (currentUserData.isAdmin) return true;
      if (loc.visibleToRoleIds && loc.visibleToRoleIds.length > 0) {
        if (!loc.visibleToRoleIds.includes(currentUserData.roleId)) return false;
      }
      const isOriginBranch = loc.branchId === currentUserData.branchId;
      if (isOriginBranch) {
        return loc.isVisibleInOrigin;
      } else {
        return loc.isVisibleToOtherBranches;
      }
    });
  }, [stockingLocations, currentUserData]);

  const { calculatedCredit, isFullReturn } = React.useMemo(() => {
    if (!creditConfiguration) return { calculatedCredit: 0, isFullReturn: false };

    const { order, selectedItems, includeFreight, includeServices } = creditConfiguration;

    // Calculate total discount on the returned items
    const returnedItemsSubtotal = order.items
      .filter(i => selectedItems.includes(i.productId))
      .reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0);

    const proportionalGeneralDiscount = order.subtotal > 0
      ? (returnedItemsSubtotal / order.subtotal) * (order.generalDiscountValue || 0)
      : 0;

    const returnedItemsDiscount = order.items
      .filter(i => selectedItems.includes(i.productId))
      .reduce((sum, i) => {
        const itemTotal = i.unitPrice * i.quantity;
        return sum + (i.discountType === 'percentage' ? itemTotal * (i.discountValue / 100) : i.discountValue);
      }, 0);

    const totalItemValue = returnedItemsSubtotal - returnedItemsDiscount;
    let creditTotal = totalItemValue - proportionalGeneralDiscount;

    const isFullItemReturn = selectedItems.length === order.items.length;

    if (isFullItemReturn) {
      if (includeFreight) creditTotal += order.freightValue || 0;
      if (includeServices) creditTotal += (order.services || []).reduce((sum, s) => sum + s.price, 0);
    }

    return { calculatedCredit: Math.max(0, creditTotal), isFullReturn: isFullItemReturn };
  }, [creditConfiguration]);

  const cancellationSummary = React.useMemo(() => {
    if (!cancelConfiguration) return null;
    const { order, cancelFreight, cancelServices } = cancelConfiguration;

    const totalPaid = (order.payments || [])
      .flatMap(p => p.installments || [])
      .filter(inst => inst.paid)
      .reduce((sum, inst) => sum + inst.value, 0);

    let totalToReverse = totalPaid;
    const freightCost = order.freightValue || 0;
    const servicesCost = (order.services || []).reduce((acc, s) => acc + s.price, 0);

    const paidRatio = order.total > 0 ? totalPaid / order.total : 0;
    const proportionalFreight = freightCost * paidRatio;
    const proportionalServices = servicesCost * paidRatio;

    if (!cancelFreight) {
      totalToReverse -= proportionalFreight;
    }
    if (!cancelServices) {
      totalToReverse -= proportionalServices;
    }

    return {
      totalPaid,
      proportionalFreight: cancelFreight ? 0 : proportionalFreight,
      proportionalServices: cancelServices ? 0 : proportionalServices,
      totalToReverse: Math.max(0, totalToReverse)
    };
  }, [cancelConfiguration]);

  const handleCancelLocationChange = (productId: string, locationId: string) => {
    setCancelConfiguration(prev => {
      if (!prev) return null;
      return {
        ...prev,
        itemLocations: { ...prev.itemLocations, [productId]: locationId }
      };
    });
  };

  const handleCancelConfigChange = (field: 'cancelFreight' | 'cancelServices', value: boolean) => {
    setCancelConfiguration(prev => {
      if (!prev) return null;
      return { ...prev, [field]: value };
    });
  };


  const handleGenerateCredit = async () => {
    if (!creditConfiguration || !user || !currentUserData) return;

    const { order, selectedItems, itemLocations, includeFreight, includeServices } = creditConfiguration;
    const creditAmount = calculatedCredit;

    // VALIDATION: Ensure all selected items have a location chosen
    const missingLocations = selectedItems.some(id => !itemLocations[id]);
    if (missingLocations) {
        toast({ title: "Local de estoque obrigatório", description: "Selecione o local de destino para todos os produtos devolvidos.", variant: "destructive" });
        return;
    }

    const batch = writeBatch(db);
    try {
      if (creditAmount <= 0) {
        toast({ title: "Valor de crédito inválido", description: "O valor do crédito a ser gerado é zero ou negativo.", variant: "destructive" });
        return;
      }

      const caixaQuery = query(collection(db, "caixas"), where("userId", "==", user.uid), where("status", "==", "open"), limit(1));
      const caixaSnap = await getDocs(caixaQuery);
      if (caixaSnap.empty) {
        setShowCaixaClosedModal(true);
        return;
      }
      const activeCaixa = { id: caixaSnap.docs[0].id, ...caixaSnap.docs[0].data() } as Caixa;
      const caixaRef = doc(db, "caixas", activeCaixa.id);

      const newTransaction: CaixaTransaction = {
        id: `reversal_credit-${order.id}-${Date.now()}`,
        type: 'cancellation_reversal',
        value: -creditAmount,
        relatedDocId: order.id,
        timestamp: new Date().toISOString(),
        notes: `Crédito por devolução Pedido #${order.orderNumber}`,
      };
      const updatedTransactions = [...(activeCaixa.transactions || []), newTransaction];
      batch.update(caixaRef, { transactions: updatedTransactions });

      const existingCreditQuery = query(collection(db, "customerCredits"), where("customerId", "==", order.customerId), limit(1));
      const existingCreditSnap = await getDocs(existingCreditQuery);

      const returnedItemsText = order.items.filter(i => creditConfiguration.selectedItems.includes(i.productId)).map(i => i.productName).join(', ');

      const note = `[CRÉDITO GERADO] Pedido #${order.orderNumber} em ${format(new Date(), 'dd/MM/yyyy')}: ${returnedItemsText}`.trim();

      if (!existingCreditSnap.empty) {
        const creditDocRef = existingCreditSnap.docs[0].ref;
        const existingData = existingCreditSnap.docs[0].data() as CustomerCredit;
        const newCreditAmount = existingData.creditAmount + creditAmount;
        const newBalance = (existingData.balance || 0) + creditAmount;
        
        batch.update(creditDocRef, {
          creditAmount: newCreditAmount,
          balance: newBalance,
          notes: `${existingData.notes || ''}\n${note}`,
          orderNumber: order.orderNumber,
          updatedAt: serverTimestamp(),
        });

        // Adiciona registro de movimentação (extrato)
        batch.set(doc(collection(db, "customerCreditMovements")), {
            customerId: order.customerId,
            type: 'refund',
            amount: creditAmount,
            reason: note,
            relatedDocId: order.id,
            userId: user.uid,
            userName: currentUserData.name || "N/A",
            createdAt: serverTimestamp()
        });
      } else {
        const newCreditRef = doc(collection(db, "customerCredits"));
        batch.set(newCreditRef, {
          customerId: order.customerId,
          customerName: order.customerName,
          creditAmount: creditAmount,
          usedAmount: 0,
          balance: creditAmount,
          notes: note,
          orderNumber: order.orderNumber,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user.uid,
        });

        // Adiciona registro de movimentação (extrato)
        batch.set(doc(collection(db, "customerCreditMovements")), {
            customerId: order.customerId,
            type: 'addition',
            amount: creditAmount,
            reason: note,
            relatedDocId: order.id,
            userId: user.uid,
            userName: currentUserData.name || "N/A",
            createdAt: serverTimestamp()
        });
      }

      // 3. Update order status and returned values
      const orderRef = doc(db, "salesOrders", order.id);

      const returnedItemsValue = creditConfiguration.order.items
        .filter(i => creditConfiguration.selectedItems.includes(i.productId))
        .reduce((sum, item) => {
          const itemTotal = item.unitPrice * item.quantity;
          const itemDiscount = item.discountType === 'percentage'
            ? itemTotal * (item.discountValue / 100)
            : item.discountValue;
          const proportionalGeneralDiscount = order.subtotal > 0
            ? (itemTotal / order.subtotal) * (order.generalDiscountValue || 0)
            : 0;
          return sum + (itemTotal - itemDiscount - proportionalGeneralDiscount);
        }, 0);

      const returnedFreightValue = isFullReturn && includeFreight ? order.freightValue || 0 : 0;
      const returnedServicesValue = isFullReturn && includeServices ? (order.services || []).reduce((sum, s) => sum + s.price, 0) : 0;

      batch.update(orderRef, {
        status: 'returned',
        returnedAt: serverTimestamp(),
        returnedItemsValue: returnedItemsValue,
        returnedFreightValue: returnedFreightValue,
        returnedServicesValue: returnedServicesValue,
        observations: `${order.observations || ''}\n[DEVOLUÇÃO ${isFullReturn ? 'TOTAL' : 'PARCIAL'} GEROU CRÉDITO DE ${formatCurrency(creditAmount)} EM ${format(new Date(), 'dd/MM/yyyy')}]`.trim()
      });

      // 4. Update Stock
      for (const productId of selectedItems) {
        const item = order.items.find(i => i.productId === productId);
        const locationId = itemLocations[productId];
        if (item && locationId) {
            const stockRef = doc(db, "productStock", `${productId}_${locationId}`);
            const stockSnap = await getDoc(stockRef);
            if (stockSnap.exists()) {
                batch.update(stockRef, { quantity: increment(item.quantity) });
            } else {
                batch.set(stockRef, {
                    productId,
                    stockingLocationId: locationId,
                    quantity: item.quantity,
                    branchId: stockingLocations.find(l => l.id === locationId)?.branchId || order.companyBranchId || "",
                    updatedAt: serverTimestamp()
                });
            }
            batch.set(doc(collection(db, "stockMovements")), {
                productId: item.productId,
                stockingLocationId: locationId,
                type: 'sale_reversal',
                quantityChange: item.quantity,
                reason: `Estorno Devolução/Crédito Pedido #${order.orderNumber}`,
                relatedDocId: order.id,
                lotId: item.lotId || null,
                valueChange: -item.total,
                userId: user!.uid,
                userName: currentUserData?.name || "N/A",
                createdAt: serverTimestamp()
            });
        }
      }

      await batch.commit();

      const updatedOrder = {
        ...order,
        status: 'returned' as const,
        returnedAt: new Date().toISOString(), // Using string for easier local state update
        returnedItemsValue,
        returnedFreightValue,
        returnedServicesValue,
        observations: `${order.observations || ''}\n[DEVOLUÇÃO ${isFullReturn ? 'TOTAL' : 'PARCIAL'} GEROU CRÉDITO DE ${formatCurrency(creditAmount)} EM ${format(new Date(), 'dd/MM/yyyy')}]`.trim()
      };

      setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));

      toast({ title: "Crédito Gerado!", description: `Crédito de ${formatCurrency(creditAmount)} gerado para ${order.customerName}.` });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao gerar crédito", variant: "destructive" });
    } finally {
      setCreditConfiguration(null);
    }
  };

  const handleUpdateStatus = async (order: SalesOrder, status: SalesOrder['status']) => {
    if (status === 'cancelled') {
      setOrderToCancel(order);
      return;
    }

    try {
      const orderRef = doc(db, "salesOrders", order.id);
      await updateDoc(orderRef, { status: status });

      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status } : o));

      toast({ title: "Status do pedido atualizado!" });
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const handleConfirmCancellation = async () => {
    if (!cancelConfiguration || !user || !currentUserData) return;
    const { order, itemLocations, cancelFreight, cancelServices } = cancelConfiguration;

    // VALIDATION: Ensure all items have a location chosen
    const missingLocations = order.items.some(i => i.productId && !itemLocations[i.productId]);
    if (missingLocations) {
        toast({ title: "Local de estoque obrigatório", description: "Selecione o local de destino para todos os produtos do pedido.", variant: "destructive" });
        return;
    }

    const batch = writeBatch(db);
    const orderRef = doc(db, "salesOrders", order.id);

    try {
      if (cancellationSummary && cancellationSummary.totalPaid > 0) {
        const caixaQuery = query(collection(db, "caixas"), where("userId", "==", user.uid), where("status", "==", "open"), limit(1));
        const caixaSnap = await getDocs(caixaQuery);
        if (caixaSnap.empty) {
          setShowCaixaClosedModal(true);
          return;
        }
        const activeCaixa = { id: caixaSnap.docs[0].id, ...caixaSnap.docs[0].data() } as Caixa;
        const caixaRef = doc(db, "caixas", activeCaixa.id);

        const newTransaction: CaixaTransaction = {
          id: `reversal-${order.id}-${Date.now()}`,
          type: 'cancellation_reversal',
          value: -cancellationSummary.totalToReverse,
          relatedDocId: order.id,
          timestamp: new Date().toISOString(),
          notes: `Estorno cancelamento Pedido #${order.orderNumber}`,
        };
        const updatedTransactions = [...(activeCaixa.transactions || []), newTransaction];
        batch.update(caixaRef, { transactions: updatedTransactions });
      }

      batch.update(orderRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        returnedItemsValue: order.items.reduce((sum, item) => sum + item.total, 0),
        returnedFreightValue: cancelFreight ? order.freightValue || 0 : 0,
        returnedServicesValue: cancelServices ? (order.services || []).reduce((sum, s) => sum + s.price, 0) : 0,
      });

      // --- REVERSÃO AO ESTOQUE ---
      for (const item of order.items || []) {
        const locationId = itemLocations[item.productId];
        if (item.productId && locationId) {
          const stockRef = doc(db, "productStock", `${item.productId}_${locationId}`);
          const stockSnap = await getDoc(stockRef);
          
          if (stockSnap.exists()) {
            batch.update(stockRef, { quantity: increment(item.quantity) });
          } else {
            batch.set(stockRef, {
              productId: item.productId,
              stockingLocationId: locationId,
              quantity: item.quantity,
              branchId: stockingLocations.find(l => l.id === locationId)?.branchId || order.companyBranchId || "",
              updatedAt: serverTimestamp()
            });
          }

          batch.set(doc(collection(db, "stockMovements")), {
            productId: item.productId,
            stockingLocationId: locationId,
            type: 'sale_reversal',
            quantityChange: item.quantity,
            reason: `Estorno Cancelamento Pedido #${order.orderNumber}`,
            relatedDocId: order.id,
            lotId: item.lotId || null,
            valueChange: -item.total,
            userId: user.uid,
            userName: currentUserData?.name || "N/A",
            createdAt: serverTimestamp()
          });
        }
      }

      await batch.commit();

      setOrders(prev => prev.map(o => o.id === order.id ? { 
        ...o, 
        status: 'cancelled' as const,
        cancelledAt: new Date().toISOString(),
        returnedItemsValue: order.items.reduce((sum, item) => sum + item.total, 0),
        returnedFreightValue: cancelFreight ? order.freightValue || 0 : 0,
        returnedServicesValue: cancelServices ? (order.services || []).reduce((sum, s) => sum + s.price, 0) : 0,
      } : o));

      toast({ title: "Pedido Cancelado!", description: "O estoque foi estornado." });
    } catch (error) {
      toast({ title: "Erro ao cancelar pedido", variant: "destructive" });
      console.error("Error cancelling order:", error);
    } finally {
      setCancelConfiguration(null);
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;

    const hasPaidInstallments = (orderToDelete.payments || []).some(p => (p.installments || []).some(i => i.paid));
    if (hasPaidInstallments) {
      toast({
        title: "Exclusão não permitida",
        description: "Este pedido possui recebimentos e não pode ser excluído.",
        variant: "destructive"
      });
      setOrderToDelete(null);
      return;
    }

    const batch = writeBatch(db);
    try {
      const orderRef = doc(db, "salesOrders", orderToDelete.id);
      
      // --- REVERSÃO AO ESTOQUE ---
      for (const item of orderToDelete.items || []) {
        if (item.productId && item.originStockingLocationId) {
          const stockQuery = query(collection(db, "productStock"), where("productId", "==", item.productId), where("stockingLocationId", "==", item.originStockingLocationId));
          const stockSnap = await getDocs(stockQuery);
          if (!stockSnap.empty) {
            const stockDoc = stockSnap.docs[0];
            const currentQuantity = stockDoc.data().quantity || 0;
            batch.update(stockDoc.ref, { quantity: currentQuantity + item.quantity });
            
            batch.set(doc(collection(db, "stockMovements")), {
              productId: item.productId,
              stockingLocationId: item.originStockingLocationId,
              type: 'sale_reversal',
              quantityChange: item.quantity,
              reason: `Estorno Exclusão Pedido #${orderToDelete.orderNumber}`,
              relatedDocId: orderToDelete.id,
              lotId: item.lotId || null,
              valueChange: -item.total,
              userId: user!.uid,
              userName: currentUserData?.name || "N/A",
              createdAt: serverTimestamp()
            });
          }
        }
      }

      // --- REVERSÃO DE CRÉDITO CLIENTE ---
      const creditUsed = (orderToDelete.payments || []).filter(p => paymentMethods.find(pm => pm.id === p.paymentMethodId)?.isCustomerCredit).reduce((sum, p) => sum + p.value, 0);
      if (creditUsed > 0 && orderToDelete.customerId) {
         const creditQuery = query(collection(db, "customerCredits"), where("customerId", "==", orderToDelete.customerId), limit(1));
         const creditSnap = await getDocs(creditQuery);
         if (!creditSnap.empty) {
             const creditDoc = creditSnap.docs[0];
             const currentBalance = creditDoc.data().balance || 0;
             batch.update(creditDoc.ref, { 
                 balance: currentBalance + creditUsed,
                 updatedAt: serverTimestamp() 
             });
             
             batch.set(doc(collection(db, "customerCreditMovements")), {
                customerId: orderToDelete.customerId,
                type: 'refund',
                amount: creditUsed,
                reason: `Estorno de Exclusão do Pedido #${orderToDelete.orderNumber}`,
                relatedDocId: orderToDelete.id,
                userId: user!.uid,
                userName: currentUserData?.name || "N/A",
                createdAt: serverTimestamp()
             });
         }
      }

      batch.delete(orderRef);

      await batch.commit();

      toast({ title: "Pedido Excluído!", description: "O pedido foi excluído e o estoque foi estornado.", variant: "destructive" });
      fetchData();
    } catch (error) {
      console.error("Error deleting order and reverting stock:", error);
      toast({ title: "Erro ao excluir", description: "Não foi possível excluir o pedido e estornar o estoque.", variant: "destructive" });
    } finally {
      setOrderToDelete(null);
    }
  };

  const handleEditOrder = (orderId: string) => {
    router.push(`/dashboard/sales/new?orderId=${orderId}`);
  };

  const handleMarkForNfe = async (order: SalesOrder) => {
    try {
      let assignedNumber = "";
      let assignedSerie = "";

      if (!(order as any).nfeNumber) {
        await runTransaction(db, async (transaction) => {
          const settingsRef = doc(db, "settings", "nfe_settings");
          const settingsSnap = await transaction.get(settingsRef);

          let nfeNumber = "";
          let nfeSerie = "";

          if (settingsSnap.exists()) {
            const settingsData = settingsSnap.data();
            const numeracoes = settingsData.numeracoes || [];
            
            const branchNumerationIndex = numeracoes.findIndex((n: any) => n.branchId === order.companyBranchId);
            
            if (branchNumerationIndex !== -1) {
              const numeration = numeracoes[branchNumerationIndex];
              nfeNumber = numeration.proximoNumero;
              nfeSerie = numeration.serie;
              
              assignedNumber = nfeNumber;
              assignedSerie = nfeSerie;

              const nextVal = parseInt(numeration.proximoNumero || "0", 10) + 1;
              numeracoes[branchNumerationIndex].proximoNumero = nextVal.toString();

              transaction.update(settingsRef, { numeracoes });
            }
          }

          const orderRef = doc(db, "salesOrders", order.id);
          const updateData: any = { readyForNfe: true, readyForNfeAt: serverTimestamp() };
          if (nfeNumber) {
            updateData.nfeNumber = nfeNumber;
            updateData.nfeSerie = nfeSerie;
          }
          transaction.update(orderRef, updateData);
        });
      } else {
        const orderRef = doc(db, "salesOrders", order.id);
        await updateDoc(orderRef, { readyForNfe: true, readyForNfeAt: serverTimestamp() });
        assignedNumber = (order as any).nfeNumber;
        assignedSerie = (order as any).nfeSerie;
      }

      setOrders(prev => prev.map(o => o.id === order.id ? { 
        ...o, 
        readyForNfe: true, 
        ...(assignedNumber ? { nfeNumber: assignedNumber, nfeSerie: assignedSerie } : {}) 
      } as any : o));

      toast({ 
        title: "Pedido enviado para emissão!", 
        description: assignedNumber 
          ? `NF-e ${assignedNumber} gerada. Pedido #${order.orderNumber} disponível na aba Emissão de NF-e.` 
          : `Pedido #${order.orderNumber} está disponível na aba Emissão de NF-e.` 
      });

      router.push('/dashboard/emissao-nfe');
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao enviar pedido para NF-e", variant: "destructive" });
    }
  };

  const handleJustCancel = (order: SalesOrder) => {
    setCancelConfiguration({
      order,
      itemLocations: {},
      cancelFreight: true,
      cancelServices: true,
    });
    setOrderToCancel(null);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "N/A";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const sellersForFilter = React.useMemo(() => {
    if (!allUsers || !currentUserData) return [];

    if (userPermissions.canViewAll) {
      return allUsers.filter(u => u.roleId);
    }

    if (userPermissions.viewableBranchIds.length > 0) {
      return allUsers.filter(u => userPermissions.viewableBranchIds.includes(u.branchId));
    }

    // Default to canViewOwn
    return [currentUserData];

  }, [allUsers, currentUserData, userPermissions]);

  const clearFilters = () => {
    setSearchTerm("");
    setBranchFilter("all");
    setSelectedSellers([]);
    setSelectedStatuses([]);
    setDateRange(undefined);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">Histórico de Pedidos de Venda</h1>
          <p className="text-muted-foreground mt-1 text-lg">Visualize e gerencie todos os pedidos de venda realizados.</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="rounded-xl shadow-sm hover:shadow-md transition-all h-12 w-12 hover:bg-primary/5 hover:border-primary/30">
          <RefreshCw className={loading ? "animate-spin h-5 w-5 text-primary" : "h-5 w-5 text-primary"} />
        </Button>
      </div>

      <Card className="border-none shadow-glass bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/10 pb-6 px-6 sm:px-8 pt-8">
          <CardTitle className="text-2xl font-headline flex justify-between items-center">Pedidos Realizados</CardTitle>
          <CardDescription className="text-base">{filteredOrders.length} de {orders.length} pedidos encontrados.</CardDescription>
          <div className="pt-6">
            <div className="bg-background/80 backdrop-blur-sm p-5 rounded-2xl border border-border/50 shadow-soft">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Buscar por nº do pedido, cliente, CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="md:col-span-2"
                />
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger><SelectValue placeholder="Filtrar por filial..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Filiais</SelectItem>
                    {branches.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "LLL dd, y", { locale: ptBR })} - ${format(dateRange.to, "LLL dd, y", { locale: ptBR })}` : format(dateRange.from, "LLL dd, y")) : <span>Filtrar por data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} />
                  </PopoverContent>
                </Popover>
                <MultiSelectFilter
                  placeholder="Filtrar por Vendedores"
                  options={sellersForFilter.map(u => ({ value: u.id, label: u.name }))}
                  selectedValues={selectedSellers}
                  onSelectionChange={handleFilterChange(setSelectedSellers)}
                />
                <MultiSelectFilter
                  placeholder="Filtrar por Status"
                  options={Object.entries(statusConfig).map(([key, config]) => ({ value: key, label: config.label }))}
                  selectedValues={selectedStatuses}
                  onSelectionChange={handleFilterChange(setSelectedStatuses)}
                />
              </div>
              <div className="flex justify-end mt-4 pt-2 border-t border-border/30">
                <Button variant="ghost" onClick={clearFilters} className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl">
                  <X className="mr-2 h-4 w-4" />
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <AlertDialog>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pb-4 mb-2 border-b border-border/30">
                  <p className="text-sm text-muted-foreground">
                    Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> &mdash; {filteredOrders.length} pedidos
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-xl"
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-xl"
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
              <div className="w-full space-y-4">
                {paginatedOrders.map(order => {
                  const currentStatus = statusConfig[order.status] || { label: "Desconhecido", variant: "secondary", icon: <Package /> };
                  const hasPaidInstallments = (order.payments || []).some(p => (p.installments || []).some(i => i.paid));
                  const hasUnpaidInstallments = (order.payments || []).some(p => (p.installments || []).some(i => !i.paid));
                  const hasAnyPayments = (order.payments || []).length > 0;
                  const isFullyPaid = hasAnyPayments && !hasUnpaidInstallments;
                  const isOwnOrder = order.createdByUserId === user?.uid;

                  return (
                    <div key={order.id} className="border border-border/50 rounded-2xl shadow-sm hover:shadow-glow hover:border-primary/20 transition-all bg-card overflow-hidden p-5 sm:px-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
                        <div className="flex-1">
                          <div className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                            Pedido #{order.orderNumber}
                            <Badge variant={currentStatus.variant} className={`${currentStatus.className} gap-1.5 shadow-sm rounded-full px-3 py-1 font-medium`}>
                              {currentStatus.icon}
                              {currentStatus.label}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {formatDate(order.createdAt)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1 font-medium">{order.customerName}</div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                            <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md"><ShoppingCart className="h-3 w-3" /> {getSaleTypeName(order.saleTypeId)}</span>
                            <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md"><GitFork className="h-3 w-3" /> {getBranchName(order.companyBranchId)}</span>
                            <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md"><UserIcon className="h-3 w-3" /> {order.createdByUserName}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-3 min-w-[max-content]">
                          <p className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-primary to-primary/70">
                            {formatCurrency(order.total)}
                          </p>
                          
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/sales/history/${order.id}`)} className="rounded-xl h-9 hover:bg-primary/5 hover:border-primary/30 transition-all border-border/50">
                              <Printer className="mr-2 h-4 w-4" /> Imprimir
                            </Button>
                            
                            {(canManageOrders || (userPermissions.canEditOwn && isOwnOrder)) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="default" size="sm" className="rounded-xl shadow-glow h-9">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="ml-2 font-medium">Ações</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl shadow-glass border-border/50 backdrop-blur-xl">
                                  <DropdownMenuLabel>Ações do Pedido</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => router.push('/dashboard/recebimento')}
                                    disabled={isFullyPaid || order.status === 'cancelled' || order.status === 'returned'}
                                  >
                                    <DollarSign className={cn("mr-2 h-4 w-4", (isFullyPaid || order.status === 'cancelled' || order.status === 'returned') && "text-muted-foreground")} /> Receber
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditOrder(order.id)} disabled={order.status !== 'pending'}>
                                    <Pencil className="mr-2 h-4 w-4" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => router.push(`/dashboard/sales/new?duplicateId=${order.id}`)}>
                                    <Copy className="mr-2 h-4 w-4" /> Duplicar Pedido
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => !hasUnpaidInstallments && handleMarkForNfe(order)}
                                    disabled={hasUnpaidInstallments || (order as any).readyForNfe === true}
                                    className={cn(
                                      "flex items-center gap-2",
                                      hasUnpaidInstallments && "opacity-50 cursor-not-allowed",
                                      (order as any).readyForNfe === true && "text-emerald-600 dark:text-emerald-400"
                                    )}
                                  >
                                    <FileText className="mr-2 h-4 w-4" />
                                    <span>
                                      {(order as any).readyForNfe === true ? 'Enviado para NF-e ✓' : 'Emitir NF-e'}
                                    </span>
                                    {hasUnpaidInstallments && (
                                      <span className="ml-auto text-[10px] text-amber-500 font-semibold">Receb. pendente</span>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel>Alterar Status</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(order, 'billed')} disabled={order.status === 'billed' || order.status === 'cancelled' || order.status === 'returned'}>
                                    <Check className="mr-2 h-4 w-4" /> Faturado
                                  </DropdownMenuItem>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      onSelect={(e) => { e.preventDefault(); setOrderToCancel(order); }}
                                      disabled={order.status === 'cancelled' || order.status === 'returned' || !hasPaidInstallments}
                                    >
                                      <X className="mr-2 h-4 w-4 text-destructive" /> Cancelar/Devolver
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <DropdownMenuSeparator />
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-red-600" onSelect={(e) => { e.preventDefault(); setOrderToDelete(order); }} disabled={hasPaidInstallments}>
                                      <Trash2 className="mr-2 h-4 w-4" /> Excluir Pedido
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-6 mt-4 border-t border-border/30">
                  <p className="text-sm text-muted-foreground">
                    Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> &mdash; {filteredOrders.length} pedidos
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-xl"
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-xl"
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
              <AlertDialogContent>
                {orderToDelete ? (
                  <>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir Pedido?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação é irreversível e excluirá permanentemente o pedido <strong>#{orderToDelete.orderNumber}</strong>. O estoque dos itens será estornado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setOrderToDelete(null)}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteOrder}>Sim, Excluir Pedido</AlertDialogAction>
                    </AlertDialogFooter>
                  </>
                ) : orderToCancel ? (
                  <>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar Pedido ou Gerar Crédito?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Para o pedido <strong>#{orderToCancel.orderNumber}</strong>, você pode cancelar a venda (estornando o estoque e pagamentos) ou gerar um crédito para o cliente no valor dos produtos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:justify-between flex flex-col-reverse sm:flex-row gap-2 w-full">
                      <AlertDialogAction asChild onClick={() => orderToCancel && handleJustCancel(orderToCancel)}>
                        <Button variant="secondary">
                          Apenas Cancelar Pedido
                        </Button>
                      </AlertDialogAction>
                      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <AlertDialogCancel onClick={() => setOrderToCancel(null)}>Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => orderToCancel && handleOpenCreditConfigurationModal(orderToCancel)}>Gerar Crédito de Devolução</AlertDialogAction>
                      </div>
                    </AlertDialogFooter>
                  </>
                ) : null}
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!creditConfiguration} onOpenChange={() => setCreditConfiguration(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar Crédito para Pedido #{creditConfiguration?.order.orderNumber}</DialogTitle>
            <DialogDescription>Selecione os itens e custos a serem incluídos no crédito de devolução.</DialogDescription>
          </DialogHeader>
          {creditConfiguration && (
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <div className="flex items-center space-x-2 border-b pb-2 mb-2">
                  <Checkbox
                    id="select-all-items"
                    checked={creditConfiguration.selectedItems.length === creditConfiguration.order.items.length}
                    onCheckedChange={(checked) => handleToggleAllCreditItems(!!checked)}
                  />
                  <Label htmlFor="select-all-items" className="font-semibold">Selecionar Todos os Produtos</Label>
                </div>
                {creditConfiguration.order.items.map(item => {
                  const isSelected = creditConfiguration.selectedItems.includes(item.productId);
                  return (
                    <div key={item.productId} className={cn("space-y-2 p-3 rounded-xl border transition-all", isSelected ? "bg-primary/5 border-primary/20 shadow-sm" : "border-transparent opacity-60 hover:opacity-100")}>
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={item.productId}
                          checked={isSelected}
                          onCheckedChange={() => handleCreditItemSelection(item.productId)}
                        />
                        <Label htmlFor={item.productId} className="flex justify-between items-center w-full cursor-pointer font-medium">
                          <span>{item.productName} (Qtd: {item.quantity})</span>
                          <span className="font-bold">{formatCurrency(item.total)}</span>
                        </Label>
                      </div>
                      
                      {isSelected && (
                        <div className="pl-7 animate-in fade-in slide-in-from-top-2 duration-200">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Local de Destino (Estorno de Estoque)</Label>
                          <Select 
                            value={creditConfiguration.itemLocations[item.productId] || ""} 
                            onValueChange={(val) => handleItemLocationChange(item.productId, val)}
                          >
                            <SelectTrigger className="h-9 bg-background rounded-lg text-xs">
                              <SelectValue placeholder="Selecione o local de destino..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableStockingLocations.map(loc => (
                                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!creditConfiguration.itemLocations[item.productId] && (
                            <p className="text-[10px] text-destructive font-bold mt-1 flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" /> Escolha rápida obrigatória
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center space-x-3">
                  <Checkbox id="include-freight" checked={creditConfiguration.includeFreight} onCheckedChange={checked => handleCreditConfigChange('includeFreight', !!checked)} disabled={!isFullReturn} />
                  <Label htmlFor="include-freight" className={cn("flex justify-between w-full", !isFullReturn && "text-muted-foreground cursor-not-allowed")}>
                    <span>Incluir Valor do Frete</span>
                    <span className="font-mono">{formatCurrency(creditConfiguration.order.freightValue || 0)}</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox id="include-services" checked={creditConfiguration.includeServices} onCheckedChange={checked => handleCreditConfigChange('includeServices', !!checked)} disabled={!isFullReturn} />
                  <Label htmlFor="include-services" className={cn("flex justify-between w-full", !isFullReturn && "text-muted-foreground cursor-not-allowed")}>
                    <span>Incluir Valor dos Serviços</span>
                    <span className="font-mono">{formatCurrency((creditConfiguration.order.services || []).reduce((sum, s) => sum + s.price, 0))}</span>
                  </Label>
                </div>
                {!isFullReturn && (
                  <p className="text-xs text-muted-foreground pt-2">O estorno de frete e serviços só é aplicável na devolução de todos os itens do pedido.</p>
                )}
              </div>
              <div className="p-4 bg-muted rounded-lg space-y-2 mt-4">
                <h3 className="font-semibold text-center">Resumo do Crédito</h3>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total do Crédito:</span>
                  <span>{formatCurrency(calculatedCredit)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditConfiguration(null)}>Cancelar</Button>
            <Button 
                onClick={handleGenerateCredit} 
                disabled={calculatedCredit <= 0 || !creditConfiguration || creditConfiguration.selectedItems.some(id => !creditConfiguration.itemLocations[id])}
                className="rounded-xl shadow-glow"
            >
              <Check className="h-4 w-4 mr-2" /> Confirmar Geração de Crédito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!cancelConfiguration} onOpenChange={() => setCancelConfiguration(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cancelar Pedido #{cancelConfiguration?.order.orderNumber}</DialogTitle>
            <DialogDescription>Selecione o local de destino para o estorno de estoque de cada item.</DialogDescription>
          </DialogHeader>
          {cancelConfiguration && (
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                {cancelConfiguration.order.items.map(item => (
                  <div key={item.productId} className="space-y-2 p-3 rounded-xl border border-primary/10 bg-primary/5 shadow-sm">
                    <div className="flex justify-between items-center font-medium text-sm">
                      <span>{item.productName} (Qtd: {item.quantity})</span>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Local de Destino (Estorno de Estoque)</Label>
                      <Select 
                        value={cancelConfiguration.itemLocations[item.productId] || ""} 
                        onValueChange={(val) => handleCancelLocationChange(item.productId, val)}
                      >
                        <SelectTrigger className="h-9 bg-background rounded-lg text-xs">
                          <SelectValue placeholder="Selecione o local de destino..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStockingLocations.map(loc => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!cancelConfiguration.itemLocations[item.productId] && (
                        <p className="text-[10px] text-destructive font-bold mt-1 flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" /> Seleção obrigatória
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="cancel-freight-cfg" 
                    checked={cancelConfiguration.cancelFreight} 
                    onCheckedChange={checked => handleCancelConfigChange('cancelFreight', !!checked)} 
                  />
                  <Label htmlFor="cancel-freight-cfg" className="flex justify-between w-full cursor-pointer text-sm">
                    <span>Estornar valor do Frete</span>
                    <span className="font-mono">{formatCurrency(cancelConfiguration.order.freightValue || 0)}</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="cancel-services-cfg" 
                    checked={cancelConfiguration.cancelServices} 
                    onCheckedChange={checked => handleCancelConfigChange('cancelServices', !!checked)} 
                  />
                  <Label htmlFor="cancel-services-cfg" className="flex justify-between w-full cursor-pointer text-sm">
                    <span>Estornar valor dos Serviços</span>
                    <span className="font-mono">{formatCurrency((cancelConfiguration.order.services || []).reduce((sum, s) => sum + s.price, 0))}</span>
                  </Label>
                </div>
              </div>

              {cancellationSummary && cancellationSummary.totalPaid > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2 mt-4 shadow-inner border border-border/50">
                  <h3 className="font-semibold text-center text-xs uppercase tracking-wider text-muted-foreground mb-3">Resumo do Estorno no Caixa</h3>
                  <div className="text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total já pago pelo cliente:</span>
                      <span className="font-semibold">{formatCurrency(cancellationSummary.totalPaid)}</span>
                    </div>
                    {cancellationSummary.proportionalFreight > 0 && (
                      <div className="flex justify-between text-destructive/80">
                        <span>(-) Valor do Frete (não estornado):</span>
                        <span>- {formatCurrency(cancellationSummary.proportionalFreight)}</span>
                      </div>
                    )}
                    {cancellationSummary.proportionalServices > 0 && (
                      <div className="flex justify-between text-destructive/80">
                        <span>(-) Valor dos Serviços (não estornado):</span>
                        <span>- {formatCurrency(cancellationSummary.proportionalServices)}</span>
                      </div>
                    )}
                    <Separator className="my-2" />
                    <div className="flex justify-between font-bold text-lg text-primary">
                      <span>Valor a Estornar no Caixa:</span>
                      <span>{formatCurrency(cancellationSummary.totalToReverse)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelConfiguration(null)} className="rounded-xl">Voltar</Button>
            <Button 
                onClick={handleConfirmCancellation} 
                disabled={!cancelConfiguration || cancelConfiguration.order.items.some(i => i.productId && !cancelConfiguration.itemLocations[i.productId])}
                variant="destructive"
                className="rounded-xl shadow-glow"
            >
              <Check className="h-4 w-4 mr-2" /> Confirmar Cancelamento do Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCaixaClosedModal} onOpenChange={setShowCaixaClosedModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Caixa Fechado</AlertDialogTitle>
            <AlertDialogDescription>
              Para cancelar ou devolver um pedido que já possui pagamentos, seu caixa precisa estar aberto para realizar o estorno dos valores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowCaixaClosedModal(false)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}