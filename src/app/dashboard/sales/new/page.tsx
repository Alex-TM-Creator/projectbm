
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  where,
  getDoc,
  writeBatch,
  limit,
  updateDoc,
  runTransaction,
  increment,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type {
  Product,
  Customer,
  Service,
  SaleType,
  DeliveryType,
  PaymentMethod,
  ProductModality,
  SalesOrderItem,
  SalesOrderService,
  SalesOrder,
  User as UserType,
  Phone,
  Address,
  StockingLocation,
  ProductStock,
  Installment,
  Branch,
  DiscountLimit,
  SalesOrderPayment,
  CustomerCredit,
  SalesPermissions,
  CompanyBranch,
  FreightCepRange,
  Lot,
  StockMovement,
} from "@/lib/definitions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter as TableFoot,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, parseISO, setDate, lastDayOfMonth, startOfToday, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Search, PlusCircle, UserPlus, Pencil, X, Trash2, CalendarIcon, ShoppingCart, GitFork, Loader2, Save, Package, DollarSign, ShieldAlert, Plus, Phone as PhoneIcon, Home, CheckCircle, MapPin } from "lucide-react";

const initialAddress: Address = {
  id: `address-${Date.now()}-${Math.random()}`,
  type: "Residencial",
  cep: "",
  address: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

const initialFormData: Partial<Customer> = {
  type: "fisica",
  name: "",
  cpf: "",
  cnpj: "",
  inscricaoEstadual: "",
  razaoSocial: "",
  birthDate: "",
  email: "",
  phones: [],
  addresses: [],
  branchId: "",
};

export default function NewSalePage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdToEdit = searchParams.get('orderId');
  const duplicateId = searchParams.get('duplicateId');

  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<UserType | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // lastOrderNumber was here

  // Collections
  const [services, setServices] = React.useState<Service[]>([]);
  const [saleTypes, setSaleTypes] = React.useState<SaleType[]>([]);
  const [deliveryTypes, setDeliveryTypes] = React.useState<DeliveryType[]>([]);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [productModalities, setProductModalities] = React.useState<ProductModality[]>([]);
  const [stockingLocations, setStockingLocations] = React.useState<StockingLocation[]>([]);
  const [productStocks, setProductStocks] = React.useState<ProductStock[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [discountLimits, setDiscountLimits] = React.useState<DiscountLimit[]>([]);
  const [customerCredits, setCustomerCredits] = React.useState<CustomerCredit[]>([]);
  const [permissions, setPermissions] = React.useState<SalesPermissions>({});
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [freightCepRanges, setFreightCepRanges] = React.useState<FreightCepRange[]>([]);
  const [allLots, setAllLots] = React.useState<Lot[]>([]);
  const [lotBalances, setLotBalances] = React.useState<Record<string, number>>({});

  // Form State
  const [saleTypeId, setSaleTypeId] = React.useState("");
  const [deliveryTypeId, setDeliveryTypeId] = React.useState("");
  const [deliveryDate, setDeliveryDate] = React.useState<Date | undefined>();
  const [deliveryLimits, setDeliveryLimits] = React.useState<Record<string, number | null>>({});
  const [deliveryLimitAlert, setDeliveryLimitAlert] = React.useState<{isOpen: boolean, date: Date | null, count: number, limit: number, isFull: boolean}>({ isOpen: false, date: null, count: 0, limit: 0, isFull: false });

  const [customerSearch, setCustomerSearch] = React.useState("");
  const [filteredCustomers, setFilteredCustomers] = React.useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = React.useState(false);
  const [editingCustomerData, setEditingCustomerData] = React.useState<Partial<Customer> | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = React.useState(false);
  const [selectedDeliveryAddress, setSelectedDeliveryAddress] = React.useState<Address | null>(null);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = React.useState(false);
  const [selectedDeliveryPhone, setSelectedDeliveryPhone] = React.useState<Phone | null>(null);

  const [productSearch, setProductSearch] = React.useState("");
  const [filteredProducts, setFilteredProducts] = React.useState<Product[]>([]);
  const [orderItems, setOrderItems] = React.useState<SalesOrderItem[]>(Array(5).fill(null).map(() => ({
    productId: "", productName: "", quantity: 1, unitPrice: 0, discountType: 'percentage', discountValue: 0, total: 0, originStockingLocationId: "", productModalityId: "", deliveryOption: 'Entregar'
  })));
  const [orderServices, setOrderServices] = React.useState<SalesOrderService[]>([]);
  const [freightValue, setFreightValue] = React.useState(0);
  const [generalDiscountType, setGeneralDiscountType] = React.useState<'percentage' | 'fixed'>('percentage');
  const [generalDiscountValue, setGeneralDiscountValue] = React.useState(0);
  const [observations, setObservations] = React.useState("");
  const [payments, setPayments] = React.useState<SalesOrderPayment[]>([]);
  const [locationModal, setLocationModal] = React.useState<{ isOpen: boolean; product: Product | null; itemIndex: number | null }>({ isOpen: false, product: null, itemIndex: null });
  const [showDiscountAlert, setShowDiscountAlert] = React.useState(false);
  const [isFetchingCep, setIsFetchingCep] = React.useState<string | null>(null);

  // --- Utility Functions ---

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatCurrencyForInput = (value?: number) => {
    if (value === undefined || value === null) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(value);
  };

  const formatPercentageForInput = (value?: number): string => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPhone = (value: string) => {
    if (!value) return "";
    value = value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 10) {
      return value.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (value.length > 6) {
      return value.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    } else if (value.length > 2) {
      return value.replace(/(\d{2})(\d{0,5})/, "($1) $2");
    }
    return value.replace(/^(\d*)/, "($1");
  };

  const calculateInstallments = React.useCallback((value: number, paymentMethodId: string, numInstallments?: number): Installment[] => {
    const method = paymentMethods.find(m => m.id === paymentMethodId);
    if (!method) return [];
    const installmentsCount = numInstallments || method.installments || 1;
    if (installmentsCount <= 0) return [];

    const interestRates = method.interestRates || [];

    const interestRate = interestRates[installmentsCount - 1] || 0;
    const totalWithInterest = value * (1 + interestRate / 100);

    const installmentBaseValue = totalWithInterest / installmentsCount;
    const newInstallments: Installment[] = [];
    const { receivingTerm, installmentIntervalDays, keepSameDay } = method;
    const firstDueDate = addDays(new Date(), receivingTerm || 0);
    const dayOfFirstDueDate = firstDueDate.getDate();

    for (let i = 1; i <= installmentsCount; i++) {
      let dueDate: Date;
      if (i === 1) {
        dueDate = firstDueDate;
      } else {
        const previousDueDate = parseISO(newInstallments[i - 2].dueDate);
        let nextDate = addDays(previousDueDate, installmentIntervalDays || 30);
        if (keepSameDay) {
          const lastDayOfNextMonth = lastDayOfMonth(nextDate).getDate();
          const targetDay = Math.min(dayOfFirstDueDate, lastDayOfNextMonth);
          nextDate = setDate(nextDate, targetDay);
        }
        dueDate = nextDate;
      }
      newInstallments.push({ number: i, dueDate: dueDate.toISOString(), value: parseFloat(installmentBaseValue.toFixed(2)), paid: false });
    }

    const finalSum = newInstallments.reduce((sum, inst) => sum + inst.value, 0);
    const diff = parseFloat((totalWithInterest - finalSum).toFixed(2));
    if (newInstallments.length > 0) {
      newInstallments[newInstallments.length - 1].value = parseFloat((newInstallments[newInstallments.length - 1].value + diff).toFixed(2));
    }
    return newInstallments;
  }, [paymentMethods]);

  // --- Handlers ---

  const fetchData = React.useCallback(async (uid?: string) => {
    try {
      setLoading(true);
      if (uid) {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (userSnap.exists()) setUserData(userSnap.data() as UserType);
      }

      const [servicesSnap, saleTypesSnap, deliveryTypesSnap, paymentMethodsSnap, modalitiesSnap, locationsSnap, branchesSnap, limitsSnap, permsSnap, companyBranchesSnap, freightRangesSnap] = await Promise.all([
        getDocs(collection(db, "services")),
        getDocs(query(collection(db, "saleTypes"), orderBy("order"))),
        getDocs(query(collection(db, "deliveryTypes"), orderBy("order"))),
        getDocs(query(collection(db, "paymentMethods"), orderBy("order"))),
        getDocs(collection(db, "productModalities")),
        getDocs(collection(db, "stockingLocations")),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "discountLimits")),
        getDoc(doc(db, "settings", "salesPermissions")),
        getDocs(collection(db, "companyBranches")),
        getDocs(collection(db, "freightCepRanges")),
        getDoc(doc(db, "deliveryLimits", "config")),
      ]);

      setServices(servicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
      setSaleTypes(saleTypesSnap.docs.map(d => ({ id: d.id, ...d.data() } as SaleType)));
      setDeliveryTypes(deliveryTypesSnap.docs.map(d => ({ id: d.id, ...d.data() } as DeliveryType)));
      setPaymentMethods(paymentMethodsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod)));
      setProductModalities(modalitiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductModality)));
      setStockingLocations(locationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockingLocation)));
      setBranches(branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
      setDiscountLimits(limitsSnap.docs.map(d => ({ id: d.id, ...d.data() } as DiscountLimit)));
      setCompanyBranches(companyBranchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyBranch)));
      setFreightCepRanges(freightRangesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FreightCepRange)));
      
      const lotsSnap = await getDocs(query(collection(db, "lots"), orderBy("lotNumber", "desc"), limit(100)));
      setAllLots(lotsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lot)));
      if (permsSnap.exists()) setPermissions(permsSnap.data() as SalesPermissions);
      
      const configLimitsSnap = await getDoc(doc(db, "deliveryLimits", "config"));
      if (configLimitsSnap.exists()) {
        setDeliveryLimits(configLimitsSnap.data() as Record<string, number | null>);
      }

      // Foi removido o fetch global inseguro de lastOrderNumber aqui. Ele agora é gerado atomicamente por filial no momento do submit.

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    const uid = auth.currentUser?.uid;
    fetchData(uid);
  }, [fetchData]);

  // Logic to load order for editing or duplication
  React.useEffect(() => {
    if ((orderIdToEdit || duplicateId) && !loading) {
      const loadOrder = async () => {
        try {
          const idToLoad = orderIdToEdit || duplicateId;
          const orderDocRef = doc(db, "salesOrders", idToLoad!);
          const orderSnap = await getDoc(orderDocRef);

          if (orderSnap.exists()) {
            const data = orderSnap.data() as SalesOrder;

            setSaleTypeId(data.saleTypeId);
            setDeliveryTypeId(data.deliveryTypeId);
            
            // if it's a duplication, we set delivery date to today or just re-parse
            if (data.deliveryDate) setDeliveryDate(parseISO(data.deliveryDate));

            const customerDocRef = doc(db, "customers", data.customerId);
            const customerSnap = await getDoc(customerDocRef);
            if (customerSnap.exists()) {
              setSelectedCustomer({ id: customerSnap.id, ...customerSnap.data() } as Customer);
              const q = query(collection(db, "customerCredits"), where("customerId", "==", data.customerId), limit(1));
              const snap = await getDocs(q);
              setCustomerCredits(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerCredit)));
            }

            setSelectedDeliveryAddress(data.deliveryAddress || null);
            setSelectedDeliveryPhone(data.deliveryPhone || null);

            // If duplicating, clear stocking locations and reset prices if needed (but user asked for all data)
            // USER ADDENDUM: clear stocking location to force choice
            const preparedItems = (data.items || []).map(item => {
              let baseVal = (item.unitPrice || 0) * (item.quantity || 0);
              let calculatedTotal = 0;
              if (item.discountType === 'percentage') {
                calculatedTotal = baseVal - (baseVal * ((item.discountValue || 0) / 100));
              } else {
                calculatedTotal = baseVal - (item.discountValue || 0);
              }

              return {
                ...item,
                total: calculatedTotal,
                originStockingLocationId: duplicateId ? "" : (item.originStockingLocationId || "")
              };
            });

            setOrderItems(preparedItems.length > 0 ? preparedItems : Array(1).fill(null).map(() => ({
              productId: "", productName: "", quantity: 1, unitPrice: 0, discountType: 'percentage', discountValue: 0, total: 0, originStockingLocationId: "", productModalityId: "", deliveryOption: 'Entregar'
            })));

            // Carregar saldos e dados dos lotes para os itens do pedido
            const uniqueProductIds = Array.from(new Set(preparedItems.map(i => i.productId).filter(Boolean))) as string[];
            const uniqueLotIds = Array.from(new Set(preparedItems.map(i => i.lotId).filter(Boolean))) as string[];

            // Aguarda carregar todos os saldos e lotes necessários
            await Promise.all([
              ...uniqueProductIds.map(pid => fetchLotBalances(pid)),
              (async () => {
                const missingLotIds = uniqueLotIds.filter(id => !allLots.find(l => l.id === id));
                if (missingLotIds.length > 0) {
                  const fetchedLots: Lot[] = [];
                  for (const lid of missingLotIds) {
                    const lSnap = await getDoc(doc(db, "lots", lid));
                    if (lSnap.exists()) {
                      fetchedLots.push({ id: lSnap.id, ...lSnap.data() } as Lot);
                    }
                  }
                  if (fetchedLots.length > 0) {
                    setAllLots(prev => {
                      const existingIds = new Set(prev.map(l => l.id));
                      const uniqueNew = fetchedLots.filter(l => !existingIds.has(l.id));
                      return [...prev, ...uniqueNew];
                    });
                  }
                }
              })()
            ]);
            
            setOrderServices(data.services || []);
            setFreightValue(data.freightValue || 0);
            setGeneralDiscountType(data.generalDiscountType || 'percentage');
            setGeneralDiscountValue(data.generalDiscountValue || 0);
            setObservations(duplicateId ? `[DUPLICADO DO PEDIDO #${data.orderNumber}] ${data.observations || ""}` : (data.observations || ""));
            
            if (duplicateId) {
              setPayments([]);
            } else {
              setPayments(data.payments || []);
            }

          } else {
            toast({ title: "Pedido não encontrado", variant: "destructive" });
          }
        } catch (error) {
          console.error("Error loading order:", error);
          toast({ title: "Erro ao carregar pedido", variant: "destructive" });
        }
      };
      loadOrder();
    }
  }, [orderIdToEdit, duplicateId, loading, toast]);

  // --- Search Logic ---

  React.useEffect(() => {
    const search = async () => {
      const term = customerSearch.trim();
      const normalizedTerm = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (term.length < 3) {
        setFilteredCustomers([]);
        return;
      }
      try {
        const customersRef = collection(db, "customers");
        const cleanTerm = term.replace(/\D/g, '');

        if (cleanTerm.length >= 3 && /^\d+$/.test(cleanTerm)) {
          const qCpf = query(customersRef, where("cpf", ">=", term), where("cpf", "<=", term + "\uf8ff"), limit(10));
          const qCnpj = query(customersRef, where("cnpj", ">=", term), where("cnpj", "<=", term + "\uf8ff"), limit(10));
          const [snapCpf, snapCnpj] = await Promise.all([getDocs(qCpf), getDocs(qCnpj)]);
          if (!snapCpf.empty || !snapCnpj.empty) {
            setFilteredCustomers([...snapCpf.docs, ...snapCnpj.docs].map(d => ({ id: d.id, ...d.data() } as Customer)));
            return;
          }
        }

        const words = normalizedTerm.split(/\s+/).filter(w => w.length >= 2);
        if (words.length === 0) return;

        const firstWord = words[0];
        const capitalizedFirst = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);

        const q1 = query(customersRef, where("name", ">=", firstWord), where("name", "<=", firstWord + "\uf8ff"), limit(50));
        const q2 = query(customersRef, where("name", ">=", capitalizedFirst), where("name", "<=", capitalizedFirst + "\uf8ff"), limit(50));
        const q3 = query(customersRef, where("name", ">=", firstWord.toUpperCase()), where("name", "<=", firstWord.toUpperCase() + "\uf8ff"), limit(50));

        const [s1, s2, s3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
        const resultsMap = new Map<string, Customer>();
        [s1, s2, s3].forEach(s => s.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() } as Customer)));

        const filtered = Array.from(resultsMap.values()).filter(c => {
          const searchStr = `${c.name} ${c.cpf || ""} ${c.cnpj || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return words.every(word => searchStr.includes(word));
        });

        setFilteredCustomers(filtered);
      } catch (e) { console.error(e); }
    };
    const timer = setTimeout(search, 500);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  React.useEffect(() => {
    const search = async () => {
      const term = productSearch.trim();
      const normalizedTerm = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (term.length < 3) {
        setFilteredProducts([]);
        return;
      }
      try {
        const productsRef = collection(db, "products");
        const cleanTerm = term.replace(/\D/g, '');

        if (cleanTerm.length >= 1 && /^\d+$/.test(cleanTerm)) {
          const qCode = query(productsRef, where("internalCode", "==", term), limit(5));
          const qEan = query(productsRef, where("barcode", "==", term), limit(5));
          const [snapCode, snapEan] = await Promise.all([getDocs(qCode), getDocs(qEan)]);
          if (!snapCode.empty || !snapEan.empty) {
            setFilteredProducts([...snapCode.docs, ...snapEan.docs].map(d => ({ id: d.id, ...d.data() } as Product)));
            return;
          }
        }

        const words = normalizedTerm.split(/\s+/).filter(w => w.length >= 2);
        if (words.length === 0) return;

        const firstWord = words[0];
        const capitalizedFirst = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);

        const q1 = query(productsRef, where("name", ">=", firstWord), where("name", "<=", firstWord + "\uf8ff"), limit(100));
        const q2 = query(productsRef, where("name", ">=", capitalizedFirst), where("name", "<=", capitalizedFirst + "\uf8ff"), limit(100));
        const q3 = query(productsRef, where("keywords", "array-contains", firstWord), limit(100));

        const [s1, s2, s3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
        const resultsMap = new Map<string, Product>();
        [s1, s2, s3].forEach(s => s.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() } as Product)));

        const filtered = Array.from(resultsMap.values()).filter(p => {
          const pText = `${p.name} ${p.internalCode || ""} ${p.barcode || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return words.every(word => pText.includes(word));
        });

        setFilteredProducts(filtered);
      } catch (e) { console.error(e); }
    };
    const timer = setTimeout(search, 500);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) {
      setDeliveryDate(undefined);
      return;
    }

    const daysOfWeek = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const dayName = daysOfWeek[date.getDay()];
    const limitForDay = deliveryLimits[dayName];

    if (limitForDay !== undefined && limitForDay !== null) {
      if (limitForDay === 0) {
        setDeliveryLimitAlert({ isOpen: true, date, count: 0, limit: 0, isFull: true });
        return;
      }
      
      setIsSubmitting(true);
      try {
        const start = startOfDay(date).toISOString();
        const end = endOfDay(date).toISOString();
        
        const q = query(
          collection(db, "salesOrders"),
          where("deliveryDate", ">=", start),
          where("deliveryDate", "<=", end)
        );
        const snap = await getDocs(q);
        
        let count = 0;
        snap.forEach(docSnap => {
          const data = docSnap.data();
          if (data.status !== "Cancelado" && data.status !== "Devolvido") {
            count++;
          }
        });

        const isFull = count >= limitForDay;
        
        setDeliveryLimitAlert({
          isOpen: true,
          date,
          count,
          limit: limitForDay,
          isFull
        });

        if (!isFull) {
          setDeliveryDate(date);
        }
      } catch (error) {
        console.error("Erro ao checar limite de entregas:", error);
        toast({ title: "Erro na verificação de limite", variant: "destructive" });
        setDeliveryDate(date); // Fallback to allow if error
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setDeliveryDate(date);
    }
  };

  const selectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch("");
    setFilteredCustomers([]);

    const q = query(collection(db, "customerCredits"), where("customerId", "==", customer.id), limit(1));
    const snap = await getDocs(q);
    setCustomerCredits(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerCredit)));

    setIsAddressModalOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomerData(JSON.parse(JSON.stringify(customer)));
    setIsEditCustomerModalOpen(true);
  };

  const handleCreateNewCustomer = () => {
    const term = customerSearch.trim();
    const isDocument = term.replace(/\D/g, '').length >= 11;

    setEditingCustomerData({
      id: "",
      name: isDocument ? "" : term,
      cpf: isDocument && term.replace(/\D/g, '').length === 11 ? term : "",
      cnpj: isDocument && term.replace(/\D/g, '').length > 11 ? term : "",
      addresses: [],
      phones: []
    } as any);
    setIsEditCustomerModalOpen(true);
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomerData) return;
    setIsSubmitting(true);
    try {
      if (editingCustomerData.id) {
        await updateDoc(doc(db, "customers", editingCustomerData.id), editingCustomerData as any);
        setSelectedCustomer({ ...selectedCustomer, ...editingCustomerData } as Customer);
        toast({ title: "Cliente atualizado!" });
      } else {
        const dataToSave = { ...editingCustomerData };
        delete dataToSave.id;
        const docRef = await addDoc(collection(db, "customers"), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
        const newCustomer = { ...dataToSave, id: docRef.id } as Customer;
        setSelectedCustomer(newCustomer);
        toast({ title: "Cliente cadastrado com sucesso!" });
        setCustomerCredits([]); // new customer has no credits
        if (newCustomer.addresses && newCustomer.addresses.length > 0) {
          setIsAddressModalOpen(true);
        }
      }
      setIsEditCustomerModalOpen(false);
      setCustomerSearch("");
      setFilteredCustomers([]);
    } catch (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); } finally { setIsSubmitting(false); }
  };

  const handleSelectAddress = (address: Address) => {
    setSelectedDeliveryAddress(address);

    if (address.cep) {
      const numericCep = parseInt(address.cep.replace(/\D/g, ''), 10);
      const range = freightCepRanges.find(r => {
        const start = parseInt(r.cepStart.replace(/\D/g, ''), 10);
        const end = parseInt(r.cepEnd.replace(/\D/g, ''), 10);
        return numericCep >= start && numericCep <= end;
      });
      if (range) {
        setFreightValue(range.value);
        toast({
          title: "Frete Aplicado",
          description: `Valor de ${formatCurrency(range.value)} para a região ${range.name}.`
        });
      }
    }

    setIsAddressModalOpen(false);
    setIsPhoneModalOpen(true);
  };

  const handleSelectPhone = (phone: Phone) => {
    setSelectedDeliveryPhone(phone);
    setIsPhoneModalOpen(false);
  };

  const handleAddAddress = () => {
    setEditingCustomerData(prev => ({
      ...prev!,
      addresses: [...(prev!.addresses || []), { ...initialAddress, id: `address-${Date.now()}` }]
    }));
  };

  const handleRemoveAddress = (id: string) => {
    setEditingCustomerData(prev => ({
      ...prev!,
      addresses: (prev!.addresses || []).filter(a => a.id !== id)
    }));
  };

  const handleAddressChange = (id: string, field: keyof Address, value: string) => {
    setEditingCustomerData(prev => ({
      ...prev!,
      addresses: (prev!.addresses || []).map(a => a.id === id ? { ...a, [field]: value } : a)
    }));
  };

  const fetchCepDataForEdit = async (addressId: string) => {
    const address = editingCustomerData?.addresses?.find(a => a.id === addressId);
    if (!address || !address.cep) return;
    const cleanCep = address.cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setIsFetchingCep(addressId);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!response.ok) throw new Error("CEP não encontrado");
      const data = await response.json();
      if (data.erro) throw new Error("CEP não encontrado");

      setEditingCustomerData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          addresses: (prev.addresses || []).map(a => a.id === addressId ? {
            ...a,
            address: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
          } : a)
        };
      });
    } catch (error) {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    } finally {
      setIsFetchingCep(null);
    }
  };

  const handleAddPhone = () => {
    setEditingCustomerData(prev => ({
      ...prev!,
      phones: [...(prev!.phones || []), { id: `phone-${Date.now()}`, type: 'celular', number: '' }]
    }));
  };

  const handleRemovePhone = (id: string) => {
    setEditingCustomerData(prev => ({
      ...prev!,
      phones: (prev!.phones || []).filter(p => p.id !== id)
    }));
  };

  const handlePhoneChange = (id: string, field: 'type' | 'number', value: string) => {
    setEditingCustomerData(prev => ({
      ...prev!,
      phones: (prev!.phones || []).map(p => p.id === id ? { ...p, [field]: value } : p)
    }));
  };
  
  const handleOpenLocationModal = async (index: number, productId: string) => {
    if (!productId) return;
    try {
      const productSnap = await getDoc(doc(db, "products", productId));
      if (productSnap.exists()) {
        const product = { id: productSnap.id, ...productSnap.data() } as Product;
        const q = query(collection(db, "productStock"), where("productId", "==", product.id));
        const snap = await getDocs(q);
        const stocks = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductStock));
        setProductStocks(prev => [...prev.filter(s => s.productId !== product.id), ...stocks]);
        setLocationModal({ isOpen: true, product, itemIndex: index });
      }
    } catch (error) {
      console.error("Error fetching product for location modal:", error);
      toast({ title: "Erro ao buscar produto", variant: "destructive" });
    }
  };

  const [isFetchingBalances, setIsFetchingBalances] = React.useState(false);

  const handleProductSelect = async (index: number, product: Product) => {
    setIsFetchingBalances(true);
    try {
      const q = query(collection(db, "productStock"), where("productId", "==", product.id));
      const snap = await getDocs(q);
      const stocks = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductStock));
      setProductStocks(prev => [...prev.filter(s => s.productId !== product.id), ...stocks]);

      // Buscar saldos por lote para este produto ANTES de abrir o modal para garantir o auto-select
      const balances = await fetchLotBalances(product.id);
      
      setLocationModal({ isOpen: true, product, itemIndex: index });
      setProductSearch("");
      setFilteredProducts([]);
    } catch (error) {
      console.error("Error in handleProductSelect:", error);
      toast({ title: "Erro ao selecionar produto", variant: "destructive" });
    } finally {
      setIsFetchingBalances(false);
    }
  };

  const fetchLotBalances = async (productId: string) => {
    try {
      const q = query(collection(db, "stockMovements"), where("productId", "==", productId));
      const snap = await getDocs(q);
      const balances: Record<string, number> = {};
      const foundLotIds = new Set<string>();
      
      snap.docs.forEach(doc => {
        const m = doc.data() as StockMovement;
        
        // Ignora os movimentos vinculados ao pedido atual sendo editado.
        // Isso devolve virtualmente o saldo ao lote para que o pedido no carrinho possa
        // consumir as mesmas quantidades sem estourar o limite de estoque disponível.
        if (orderIdToEdit && m.relatedDocId === orderIdToEdit) {
            return;
        }

        if (m.lotId) {
          foundLotIds.add(m.lotId);
          if (m.stockingLocationId) {
            // Chave composta para saldo por local: productId_locationId_lotId
            const key = `${m.productId}_${m.stockingLocationId}_${m.lotId}`;
            balances[key] = (balances[key] || 0) + m.quantityChange;
          }
        }
      });

      // Garantir que todos os lotes encontrados estão no estado allLots para exibição correta
      const missingLotIds = Array.from(foundLotIds).filter(id => !allLots.find(l => l.id === id));
      if (missingLotIds.length > 0) {
        const fetchedLots: Lot[] = [];
        for (const lid of missingLotIds) {
          const lSnap = await getDoc(doc(db, "lots", lid));
          if (lSnap.exists()) {
            fetchedLots.push({ id: lSnap.id, ...lSnap.data() } as Lot);
          }
        }
        if (fetchedLots.length > 0) {
          setAllLots(prev => {
            const existingIds = new Set(prev.map(l => l.id));
            const uniqueNew = fetchedLots.filter(l => !existingIds.has(l.id));
            return [...prev, ...uniqueNew];
          });
        }
      }
      
      setLotBalances(prev => ({ ...prev, ...balances }));
      return balances;
    } catch (e) {
      console.error("Erro ao buscar saldos por lote:", e);
      return {};
    }
  };

  const handleLocationSelect = (locationId: string) => {
    const { product, itemIndex } = locationModal;
    if (!product || itemIndex === null) return;

    const location = stockingLocations.find(l => l.id === locationId);
    const stock = productStocks.find(s => s.productId === product.id && s.stockingLocationId === locationId);
    const currentQty = stock?.quantity || 0;

    if (location && location.allowNegativeStock === false && currentQty <= 0) {
      toast({ 
        title: "Estoque insuficiente", 
        description: `O local "${location.name}" não permite estoque negativo e o saldo atual é ${currentQty}. Escolha outro local ou verifique o estoque.`, 
        variant: "destructive" 
      });
      return;
    }

    // Auto-seleção do lote mais antigo com saldo positivo neste local
    const lotsWithBalance = allLots
      .filter(lot => {
        const balanceKey = `${product.id}_${locationId}_${lot.id}`;
        return (lotBalances[balanceKey] || 0) > 0;
      })
      .sort((a, b) => {
        // Ordena do mais antigo para o mais novo por registrationDate
        const dateA = a.registrationDate || '';
        const dateB = b.registrationDate || '';
        return dateA.localeCompare(dateB);
      });

    const autoSelectedLotId = lotsWithBalance.length > 0 ? lotsWithBalance[0].id : undefined;

    setOrderItems(prev => {
      const newItems = [...prev];
      const existingItem = newItems[itemIndex];
      const calculatedTotal = product.salePrice * (existingItem?.quantity || 1);
      newItems[itemIndex] = {
        productId: product.id,
        productName: `[${product.internalCode}] ${product.name}`,
        unitPrice: product.salePrice,
        total: calculatedTotal,
        originStockingLocationId: locationId,
        quantity: existingItem?.quantity || 1,
        discountType: existingItem?.discountType || 'percentage',
        discountValue: existingItem?.discountValue || 0,
        deliveryOption: 'Entregar',
        productModalityId: productModalities[0]?.id || "",
        lotId: autoSelectedLotId || undefined,
      };
      return newItems;
    });
    setLocationModal({ isOpen: false, product: null, itemIndex: null });
  };

  const updateItem = (index: number, field: keyof SalesOrderItem, value: any) => {
    setOrderItems(prev => {
      const newItems = [...prev];
      const updatedItem = { ...newItems[index], [field]: value };
      
      // Validação de Estoque Negativo se a flag estiver desativada no local
      if (field === 'quantity' && updatedItem.productId && updatedItem.originStockingLocationId) {
        const location = stockingLocations.find(l => l.id === updatedItem.originStockingLocationId);
        if (location && location.allowNegativeStock === false) {
          const stock = productStocks.find(s => s.productId === updatedItem.productId && s.stockingLocationId === updatedItem.originStockingLocationId);
          const availableStock = stock?.quantity || 0;
          
          if (value > availableStock) {
            toast({
              title: "Quantidade indisponível",
              description: `O local "${location.name}" possui apenas ${availableStock} em estoque e não permite saldo negativo.`,
              variant: "destructive"
            });
            return prev; // Rejeita a alteração da quantidade
          }
        }
      }

      let baseVal = (updatedItem.unitPrice || 0) * (updatedItem.quantity || 0);
      if (updatedItem.discountType === 'percentage') {
        updatedItem.total = baseVal - (baseVal * ((updatedItem.discountValue || 0) / 100));
      } else {
        updatedItem.total = baseVal - (updatedItem.discountValue || 0);
      }

      // Validação de Saldo por Lote
      if (field === 'quantity' || field === 'lotId') {
          const lotId = field === 'lotId' ? value : updatedItem.lotId;
          const qty = field === 'quantity' ? value : updatedItem.quantity;
          
          if (lotId) {
              const balanceKey = `${updatedItem.productId}_${updatedItem.originStockingLocationId}_${lotId}`;
              const balance = lotBalances[balanceKey] || 0;
              if (qty > balance) {
                  toast({
                      title: "Limite de Lote Excedido",
                      description: `Este lote possui apenas ${balance} unidades disponíveis. A venda não pode ultrapassar a carga original restante.`,
                      variant: "destructive"
                  });
                  return prev;
              }
          }
      }

      newItems[index] = updatedItem;
      return newItems;
    });
  };

  const handleItemCurrencyChange = (index: number, field: 'discountValue') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    updateItem(index, field, rawValue ? parseInt(rawValue, 10) / 100 : 0);
  };

  const handleItemPercentageChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    updateItem(index, 'discountValue', rawValue ? parseFloat(rawValue) / 100 : 0);
  };

  const handleAddNewLine = () => {
    setOrderItems(prev => [...prev, {
      productId: "",
      productName: "",
      quantity: 1,
      unitPrice: 0,
      discountType: 'percentage',
      discountValue: 0,
      total: 0,
      originStockingLocationId: "",
      productModalityId: productModalities[0]?.id || "",
      deliveryOption: 'Entregar'
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(prev => {
      const newItems = [...prev];
      newItems.splice(index, 1);
      if (newItems.length === 0) {
        return Array(1).fill(null).map(() => ({
          productId: "", productName: "", quantity: 1, unitPrice: 0, discountType: 'percentage', discountValue: 0, total: 0, originStockingLocationId: "", productModalityId: productModalities[0]?.id || "", deliveryOption: 'Entregar'
        }));
      }
      return newItems;
    });
  };

  const handleServiceChange = (index: number, serviceId: string) => {
    const s = services.find(sv => sv.id === serviceId);
    if (s) {
      setOrderServices(prev => { 
        const n = [...prev]; 
        const defaultPrice = s.priceType === 'range' ? (s.minPrice || 0) : (s.price || 0);
        n[index] = { serviceId: s.id, serviceName: s.name, price: defaultPrice }; 
        return n; 
      });
    }
  };

  const handleServicePriceChange = (index: number, priceStr: string) => {
    const p = parseFloat(priceStr.replace(/\D/g, '')) / 100;
    setOrderServices(prev => { const n = [...prev]; n[index].price = isNaN(p) ? 0 : p; return n; });
  };

  const handleServicePriceBlur = (index: number) => {
    setOrderServices(prev => {
      const n = [...prev];
      const sItem = n[index];
      const s = services.find(sv => sv.id === sItem.serviceId);
      if (!s) return prev;
      
      let finalPrice = sItem.price;

      if (s.priceType === 'range') {
        const min = s.minPrice || 0;
        const max = s.maxPrice || 0;
        if (finalPrice < min) finalPrice = min;
        if (finalPrice > max) finalPrice = max;
      } else {
        const fixed = s.price || 0;
        if (s.allowDiscount) {
          if (finalPrice > fixed) finalPrice = fixed;
        } else {
          finalPrice = fixed;
        }
      }
      n[index] = { ...sItem, price: finalPrice };
      return n;
    });
  };

  const handleAddService = () => setOrderServices(prev => [...prev, { serviceId: '', serviceName: '', price: 0 }]);
  const handleRemoveService = (index: number) => setOrderServices(prev => prev.filter((_, i) => i !== index));

  const handleAddPayment = () => {
    const currentPayments = payments.reduce((acc, p) => acc + (p.installments?.length > 0 ? p.installments.reduce((sum, inst) => sum + inst.value, 0) : p.value), 0);
    const remaining = total - currentPayments;
    setPayments(prev => [...prev, { id: `payment-${Date.now()}`, paymentMethodId: "", value: remaining > 0 ? remaining : 0, installments: [], numInstallments: 1 }]);
  };

  const handlePaymentUpdate = (id: string, field: keyof SalesOrderPayment, value: any) => {
    setPayments(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, [field]: value };
        if (['paymentMethodId', 'value', 'numInstallments'].includes(field)) {
          updated.installments = calculateInstallments(updated.value, updated.paymentMethodId, updated.numInstallments);
        }
        return updated;
      }
      return p;
    }));
  };

  const handleRemovePayment = (id: string) => setPayments(prev => prev.filter(p => p.id !== id));

  const subtotal = React.useMemo(() => {
    const pTotal = orderItems.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0);
    const sTotal = orderServices.reduce((sum, s) => sum + s.price, 0);
    return pTotal + sTotal;
  }, [orderItems, orderServices]);

  const totalItemDiscounts = React.useMemo(() => orderItems.reduce((sum, i) => {
    const itemTotal = (i.unitPrice || 0) * (i.quantity || 0);
    return sum + (i.discountType === 'percentage' ? (itemTotal * ((i.discountValue || 0) / 100)) : (i.discountValue || 0));
  }, 0), [orderItems]);

  const totalGeneralDiscount = React.useMemo(() => generalDiscountType === 'percentage' ? subtotal * (generalDiscountValue / 100) : generalDiscountValue, [subtotal, generalDiscountValue, generalDiscountType]);
  const totalDiscountAmount = totalItemDiscounts + totalGeneralDiscount;
  const totalDiscountPercentage = subtotal > 0 ? (totalDiscountAmount / subtotal) * 100 : 0;
  const totalInterest = React.useMemo(() => payments.reduce((acc, p) => acc + (p.installments.reduce((sum, inst) => sum + inst.value, 0) - p.value), 0), [payments]);
  const total = React.useMemo(() => subtotal - totalDiscountAmount + freightValue + totalInterest, [subtotal, totalDiscountAmount, freightValue, totalInterest]);

  const totalPayments = React.useMemo(() => payments.reduce((acc, p) => acc + (p.installments?.length > 0 ? p.installments.reduce((sum, inst) => sum + inst.value, 0) : p.value), 0), [payments]);
  const remainingBalance = total - totalPayments;

  const canApplyGeneralDiscount = React.useMemo(() => {
    if (!userData) return false;
    if (userData.isAdmin) return true;
    return permissions.canApplyGeneralDiscount?.roleIds?.includes(userData.roleId) || permissions.canApplyGeneralDiscount?.userIds?.includes(userData.id);
  }, [userData, permissions]);

  const finalizeOrderSubmission = async (status: SalesOrder['status']) => {
    // Verificação de Integridade de Estoque Final
    const invalidStockItems = orderItems.filter(item => {
      if (!item.productId || !item.originStockingLocationId) return false;
      const location = stockingLocations.find(l => l.id === item.originStockingLocationId);
      if (location && location.allowNegativeStock === false) {
        const stock = productStocks.find(s => s.productId === item.productId && s.stockingLocationId === item.originStockingLocationId);
        const availableStock = stock?.quantity || 0;
        return item.quantity > availableStock;
      }
      return false;
    });

    if (invalidStockItems.length > 0) {
      toast({
        title: "Erro de Estoque",
        description: `Existem ${invalidStockItems.length} itens com quantidade superior ao saldo disponível em locais que não permitem estoque negativo. Verifique as quantidades.`,
        variant: "destructive"
      });
      return;
    }

    setShowDiscountAlert(false);
    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
      const orderData: any = {
        status,
        saleTypeId,
        deliveryTypeId,
        deliveryDate: deliveryDate?.toISOString() || null,
        customerId: selectedCustomer!.id,
        customerName: selectedCustomer!.name,
        companyBranchId: userData?.companyBranchId || "",
        deliveryAddress: selectedDeliveryAddress || null,
        deliveryPhone: selectedDeliveryPhone || null,
        items: orderItems.filter(i => i.productId).map(item => {
          const cleanItem = { ...item };
          if (cleanItem.lotId === undefined) delete cleanItem.lotId;
          return cleanItem;
        }),
        services: orderServices,
        subtotal, freightValue, generalDiscountType, generalDiscountValue, total, payments,
        observations: observations || "",
      };

      const stockDeltas: Record<string, { productId: string, locationId: string, lotId?: string, diff: number, valueDiff: number }> = {};
      let oldCreditUsed = 0;

      if (orderIdToEdit) {
        // Recupera o pedido antigo para devolver as quantidades de estoque anteriores
        const oldOrderSnap = await getDoc(doc(db, "salesOrders", orderIdToEdit));
        if (oldOrderSnap.exists()) {
          const oldData = oldOrderSnap.data() as SalesOrder;
          for (const item of (oldData.items || [])) {
             if (item.productId && item.originStockingLocationId) {
                const key = `${item.productId}_${item.originStockingLocationId}_${item.lotId || 'none'}`;
                if (!stockDeltas[key]) stockDeltas[key] = { productId: item.productId, locationId: item.originStockingLocationId, lotId: item.lotId, diff: 0, valueDiff: 0 };
                stockDeltas[key].diff += item.quantity;
                stockDeltas[key].valueDiff -= item.total;
             }
          }
          oldCreditUsed = (oldData.payments || []).filter(p => paymentMethods.find(pm => pm.id === p.paymentMethodId)?.isCustomerCredit).reduce((sum, p) => sum + p.value, 0);
        }
      }

      // Aplica a saída (baixa) para os novos itens do pedido
      for (const item of orderItems.filter(i => i.productId && i.originStockingLocationId)) {
         const locationId = item.originStockingLocationId!;
         const key = `${item.productId}_${locationId}_${item.lotId || 'none'}`;
         if (!stockDeltas[key]) stockDeltas[key] = { productId: item.productId, locationId: locationId, lotId: item.lotId, diff: 0, valueDiff: 0 };
         stockDeltas[key].diff -= item.quantity;
         stockDeltas[key].valueDiff += item.total;
      }

      const newCreditUsed = payments.filter(p => paymentMethods.find(pm => pm.id === p.paymentMethodId)?.isCustomerCredit).reduce((sum, p) => sum + p.value, 0);
      const creditDelta = newCreditUsed - oldCreditUsed;

      let orderRef = orderIdToEdit ? doc(db, "salesOrders", orderIdToEdit) : doc(collection(db, "salesOrders"));
      let finalOrderNumber = orderData.orderNumber;

      if (!orderIdToEdit) {
        const branchKey = userData?.companyBranchId || "global";
        const counterRef = doc(db, "counters", `salesOrder_branch_${branchKey}`);
        
        finalOrderNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextNum = 1;
            if (counterDoc.exists()) {
                nextNum = (counterDoc.data().lastOrderNumber || 0) + 1;
            }
            transaction.set(counterRef, { lastOrderNumber: nextNum }, { merge: true });
            return nextNum;
        });

        orderData.orderNumber = finalOrderNumber;
        orderData.createdByUserId = user!.uid;
        orderData.createdByUserName = userData?.name || "N/A";
        orderData.createdAt = serverTimestamp();
      }

      if (creditDelta !== 0) {
         const creditQuery = query(collection(db, "customerCredits"), where("customerId", "==", selectedCustomer!.id), limit(1));
         const creditSnap = await getDocs(creditQuery);
         if (!creditSnap.empty) {
             const creditDoc = creditSnap.docs[0];
             const currentBalance = creditDoc.data().balance || 0;
             batch.update(creditDoc.ref, { 
                 balance: currentBalance - creditDelta,
                 updatedAt: serverTimestamp() 
             });

             batch.set(doc(collection(db, "customerCreditMovements")), {
                customerId: selectedCustomer!.id,
                type: orderIdToEdit ? 'adjustment' : 'consume',
                amount: creditDelta,
                reason: orderIdToEdit ? `Ajuste na Edição do Pedido #${finalOrderNumber}` : `Utilizado para abater no Pedido #${finalOrderNumber}`,
                relatedDocId: orderRef.id,
                userId: user!.uid,
                userName: userData?.name || "N/A",
                createdAt: serverTimestamp()
             });
         }
      }

      // Executa as baixas de estoque
      for (const key of Object.keys(stockDeltas)) {
        const delta = stockDeltas[key];
        if (delta.diff !== 0) {
            batch.set(doc(collection(db, "stockMovements")), {
              productId: delta.productId,
              stockingLocationId: delta.locationId,
              type: orderIdToEdit
                ? (delta.diff > 0 ? 'edit_reversal' : 'sale')
                : (delta.diff > 0 ? 'return' : 'sale'),
              quantityChange: delta.diff,
              reason: orderIdToEdit ? `Ajuste ou Edição Pedido #${orderIdToEdit}` : `Venda Pedido #${finalOrderNumber}`,
              relatedDocId: orderRef.id,
              lotId: delta.lotId || null,
              valueChange: delta.valueDiff,
              userId: user!.uid,
              userName: userData?.name || "N/A",
              createdAt: serverTimestamp()
            });

            // Busca o documento de estoque correto para atualizar
            const stockQuery = query(
              collection(db, "productStock"), 
              where("productId", "==", delta.productId), 
              where("stockingLocationId", "==", delta.locationId)
            );
            const stockSnap = await getDocs(stockQuery);
            
            if (!stockSnap.empty) {
              const stockRef = stockSnap.docs[0].ref;
              batch.update(stockRef, { quantity: increment(delta.diff) });
            } else if (delta.diff > 0) {
              const newStockRef = doc(collection(db, "productStock"));
              batch.set(newStockRef, {
                productId: delta.productId,
                stockingLocationId: delta.locationId,
                quantity: delta.diff
              });
            }
        }
      }

      if (orderIdToEdit) {
        batch.update(orderRef, orderData);
        await batch.commit();
        toast({ title: "Pedido atualizado e estoque corrigido!" });
      } else {
        batch.set(orderRef, orderData);
        if (status === 'awaiting_approval') {
          batch.set(doc(collection(db, "discountApprovals")), { orderId: orderRef.id, orderNumber: finalOrderNumber, customerName: selectedCustomer!.name, sellerName: userData?.name || "N/A", totalDiscountPercentage, status: 'pending', requestedAt: serverTimestamp() });
        }
        await batch.commit();
        toast({ title: "Pedido finalizado e estoque baixado!" });
      }

      router.push('/dashboard/sales/history');
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  const handleSubmitOrder = () => {
    if (!selectedCustomer || !saleTypeId || !deliveryTypeId || !deliveryDate || orderItems.filter(i => i.productId).length === 0) {
      toast({ title: "Dados incompletos", description: "Verifique os passos 1, 2 e 3.", variant: "destructive" });
      return;
    }

    if (orderItems.some(i => i.productId && !i.originStockingLocationId)) {
      toast({ title: "Local de Estoque Ausente", description: "Todos os produtos devem ter um local de estocagem selecionado.", variant: "destructive" });
      return;
    }

    if (payments.length === 0) {
      toast({ title: "Pagamento Pendente", description: "É necessário adicionar pelo menos uma forma de pagamento no passo 5.", variant: "destructive" });
      return;
    }

    if (payments.some(p => !p.paymentMethodId)) {
      toast({ title: "Forma de Pagamento Inválida", description: "Selecione a forma de pagamento para todas as opções adicionadas no passo 5.", variant: "destructive" });
      return;
    }

    if (Math.abs(remainingBalance) > 0.01) {
      toast({ title: "Valor em Aberto", description: "A soma dos pagamentos deve ser exatamente igual ao total do pedido.", variant: "destructive" });
      return;
    }

    let requiredCredit = 0;
    payments.forEach(p => {
      if (paymentMethods.find(pm => pm.id === p.paymentMethodId)?.isCustomerCredit) {
        requiredCredit += p.value;
      }
    });
    
    const availableCredit = customerCredits[0]?.balance || 0;
    if (requiredCredit > 0 && requiredCredit > availableCredit) {
      toast({ title: "Crédito Insuficiente", description: `O valor exigido em crédito (${formatCurrency(requiredCredit)}) excede o saldo do cliente (${formatCurrency(availableCredit)}).`, variant: "destructive" });
      return;
    }
    const limitVal = discountLimits.find(l => l.id === userData?.roleId)?.maxDiscountPercentage || 0;
    if (totalDiscountPercentage > limitVal) {
      setShowDiscountAlert(true);
    } else {
      finalizeOrderSubmission('pending');
    }
  };

  const availableLocationsForModal = React.useMemo(() => {
    if (!locationModal.product || !userData) return [];

    return stockingLocations
      .filter(loc => {
        // Regra 1: Ativo (Obrigatório)
        if (loc.isActive === false) return false;
        
        // Regra 2: Funções com Acesso (Prioridade)
        // Se houver funções configuradas, essa é a única regra de permissão.
        const allowedRoleIds = loc.visibleToRoleIds || [];
        if (allowedRoleIds.length > 0) {
            const userRoleId = userData.roleId || "";
            return allowedRoleIds.includes(userRoleId);
        }

        // Regra 3: Visibilidade por Filial (Fallback quando não há funções exclusivas)
        const isSameBranch = loc.branchId === userData.branchId;
        if (isSameBranch) {
          // Se for da mesma filial, respeita isVisibleInOrigin (padrão true se não estiver explicitamente falso)
          return loc.isVisibleInOrigin !== false;
        } else {
          // Se for de outra filial, respeita isVisibleToOtherBranches (padrão false)
          return !!loc.isVisibleToOtherBranches;
        }
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [stockingLocations, userData, locationModal.product]);

  return (
    <div className="space-y-8 pb-24 px-2 md:px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 md:p-8 rounded-3xl shadow-sm border border-border/50">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-primary/10 text-primary rounded-2xl">
            <ShoppingCart className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold font-headline tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {orderIdToEdit ? 'Editar Pedido' : 'Novo Pedido de Venda'}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-muted-foreground text-sm">Preencha as etapas abaixo para registrar a venda.</p>
              {userData && branches.find(b => b.id === userData.branchId)?.name && (
                <Badge variant="secondary" className="shadow-sm">
                  <GitFork className="h-3 w-3 mr-1 text-primary" />
                  {branches.find(b => b.id === userData.branchId)?.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="bg-card rounded-3xl shadow-sm border border-border/50 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/40"></div>
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-md">1</div>
              <h2 className="text-xl font-bold">Informações da Venda</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 bg-muted/20 p-6 rounded-2xl border border-border/50">
              <div className="space-y-3"><Label className="text-muted-foreground font-semibold">Operação de Venda</Label><Select value={saleTypeId} onValueChange={setSaleTypeId}><SelectTrigger className="h-12 rounded-xl bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{saleTypes.map(st => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-3"><Label className="text-muted-foreground font-semibold">Tipo de Entrega</Label><Select value={deliveryTypeId} onValueChange={setDeliveryTypeId}><SelectTrigger className="h-12 rounded-xl bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{deliveryTypes.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-3"><Label className="text-muted-foreground font-semibold">Data da Entrega</Label><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full h-12 rounded-xl justify-start text-left font-normal bg-background hover:bg-background/80", !deliveryDate && "text-muted-foreground")} disabled={isSubmitting}><CalendarIcon className="mr-2 h-4 w-4 text-primary" />{deliveryDate ? format(deliveryDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 shadow-xl rounded-xl border-border/50"><Calendar mode="single" selected={deliveryDate} onSelect={handleDateSelect} initialFocus locale={ptBR} disabled={(date) => date < startOfToday()} /></PopoverContent></Popover></div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-3xl shadow-sm border border-border/50 overflow-visible relative z-10">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 rounded-l-3xl"></div>
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-md">2</div>
              <h2 className="text-xl font-bold">Cliente e Contato</h2>
            </div>
            {selectedCustomer ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-full text-primary"><UserPlus className="h-6 w-6" /></div>
                    <div>
                      <p className="font-bold text-lg">{selectedCustomer.name}</p>
                      <p className="text-sm font-medium text-muted-foreground">{selectedCustomer.cpf || selectedCustomer.cnpj}</p>
                      {customerCredits.length > 0 && (customerCredits[0]?.balance || 0) > 0 && (
                        <div className="mt-2 text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-sm">
                          <DollarSign className="h-3.5 w-3.5" /> Crédito Disponível: {formatCurrency(customerCredits[0]?.balance || 0)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2"><Button variant="secondary" size="sm" className="hover:shadow-sm" onClick={() => handleEditCustomer(selectedCustomer)}><Pencil className="h-4 w-4 mr-2" /> Editar</Button><Button variant="destructive" size="icon" className="hover:bg-destructive/10 hover:text-destructive" onClick={() => setSelectedCustomer(null)}><X className="h-5 w-5" /></Button></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedDeliveryAddress && (
                    <div className="relative text-sm text-muted-foreground p-5 border border-border/60 bg-muted/20 rounded-2xl shadow-sm transition-all hover:shadow-md group">
                      <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-background shadow-sm hover:!bg-primary hover:!text-primary-foreground" onClick={() => setIsAddressModalOpen(true)}><Pencil className="h-4 w-4" /></Button>
                      <p className="font-bold text-foreground mb-3 flex items-center gap-2 text-base"><Home className="h-5 w-5 text-primary" /> Endereço de Entrega</p>
                      <p className="text-base text-foreground/80"><strong>{selectedDeliveryAddress.address}, {selectedDeliveryAddress.number}</strong></p>
                      <p className="mt-1">{selectedDeliveryAddress.neighborhood}</p>
                      <p>{selectedDeliveryAddress.city} - {selectedDeliveryAddress.state}</p>
                    </div>
                  )}
                  {selectedDeliveryPhone && (
                    <div className="relative text-sm text-muted-foreground p-5 border border-border/60 bg-muted/20 rounded-2xl shadow-sm transition-all hover:shadow-md flex flex-col justify-center group">
                      <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-background shadow-sm hover:!bg-primary hover:!text-primary-foreground" onClick={() => setIsPhoneModalOpen(true)}><Pencil className="h-4 w-4" /></Button>
                      <p className="font-bold text-foreground mb-3 flex items-center gap-2 text-base"><PhoneIcon className="h-5 w-5 text-primary" /> Telefone para Contato</p>
                      <div className="flex items-center gap-3"><p className="text-2xl font-bold text-foreground/90 tracking-tight">{formatPhone(selectedDeliveryPhone.number)}</p><Badge variant="outline" className="text-xs uppercase">{selectedDeliveryPhone.type}</Badge></div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative group max-w-2xl">
                <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none transition-colors group-focus-within:text-primary">
                  <Search className="h-6 w-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input placeholder="Digite o nome ou CPF/CNPJ do cliente..." className="pl-14 py-8 text-lg rounded-2xl border-muted-foreground/30 shadow-inner focus-visible:ring-primary/40 bg-muted/10 transition-colors" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                {filteredCustomers.length > 0 && (
                  <div className="absolute z-20 w-full mt-2 bg-card border border-border/50 rounded-2xl shadow-2xl max-h-72 overflow-y-auto p-2">
                    {filteredCustomers.map(c => <div key={c.id} className="p-4 hover:bg-primary/5 rounded-xl cursor-pointer transition-colors border-b border-border/30 last:border-0 flex justify-between items-center" onClick={() => selectCustomer(c)}><span className="font-semibold">{c.name}</span><span className="text-muted-foreground text-sm">{c.cpf || c.cnpj}</span></div>)}
                  </div>
                )}
                {customerSearch.trim().length > 0 && filteredCustomers.length === 0 && (
                  <div className="absolute z-20 w-full mt-2 bg-card border border-border/50 rounded-2xl shadow-xl p-6 text-center animate-in fade-in slide-in-from-top-2">
                    <p className="text-muted-foreground mb-4 font-medium">Nenhum cliente encontrado com este termo.</p>
                    <Button onClick={handleCreateNewCustomer} className="w-full rounded-xl shadow-md h-12 text-base"><UserPlus className="h-5 w-5 mr-2" /> Cadastrar Novo Cliente</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-3xl shadow-sm border border-border/50 overflow-visible relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/40"></div>
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-md">3</div>
                <h2 className="text-xl font-bold">Produtos</h2>
              </div>
              <div className="relative flex-1 max-w-md group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none transition-colors group-focus-within:text-primary">
                  <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input placeholder="Buscar produto (ex: balcao 120)..." value={productSearch} onChange={e => setProductSearch(e.target.value)} disabled={!selectedCustomer} className="pl-12 py-5 rounded-xl border-muted-foreground/30 shadow-inner focus-visible:ring-primary/40 bg-muted/10" />
                {filteredProducts.length > 0 && (
                  <div className="absolute z-30 w-full mt-2 bg-card border border-border/50 rounded-2xl shadow-2xl max-h-60 overflow-y-auto p-2">
                    {filteredProducts.map(p => <div key={p.id} className="p-3 hover:bg-primary/5 rounded-xl cursor-pointer transition-colors border-b border-border/30 last:border-0" onClick={() => handleProductSelect(orderItems.findIndex(i => !i.productId), p)}><span className="font-bold text-primary/80 mr-2">[{p.internalCode}]</span> {p.name}</div>)}
                  </div>
                )}
              </div>
            </div>
            <div className="bg-muted/10 border border-border/40 rounded-2xl overflow-x-auto shadow-inner">
              <Table className="min-w-[800px]">
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-2/5 font-semibold text-foreground/80">Produto</TableHead>
                    <TableHead className="w-[180px] font-semibold text-foreground/80">Estoque / Lote</TableHead>
                    <TableHead className="w-[150px] font-semibold text-foreground/80">Entrega</TableHead>
                    <TableHead className="w-[150px] font-semibold text-foreground/80">Modalidade</TableHead>
                    <TableHead className="text-center font-semibold text-foreground/80">Qtd.</TableHead>
                    <TableHead className="text-center font-semibold text-foreground/80">Desconto</TableHead>
                    <TableHead className="text-right font-semibold text-foreground/80">Subtotal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item, index) => (
                    <TableRow key={index} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="p-3">
                        <div className="space-y-1">
                          <Input value={item.productName} readOnly placeholder="Selecione um produto..." className="border-none bg-transparent hover:bg-muted/50 focus-visible:ring-0 p-2 h-auto text-sm font-medium" />
                        </div>
                      </TableCell>
                      <TableCell className="p-2">
                        {item.productId && (
                          <>
                            <div className="flex items-center">
                              {item.originStockingLocationId ? (
                                <Badge variant="outline" className="text-[10px] py-1 px-2 h-auto bg-primary/5 text-primary border-primary/20 flex items-center gap-1 cursor-pointer hover:bg-primary/10 transition-colors whitespace-nowrap" onClick={() => handleOpenLocationModal(index, item.productId)}>
                                  <MapPin className="h-3 w-3" /> {stockingLocations.find(l => l.id === item.originStockingLocationId)?.name || 'Local selecionado'}
                                </Badge>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive font-bold flex items-center gap-1 hover:bg-destructive/5 transition-all" onClick={() => handleOpenLocationModal(index, item.productId)}>
                                  <MapPin className="h-3 w-3" /> Escolher Local
                                </Button>
                              )}
                            </div>
                            <div className="mt-2">
                              <Select 
                                value={item.lotId || "none"} 
                                onValueChange={v => updateItem(index, 'lotId', v === "none" ? null : v)}
                              >
                                <SelectTrigger className="h-8 text-[10px] bg-background border-dashed border-primary/30">
                                  <SelectValue placeholder="Selecione o Lote" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sem Lote</SelectItem>
                                  {allLots.map(l => {
                                    const balanceKey = `${item.productId}_${item.originStockingLocationId}_${l.id}`;
                                    const balance = lotBalances[balanceKey] || 0;
                                    const hasStock = balance > 0;
                                    if (!hasStock && item.lotId !== l.id) return null;
                                    return (
                                      <SelectItem key={l.id} value={l.id}>
                                        Lote: {l.lotNumber} ({balance} no local selecionado)
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="p-2"><Select value={item.deliveryOption} onValueChange={v => updateItem(index, 'deliveryOption', v)} disabled={!item.productId}><SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Entregar">Entregar</SelectItem><SelectItem value="Retirado">Retirado</SelectItem></SelectContent></Select></TableCell>
                      <TableCell className="p-2"><Select value={item.productModalityId} onValueChange={v => updateItem(index, 'productModalityId', v)} disabled={!item.productId}><SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger><SelectContent>{productModalities.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></TableCell>
                      <TableCell className="p-2 text-center"><Input type="number" value={item.quantity} onChange={e => updateItem(index, 'quantity', parseInt(e.target.value))} min="1" disabled={!item.productId} className="w-16 h-9 text-center mx-auto bg-background" /></TableCell>
                      <TableCell className="p-2">
                        <div className="flex gap-1 justify-center items-center">
                          <Input
                            type="text"
                            value={item.discountType === 'fixed' ? formatCurrencyForInput(item.discountValue) : formatPercentageForInput(item.discountValue)}
                            onChange={item.discountType === 'fixed' ? handleItemCurrencyChange(index, 'discountValue') : handleItemPercentageChange(index)}
                            className="w-20 h-9 text-center bg-background border-input"
                            disabled={!item.productId}
                          />
                          <Select value={item.discountType} onValueChange={v => updateItem(index, 'discountType', v)} disabled={!item.productId}>
                            <SelectTrigger className="w-16 h-9 bg-background border-input"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="percentage">%</SelectItem><SelectItem value="fixed">R$</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="p-3 text-right font-bold text-primary">{formatCurrency(item.total)}</TableCell>
                      <TableCell className="p-2"><Button variant="ghost" size="icon" className="opacity-40 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all" onClick={() => handleRemoveItem(index)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button variant="secondary" size="sm" className="mt-6 rounded-xl hover:shadow-md transition-shadow" onClick={handleAddNewLine}><PlusCircle className="mr-2 h-4 w-4" />Adicionar Linha em Branco</Button>
          </div>
        </div>

        <div className="bg-card rounded-3xl shadow-sm border border-border/50 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/40"></div>
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-md">4</div>
              <h2 className="text-xl font-bold">Serviços</h2>
            </div>
            <div className="bg-muted/10 border border-border/40 rounded-2xl overflow-hidden shadow-inner">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-foreground/80">Serviço Adicional</TableHead>
                    <TableHead className="w-[180px] font-semibold text-foreground/80">Preço</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderServices.map((service, index) => (
                    <TableRow key={index} className="group hover:bg-muted/30">
                      <TableCell className="p-3">
                        <Select value={service.serviceId} onValueChange={(v) => handleServiceChange(index, v)}>
                          <SelectTrigger className="h-10 bg-background rounded-lg"><SelectValue placeholder="Selecione o serviço..." /></SelectTrigger>
                          <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-3">
                        {(() => {
                           const sConfig = services.find(s => s.id === service.serviceId);
                           const isFixedAndNoDiscount = sConfig?.priceType === 'fixed' && !sConfig?.allowDiscount;
                           return (
                             <Input 
                               type="text" 
                               value={formatCurrencyForInput(service.price)} 
                               onChange={(e) => handleServicePriceChange(index, e.target.value)} 
                               onBlur={() => handleServicePriceBlur(index)}
                               disabled={!service.serviceId || isFixedAndNoDiscount}
                               className="text-right h-10 bg-background rounded-lg font-medium" 
                             />
                           );
                        })()}
                      </TableCell>
                      <TableCell className="p-3 text-center"><Button variant="ghost" size="icon" className="opacity-40 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all" onClick={() => handleRemoveService(index)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {orderServices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Nenhum serviço adicionado. Clique abaixo para incluir.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <Button variant="secondary" size="sm" className="mt-6 rounded-xl hover:shadow-md transition-shadow" onClick={handleAddService}><PlusCircle className="mr-2 h-4 w-4" />Adicionar Serviço</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-card rounded-3xl shadow-sm border border-border/50 overflow-hidden relative flex flex-col">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary/40"></div>
            <div className="p-6 md:p-8 flex-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-md">5</div>
                <h2 className="text-xl font-bold">Pagamento</h2>
              </div>

              <div className="space-y-4">
                {payments.map((p, i) => (
                  <div key={p.id} className="p-4 bg-muted/20 border border-border/50 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3 items-end shadow-sm hover:shadow-md transition-shadow relative group">
                    <Button variant="ghost" size="icon" onClick={() => handleRemovePayment(p.id)} className="absolute -top-3 -right-3 h-8 w-8 bg-background border shadow-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-4 w-4" /></Button>
                    <div className="md:col-span-12 space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Forma de Pag.</Label>
                      <Select value={p.paymentMethodId} onValueChange={v => handlePaymentUpdate(p.id, 'paymentMethodId', v)}>
                        <SelectTrigger className="h-11 bg-background rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>{paymentMethods.map(pm => <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>)}</SelectContent>
                      </Select>
                      {paymentMethods.find(pm => pm.id === p.paymentMethodId)?.isCustomerCredit && (
                        <p className={cn("text-xs font-medium pl-1 mt-1", (customerCredits[0]?.balance || 0) >= p.value ? "text-green-600" : "text-destructive")}>
                          Crédito disponível: {formatCurrency(customerCredits[0]?.balance || 0)}
                        </p>
                      )}
                    </div>
                    <div className="md:col-span-5 space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Valor (R$)</Label>
                      <Input className="h-11 bg-background rounded-xl font-semibold" value={formatCurrencyForInput(p.value)} onChange={e => handlePaymentUpdate(p.id, 'value', parseFloat(e.target.value.replace(/\D/g, '')) / 100 || 0)} />
                    </div>
                    <div className="md:col-span-7 space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Parcelas / Detalhes</Label>
                      <Select value={(p.numInstallments || 1).toString()} onValueChange={v => handlePaymentUpdate(p.id, 'numInstallments', parseInt(v))}>
                        <SelectTrigger className="h-11 bg-background rounded-xl">
                          <SelectValue>
                            {p.installments.length > 1 ? `${p.installments.length}x de ${formatCurrency(p.installments[0]?.value || 0)}` : 'À vista'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {[...Array(paymentMethods.find(m => m.id === p.paymentMethodId)?.installments || 1)].map((_, idx) => {
                            const num = idx + 1;
                            const tempInstallments = calculateInstallments(p.value, p.paymentMethodId, num);
                            const installmentValue = tempInstallments.length > 0 ? tempInstallments[0].value : 0;
                            return (
                              <SelectItem key={num} value={num.toString()}>
                                {num === 1 ? 'À vista' : `${num}x de ${formatCurrency(installmentValue)}`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                {payments.length === 0 && <div className="text-center p-6 border-2 border-dashed border-border/60 rounded-2xl text-muted-foreground text-sm bg-muted/10">Nenhum pagamento registrado.</div>}
                <Button variant="outline" size="sm" onClick={handleAddPayment} className="rounded-xl w-full border-dashed border-2 hover:bg-primary/5 hover:text-primary"><PlusCircle className="mr-2 h-4 w-4" />Adicionar Condição de Pagamento</Button>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-3xl shadow-md border-0 overflow-hidden flex flex-col bg-gradient-to-b from-card to-muted/20">
            <div className="h-2 w-full bg-gradient-to-r from-primary to-primary/60"></div>
            <div className="p-6 md:p-8 flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><DollarSign className="h-6 w-6" /></div>
                <h2 className="text-2xl font-bold">Resumo Financeiro</h2>
              </div>

              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center text-lg p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <span className="text-muted-foreground font-medium">Subtotal dos Itens</span>
                  <span className="font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl hover:bg-muted/50 transition-colors bg-muted/30">
                  <Label className="text-base font-medium">Frete Estimado</Label>
                  <Input type="text" value={formatCurrencyForInput(freightValue)} onChange={(e) => setFreightValue(parseFloat(e.target.value.replace(/\D/g, '')) / 100 || 0)} className="w-32 text-right text-lg font-bold bg-background h-11 border-primary/20 focus-visible:ring-primary/40 rounded-xl" />
                </div>
                {canApplyGeneralDiscount && (
                  <div className="flex justify-between items-center p-3 rounded-xl bg-destructive/5 text-destructive border border-destructive/10">
                    <span className="font-medium text-base flex items-center gap-2">Desconto Geral</span>
                    <div className="flex gap-2 items-center">
                      <Input type="text" value={formatPercentageForInput(generalDiscountValue)} onChange={(e) => setGeneralDiscountValue(parseFloat(e.target.value.replace(/\D/g, '')) / 100 || 0)} className="w-24 text-right bg-background h-11 border-destructive/20 focus-visible:ring-destructive/40 rounded-xl" />
                      <Select value={generalDiscountType} onValueChange={(v) => setGeneralDiscountType(v as any)}>
                        <SelectTrigger className="w-20 h-11 bg-background border-destructive/20 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="percentage">%</SelectItem><SelectItem value="fixed">R$</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="my-6 border-t border-border/80 border-dashed"></div>
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total a Pagar</span>
                    <div className="text-4xl font-black tracking-tight text-primary mt-1">{formatCurrency(total)}</div>
                  </div>
                </div>

                {Math.abs(remainingBalance) > 0.01 && (
                  <div className={cn(
                    "p-4 rounded-2xl flex justify-between items-center text-sm font-bold animate-in fade-in slide-in-from-top-2 shadow-inner mt-4",
                    remainingBalance > 0 ? "bg-red-50 text-red-700 border border-red-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                  )}>
                    <span className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> {remainingBalance > 0 ? "Falta pagar:" : "Valor Excedente Pagamento:"}</span>
                    <span className="text-lg">{formatCurrency(Math.abs(remainingBalance))}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-card rounded-3xl shadow-sm border border-border/50 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary/40"></div>
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-md">6</div>
                <h2 className="text-xl font-bold">Observações Finais</h2>
              </div>
              <Textarea placeholder="Adicione instruções de entrega especiais, dados de montagem ou observações para o cliente..." className="min-h-[120px] rounded-2xl bg-muted/20 border-border/60 focus-visible:ring-primary/40 text-base p-4 shadow-inner" value={observations} onChange={(e) => setObservations(e.target.value)} />

              <div className="mt-8 flex justify-end">
                <Button className="w-full md:w-auto h-14 px-10 text-lg rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all bg-gradient-to-r from-primary to-primary/80 text-primary-foreground" size="lg" onClick={handleSubmitOrder} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <CheckCircle className="mr-3 h-6 w-6" />}
                  {orderIdToEdit ? 'Atualizar Pedido' : 'Finalizar Venda'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={locationModal.isOpen} onOpenChange={() => setLocationModal({ isOpen: false, product: null, itemIndex: null })}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 border-0 shadow-2xl overflow-hidden gap-0">
          <div className="h-2 w-full bg-gradient-to-r from-primary to-primary/60"></div>
          <DialogHeader className="p-6 pb-4 bg-muted/20 border-b border-border/50"><DialogTitle className="text-xl">Selecione o Local de Estoque</DialogTitle></DialogHeader>
          <div className="p-6 space-y-3">
            {availableLocationsForModal.map(l => (
              <Button key={l.id} variant="outline" className="w-full justify-between h-auto p-4 rounded-xl border-border/60 hover:bg-primary/5 hover:text-primary transition-colors text-base" onClick={() => handleLocationSelect(l.id)}>
                <span className="font-semibold">{l.name}</span>
                <Badge variant="secondary" className="px-3 py-1 text-sm shadow-sm">{productStocks.find(s => s.productId === locationModal.product?.id && s.stockingLocationId === l.id)?.quantity || 0} unid.</Badge>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDiscountAlert} onOpenChange={setShowDiscountAlert}>
        <AlertDialogContent className="rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="h-2 w-full bg-destructive"></div>
          <div className="p-6">
            <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="h-5 w-5" /> Desconto Acima do Limite</AlertDialogTitle><AlertDialogDescription className="text-base mt-2">O desconto de <strong className="text-foreground">{totalDiscountPercentage.toFixed(2)}%</strong> exige aprovação gerencial. Deseja enviar este pedido para aprovação?</AlertDialogDescription></AlertDialogHeader>
          </div>
          <AlertDialogFooter className="p-6 bg-muted/20 border-t border-border/50"><AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel><AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => finalizeOrderSubmission('awaiting_approval')}>Enviar para Aprovação</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-0 shadow-2xl gap-0">
          <div className="h-2 w-full bg-gradient-to-r from-primary to-primary/60"></div>
          <DialogHeader className="p-6 pb-4 bg-muted/20 border-b border-border/50"><DialogTitle className="text-xl">Endereço de Entrega</DialogTitle><DialogDescription>Selecione um dos endereços cadastrados do cliente para esta entrega.</DialogDescription></DialogHeader>
          <div className="grid gap-4 p-6 bg-background max-h-[60vh] overflow-y-auto">{selectedCustomer?.addresses.map(addr => (<Button key={addr.id} variant={selectedDeliveryAddress?.id === addr.id ? "default" : "outline"} className={cn("justify-start h-auto p-5 flex flex-col items-start gap-2 rounded-2xl transition-all", selectedDeliveryAddress?.id === addr.id ? "border-primary shadow-md" : "border-border/60 hover:border-primary/40 hover:bg-muted/30")} onClick={() => handleSelectAddress(addr)}><div className="font-bold text-base flex items-center gap-2"><Home className="h-4 w-4" /> {addr.address}, {addr.number}</div><div className="text-sm opacity-80 pl-6">{addr.neighborhood}, {addr.city} - {addr.state}</div></Button>))}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPhoneModalOpen} onOpenChange={setIsPhoneModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-0 shadow-2xl gap-0">
          <div className="h-2 w-full bg-gradient-to-r from-primary to-primary/60"></div>
          <DialogHeader className="p-6 pb-4 bg-muted/20 border-b border-border/50"><DialogTitle className="text-xl">Telefone de Contato</DialogTitle><DialogDescription>Selecione o número para contato sobre a entrega.</DialogDescription></DialogHeader>
          <div className="grid gap-4 p-6 bg-background">{selectedCustomer?.phones.map(p => (<Button key={p.id} variant={selectedDeliveryPhone?.id === p.id ? "default" : "outline"} className={cn("justify-between h-auto p-5 rounded-2xl transition-all", selectedDeliveryPhone?.id === p.id ? "shadow-md" : "border-border/60 hover:border-primary/40 hover:bg-muted/30")} onClick={() => handleSelectPhone(p)}><span className="text-lg font-bold tracking-tight flex items-center gap-2"><PhoneIcon className="h-4 w-4" /> {formatPhone(p.number)}</span><Badge variant={selectedDeliveryPhone?.id === p.id ? "secondary" : "outline"} className="uppercase text-xs">{p.type}</Badge></Button>))}</div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deliveryLimitAlert.isOpen} onOpenChange={(open) => !open && setDeliveryLimitAlert(prev => ({...prev, isOpen: false}))}>
        <AlertDialogContent className="rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className={cn("h-2 w-full", deliveryLimitAlert.isFull ? "bg-destructive" : "bg-green-600")}></div>
          <div className="p-6">
            <AlertDialogHeader>
              <AlertDialogTitle className={cn("flex items-center gap-2", deliveryLimitAlert.isFull ? "text-destructive" : "text-green-600")}>
                {deliveryLimitAlert.isFull ? <ShieldAlert className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                {deliveryLimitAlert.isFull ? "Limite de Entregas Atingido!" : "Capacidade Verificada"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base mt-4 space-y-3">
                <p>
                  Data selecionada: <strong>{deliveryLimitAlert.date ? format(deliveryLimitAlert.date, "dd/MM/yyyy") : ""}</strong>
                </p>
                {deliveryLimitAlert.limit === 0 ? (
                  <p>As entregas estão <strong>bloqueadas</strong> para este dia da semana.</p>
                ) : (
                  <>
                    <p>Já existem <strong>{deliveryLimitAlert.count}</strong> entregas agendadas.</p>
                    <p>O limite para este dia da semana é de <strong>{deliveryLimitAlert.limit}</strong> entregas.</p>
                    {!deliveryLimitAlert.isFull && (
                      <p className="text-green-600 bg-green-600/10 p-3 rounded-xl font-medium mt-4">
                        Restam {deliveryLimitAlert.limit - deliveryLimitAlert.count} vagas para este dia. A data foi selecionada.
                      </p>
                    )}
                    {deliveryLimitAlert.isFull && (
                      <p className="text-destructive bg-destructive/10 p-3 rounded-xl font-medium mt-4">
                        Este dia atingiu seu limite máximo cadastrado. A data não pode ser selecionada.
                      </p>
                    )}
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="p-6 bg-muted/20 border-t border-border/50">
            <AlertDialogAction className="rounded-xl w-full sm:w-auto" onClick={() => setDeliveryLimitAlert(prev => ({...prev, isOpen: false}))}>
              {deliveryLimitAlert.isFull ? "Entendi" : "Continuar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Dialog open={isEditCustomerModalOpen} onOpenChange={setIsEditCustomerModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0 border-0 rounded-3xl shadow-2xl flex flex-col gap-0">
          <div className="h-2 w-full bg-gradient-to-r from-primary to-primary/60 shrink-0"></div>
          <DialogHeader className="p-6 shrink-0 bg-muted/20 border-b border-border/50"><DialogTitle className="text-2xl font-bold flex items-center gap-2"><UserPlus className="h-6 w-6 text-primary" />{editingCustomerData?.id ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle></DialogHeader>

          <div className="overflow-y-auto p-6 flex-1 bg-background">
            {editingCustomerData && (
              <div className="grid gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-3 md:col-span-2"><Label className="font-semibold text-muted-foreground">Nome Completo</Label><Input className="h-12 text-lg rounded-xl bg-muted/10" value={editingCustomerData.name || ''} onChange={e => setEditingCustomerData({ ...editingCustomerData, name: e.target.value })} /></div>
                  <div className="space-y-3"><Label className="font-semibold text-muted-foreground">CPF / CNPJ</Label><Input className="h-12 text-lg rounded-xl bg-muted/10" placeholder="Apenas números..." value={editingCustomerData.cpf || editingCustomerData.cnpj || ''} onChange={e => { const val = e.target.value; const isCnpj = val.replace(/\D/g, '').length > 11; setEditingCustomerData({ ...editingCustomerData, cpf: isCnpj ? '' : val, cnpj: isCnpj ? val : '' }); }} /></div>
                  <div className="space-y-3"><Label className="font-semibold text-muted-foreground">Data de Nasc.</Label><Input type="date" className="h-12 text-lg rounded-xl bg-muted/10" value={editingCustomerData.birthDate || ''} onChange={e => setEditingCustomerData({ ...editingCustomerData, birthDate: e.target.value })} /></div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center"><Label className="text-lg font-bold flex items-center gap-2"><Home className="h-5 w-5 text-primary" /> Endereços</Label><Button size="sm" variant="outline" className="rounded-xl hover:bg-primary/5 hover:text-primary" onClick={handleAddAddress}><Plus className="h-4 w-4 mr-1" /> Adicionar Novo Endereço</Button></div>
                  <div className="space-y-4">
                    {editingCustomerData.addresses?.map((addr, idx) => (
                      <div key={addr.id} className="p-5 border border-border/60 bg-muted/5 rounded-2xl relative shadow-sm group transition-shadow hover:shadow-md">
                        <Button variant="ghost" size="icon" className="absolute top-3 right-3 text-destructive opacity-50 hover:opacity-100 hover:bg-destructive/10" onClick={() => handleRemoveAddress(addr.id)}><Trash2 className="h-5 w-5" /></Button>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pr-10">
                          <div className="flex items-end gap-2">
                            <div className="flex-1 space-y-2">
                              <Label className="text-xs font-semibold text-muted-foreground">CEP</Label>
                              <Input placeholder="00000-000" className="bg-background rounded-xl" value={addr.cep || ''} onChange={e => handleAddressChange(addr.id, 'cep', e.target.value)} />
                            </div>
                            <Button onClick={() => fetchCepDataForEdit(addr.id)} disabled={isFetchingCep === addr.id} size="icon" className="rounded-xl shrink-0 h-10 w-10">
                              {isFetchingCep === addr.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground">Logradouro (Rua, Av.)</Label>
                            <Input placeholder="Rua das Flores..." className="bg-background rounded-xl" value={addr.address || ''} onChange={e => handleAddressChange(addr.id, 'address', e.target.value)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-2"><Label className="text-xs font-semibold text-muted-foreground">Número</Label><Input placeholder="Nº 123" className="bg-background rounded-xl" value={addr.number || ''} onChange={e => handleAddressChange(addr.id, 'number', e.target.value)} /></div>
                          <div className="space-y-2"><Label className="text-xs font-semibold text-muted-foreground">Complemento</Label><Input placeholder="Apto, Sala..." className="bg-background rounded-xl" value={addr.complement || ''} onChange={e => handleAddressChange(addr.id, 'complement', e.target.value)} /></div>
                          <div className="space-y-2"><Label className="text-xs font-semibold text-muted-foreground">Bairro</Label><Input placeholder="Bairro" className="bg-background rounded-xl" value={addr.neighborhood || ''} onChange={e => handleAddressChange(addr.id, 'neighborhood', e.target.value)} /></div>
                          <div className="flex gap-4">
                            <div className="space-y-2 flex-1"><Label className="text-xs font-semibold text-muted-foreground">Cidade</Label><Input placeholder="Cidade" className="bg-background rounded-xl" value={addr.city || ''} onChange={e => handleAddressChange(addr.id, 'city', e.target.value)} /></div>
                            <div className="space-y-2 w-20"><Label className="text-xs font-semibold text-muted-foreground">UF</Label><Input placeholder="UF" className="bg-background rounded-xl uppercase text-center" value={addr.state || ''} onChange={e => handleAddressChange(addr.id, 'state', e.target.value)} maxLength={2} /></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center"><Label className="text-lg font-bold flex items-center gap-2"><PhoneIcon className="h-5 w-5 text-primary" /> Telefones</Label><Button size="sm" variant="outline" className="rounded-xl hover:bg-primary/5 hover:text-primary" onClick={handleAddPhone}><Plus className="h-4 w-4 mr-1" /> Adicionar Telefone</Button></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {editingCustomerData.phones?.map(p => (
                      <div key={p.id} className="flex gap-3 items-center p-3 border border-border/60 bg-muted/5 rounded-2xl">
                        <Select value={p.type} onValueChange={v => handlePhoneChange(p.id, 'type', v as any)}><SelectTrigger className="w-28 h-11 rounded-xl bg-background border-border/60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="celular">Celular</SelectItem><SelectItem value="fixo">Fixo</SelectItem></SelectContent></Select>
                        <Input className="flex-1 h-11 rounded-xl bg-background border-border/60 font-semibold" value={p.number} onChange={e => handlePhoneChange(p.id, 'number', e.target.value)} placeholder="(DD) 90000-0000" />
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 shrink-0" onClick={() => handleRemovePhone(p.id)}><X className="h-5 w-5" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-muted/20 border-t border-border/50 shrink-0 sm:justify-between items-center">
            <Button variant="ghost" className="rounded-xl text-muted-foreground hover:text-foreground" onClick={() => setIsEditCustomerModalOpen(false)}>Cancelar Edição</Button>
            <Button className="rounded-xl h-12 px-8 shadow-md" onClick={handleUpdateCustomer} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />} Salvar Alterações e Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
