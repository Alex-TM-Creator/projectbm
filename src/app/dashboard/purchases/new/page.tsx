
"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  Search,
  ShoppingCart,
  Plus,
  Trash2,
  Send,
  FileUp,
  FileText,
  Truck,
  Package,
  FilePlus,
  KeyRound,
  History,
  X,
  FileCheck,
  Calculator,
  Minus,
  AlertCircle,
  Calendar,
  Check,
  ChevronsUpDown,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  writeBatch,
  where,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type {
  Product,
  Branch,
  Supplier,
  User,
  StockingLocation,
  PurchaseOrderItem,
  Lot,
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
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface NfeInstallment {
  number: string;
  dueDate: string;
  value: number;
}

export interface UIItem extends PurchaseOrderItem {
  isRegistered: boolean;
  nfeInternalCode?: string;
  nfeProductName?: string;
}

export default function NewPurchasePage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [searchResults, setSearchResults] = React.useState<Product[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = React.useState("");
  const [supplierSearch, setSupplierSearch] = React.useState("");
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = React.useState(false);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [stockingLocations, setStockingLocations] = React.useState<StockingLocation[]>([]);

  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("");
  const [selectedLocationId, setSelectedLocationId] = React.useState<string>("");
  const [requestItems, setRequestItems] = React.useState<UIItem[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [nfeKey, setNfeKey] = React.useState("");
  const [isFetchingNfeKey, setIsFetchingNfeKey] = React.useState(false);
  
  const [nfeInstallments, setNfeInstallments] = React.useState<NfeInstallment[]>([]);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = React.useState(false);
  const [productToRegister, setProductToRegister] = React.useState<UIItem | null>(null);
  
  const [sefazManifest, setSefazManifest] = React.useState<string>("");
  const [isManifesting, setIsManifesting] = React.useState(false);
  const [lots, setLots] = React.useState<Lot[]>([]);
  const [selectedLotId, setSelectedLotId] = React.useState<string>("");
  
  const nfeInputRef = React.useRef<HTMLInputElement>(null);

  const fetchData = React.useCallback(async (uid?: string) => {
    try {
      setLoading(true);
      const [suppliersSnap, branchesSnap, locationsSnap, lotsSnap] = await Promise.all([
        getDocs(query(collection(db, "suppliers"), orderBy("name"))),
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(collection(db, "stockingLocations")),
        getDocs(query(collection(db, "lots"), orderBy("registrationDate", "desc"))),
      ]);
      setSuppliers(suppliersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Supplier)));
      setBranches(branchesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Branch)));
      setStockingLocations(locationsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as StockingLocation)));
      setLots(lotsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Lot)));

      if (uid) {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (userSnap.exists()) {
          setUserData(userSnap.data() as User);
        }
      }
    } catch (error) {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (user?.uid) {
      fetchData(user.uid);
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [fetchData, user, authLoading]);

  React.useEffect(() => {
    if (userData?.branchId) {
      setSelectedBranchId(userData.branchId);
    }
  }, [userData]);

  const filteredLocations = React.useMemo(() => {
    if (!selectedBranchId) return [];
    return stockingLocations.filter((loc) => loc.branchId === selectedBranchId && loc.isActive);
  }, [stockingLocations, selectedBranchId]);

  const filteredSuppliers = React.useMemo(() => {
    if (!supplierSearch) return suppliers;
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      (s.cnpj && s.cnpj.includes(supplierSearch))
    );
  }, [suppliers, supplierSearch]);

  React.useEffect(() => {
    const handleSearch = async () => {
      const term = searchTerm.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!term || term.length < 2) {
          setSearchResults([]);
          return;
      }

      setIsSearching(true);
      try {
        const productsRef = collection(db, "products");
        const searchWords = term.split(/\s+/).filter(w => w.length >= 2);
        const firstWord = searchWords[0];
        const termCapitalized = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
        const termUpper = firstWord.toUpperCase();

        const queries = [
          query(productsRef, where("name", ">=", firstWord), where("name", "<=", firstWord + "\uf8ff"), limit(30)),
          query(productsRef, where("name", ">=", termCapitalized), where("name", "<=", termCapitalized + "\uf8ff"), limit(30)),
          query(productsRef, where("name", ">=", termUpper), where("name", "<=", termUpper + "\uf8ff"), limit(30)),
          query(productsRef, where("keywords", "array-contains", firstWord), limit(30))
        ];

        const snapshots = await Promise.all(queries.map(q => getDocs(q)));
        const foundMap = new Map<string, Product>();
        snapshots.forEach(s => s.docs.forEach(d => foundMap.set(d.id, { id: d.id, ...d.data() } as Product)));

        const finalProducts = Array.from(foundMap.values()).filter(p => {
            const fullText = `${p.name} ${p.internalCode || ""} ${p.barcode || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return searchWords.every(word => fullText.includes(word));
        });

        setSearchResults(finalProducts.sort((a,b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(handleSearch, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleProductSelection = (product: Product) => {
    setRequestItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev;
      } else {
        return [...prev, { 
            productId: product.id, 
            productName: product.name, 
            quantity: 1, 
            costPrice: product.costPrice,
            isRegistered: true 
        }];
      }
    });
    setSearchTerm("");
  };

  const handleItemChange = (productId: string, field: 'quantity' | 'costPrice', value: number) => {
    if (value < 0) return;
    setRequestItems(prev => prev.map(item => (item.productId === productId ? { ...item, [field]: value } : item)));
  };

  const handleRemoveItem = (productId: string) => {
    setRequestItems(prev => prev.filter(item => item.productId !== productId || (!item.isRegistered && item.productId !== productId)));
  };

  const handleLinkProduct = (tempId: string, product: Product) => {
    setRequestItems(prev => prev.map(item => {
        if (item.productId === tempId) {
            return {
                ...item,
                productId: product.id,
                productName: product.name,
                isRegistered: true
            };
        }
        return item;
    }));
    toast({ title: "Produto vinculado com sucesso!" });
  };

  const handleCostPriceKeystroke = (productId: string, rawValue: string) => {
    // Remove tudo que não é número
    const digits = rawValue.replace(/\D/g, '');
    if (!digits) {
      handleItemChange(productId, 'costPrice', 0);
      return;
    }
    // Trata como centavos (divide por 100)
    const cents = parseInt(digits, 10);
    handleItemChange(productId, 'costPrice', cents / 100);
  };
  
  const processNfeData = async (items: any[], supplierCnpj: string, installments: NfeInstallment[] = []) => {
    let supplier = suppliers.find(s => s.cnpj?.replace(/\D/g, '') === supplierCnpj.replace(/\D/g, ''));
    
    if (!supplier && supplierCnpj) {
      toast({ title: "Fornecedor não encontrado", description: "Buscando dados para cadastro automático...", variant: "default" });
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${supplierCnpj.replace(/\D/g, '')}`);
        if (response.ok) {
          const data = await response.json();
          const newSupplier: any = {
            type: 'juridica',
            name: data.razao_social || data.nome_fantasia || "Fornecedor Novo",
            razaoSocial: data.razao_social || "",
            cnpj: supplierCnpj,
            email: data.email || "",
            phones: data.ddd_telefone_1 ? [{ id: Date.now().toString(), type: 'comercial', number: data.ddd_telefone_1 }] : [],
            cep: data.cep || "",
            address: data.logradouro || "",
            number: data.numero || "",
            complement: data.complemento || "",
            neighborhood: data.bairro || "",
            city: data.municipio || "",
            state: data.uf || "",
            isActive: true,
            createdAt: serverTimestamp(),
            branchId: userData?.branchId || "",
            createdById: user?.uid || "",
            createdByName: userData?.name || "",
          };
          const docRef = await addDoc(collection(db, "suppliers"), newSupplier);
          supplier = { id: docRef.id, ...newSupplier } as any;
          setSuppliers(prev => [...prev, supplier!]);
          toast({ title: "Fornecedor cadastrado!", description: supplier!.name });
        }
      } catch (error) {
        console.error("Error fetching supplier data:", error);
      }
    }

    if (supplier) {
      setSelectedSupplierId(supplier.id);
    } else {
      toast({ title: "Fornecedor não encontrado", description: `Não foi possível localizar ou cadastrar o fornecedor com CNPJ ${supplierCnpj}.`, variant: "destructive" });
    }

    const allItems: UIItem[] = [];

    for (const node of items) {
      const internalCode = node.cProd || "";
      const productName = node.xProd || "";
      const quantity = parseFloat(node.qCom || "0");
      const costPrice = parseFloat(node.vUnCom || "0");
      
      const productRef = collection(db, "products");
      const q = query(productRef, where("internalCode", "==", internalCode), limit(1));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
          const product = { id: snap.docs[0].id, ...snap.docs[0].data() } as Product;
          allItems.push({ 
              productId: product.id, 
              productName: product.name, 
              quantity, 
              costPrice,
              isRegistered: true 
          });
      } else {
          // Temporarily use a random UUID for unregistered items
          allItems.push({ 
              productId: `temp-${crypto.randomUUID()}`, 
              productName: productName, 
              quantity, 
              costPrice,
              isRegistered: false,
              nfeInternalCode: internalCode,
              nfeProductName: productName
          });
      }
    }

    if (allItems.length > 0) {
      setRequestItems(prev => {
         const toAdd = allItems.filter(n => !prev.find(p => p.productId === n.productId));
         return [...prev, ...toAdd];
      });
      const registeredCount = allItems.filter(i => i.isRegistered).length;
      const unregisteredCount = allItems.length - registeredCount;
      
      toast({ 
          title: "Nota processada", 
          description: `${allItems.length} produtos carregados. (${registeredCount} identificados, ${unregisteredCount} novos).` 
      });
    }

    setNfeInstallments(installments);
  };

  const handleNfeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const xmlString = e.target?.result as string;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "application/xml");

      const errorNode = xmlDoc.querySelector("parsererror");
      if (errorNode) {
        toast({ title: "Erro ao ler XML", description: "O arquivo selecionado não é um XML válido.", variant: "destructive"});
        return;
      }
      
      const emitNode = xmlDoc.getElementsByTagName("emit")[0];
      const supplierCnpj = emitNode?.getElementsByTagName("CNPJ")[0]?.textContent || "";

      const detNodes = xmlDoc.getElementsByTagName("det");
      const productNodes = Array.from(detNodes).map(node => ({
        cProd: node.getElementsByTagName("cProd")[0]?.textContent,
        xProd: node.getElementsByTagName("xProd")[0]?.textContent,
        qCom: node.getElementsByTagName("qCom")[0]?.textContent,
        vUnCom: node.getElementsByTagName("vUnCom")[0]?.textContent,
      }));

      const dupNodes = xmlDoc.getElementsByTagName("dup");
      const parsedInstallments: NfeInstallment[] = Array.from(dupNodes).map(node => ({
        number: node.getElementsByTagName("nDup")[0]?.textContent || "",
        dueDate: node.getElementsByTagName("dVenc")[0]?.textContent || "",
        value: parseFloat(node.getElementsByTagName("vDup")[0]?.textContent || "0"),
      }));

      processNfeData(productNodes, supplierCnpj, parsedInstallments);
    };
    reader.readAsText(file);
    if(nfeInputRef.current) nfeInputRef.current.value = "";
  };

  const handleSefazManifest = async (type: string) => {
    if (!selectedBranchId) {
      toast({ title: "Selecione uma filial", variant: "destructive" });
      return;
    }
    
    setIsManifesting(true);
    try {
      const q = query(collection(db, "companyBranches"), where("branchId", "==", selectedBranchId), limit(1));
      const snap = await getDocs(q);
      
      if (snap.empty || !snap.docs[0].data().certificateUrl) {
        toast({ 
          title: "Certificado não encontrado", 
          description: "Esta filial não possui certificado digital instalado na aba Empresas Filiais.", 
          variant: "destructive" 
        });
        return;
      }

      // Simulação de manifesto SEFAZ
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSefazManifest(type);
      toast({ title: "Manifestação enviada!", description: `Status: ${type}` });
    } catch (error) {
      toast({ title: "Erro na manifestação", variant: "destructive" });
    } finally {
      setIsManifesting(false);
    }
  };

  const handleNfeKeyFetch = async () => {
    if (!nfeKey || nfeKey.length !== 44 || !/^\d+$/.test(nfeKey)) {
        toast({ title: "Chave de NFe inválida", description: "A chave deve conter 44 dígitos numéricos.", variant: "destructive" });
        return;
    }
    setIsFetchingNfeKey(true);
    try {
        const response = await fetch(`https://brasilapi.com.br/api/nfe/v1/${nfeKey}`);
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        
        const supplierCnpj = data.infNFe?.emit?.CNPJ || "";
        const items = data.infNFe?.det.map((item: any) => item.prod) || [];
        
        let parsedInstallments: NfeInstallment[] = [];
        if (data.infNFe?.cobr?.dup) {
           const dups = Array.isArray(data.infNFe.cobr.dup) ? data.infNFe.cobr.dup : [data.infNFe.cobr.dup];
           parsedInstallments = dups.map((d: any) => ({
             number: d.nDup || "",
             dueDate: d.dVenc || "",
             value: parseFloat(d.vDup || "0")
           }));
        }

        processNfeData(items, supplierCnpj, parsedInstallments);

    } catch (error) {
        console.error(error);
        toast({ title: "Erro ao buscar NFe", description: "Não foi possível obter os dados da nota fiscal. Verifique a chave ou tente mais tarde.", variant: "destructive" });
    } finally {
        setIsFetchingNfeKey(false);
    }
  };


  const handleSubmit = async () => {
    if (!selectedSupplierId || !selectedLocationId || requestItems.length === 0) {
      toast({ title: "Dados incompletos", variant: "destructive" });
      return;
    }
    if (!user || !userData) {
      toast({ title: "Erro de autenticação", variant: "destructive" });
      return;
    }

    if (requestItems.some(i => !i.isRegistered)) {
        toast({ title: "Atenção", description: "Vincule ou cadastre todos os produtos antes de finalizar.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
      const orderRef = doc(collection(db, "purchaseOrders"));
      const totalValue = requestItems.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);

      batch.set(orderRef, {
        supplierId: selectedSupplierId,
        supplierName: suppliers.find(s => s.id === selectedSupplierId)?.name || 'N/A',
        destinationBranchId: selectedBranchId,
        destinationLocationId: selectedLocationId,
        items: requestItems,
        totalValue,
        status: 'completed',
        sefazStatus: sefazManifest || "Pendente",
        lotId: (selectedLotId && selectedLotId !== "none") ? selectedLotId : null,
        createdAt: serverTimestamp(),
        createdByUserId: user.uid,
        createdByUserName: userData.name,
      });

      for (const item of requestItems) {
        const stockQuery = query(
          collection(db, "productStock"),
          where("productId", "==", item.productId),
          where("stockingLocationId", "==", selectedLocationId)
        );
        const stockSnap = await getDocs(stockQuery);

        if (!stockSnap.empty) {
          const stockDoc = stockSnap.docs[0];
          batch.update(stockDoc.ref, { quantity: (stockDoc.data().quantity || 0) + item.quantity });
        } else {
          const newStockRef = doc(collection(db, "productStock"));
          batch.set(newStockRef, {
            productId: item.productId,
            stockingLocationId: selectedLocationId,
            quantity: item.quantity,
          });
        }
        
        const movementRef = doc(collection(db, "stockMovements"));
        batch.set(movementRef, {
            productId: item.productId,
            stockingLocationId: selectedLocationId,
            type: 'purchase',
            quantityChange: item.quantity,
            reason: `Compra - Pedido ${orderRef.id.substring(0,6)}`,
            relatedDocId: orderRef.id,
            lotId: (selectedLotId && selectedLotId !== "none") ? selectedLotId : null,
            createdAt: serverTimestamp(),
            userId: user.uid,
            userName: userData.name,
        });
      }
      
      // Auto-create Contas a Pagar based on NFe installments
      for (const inst of nfeInstallments) {
         if (!inst.dueDate || !inst.value) continue;
         const utilityRef = doc(collection(db, "contas_consumo"));
         batch.set(utilityRef, {
            categoria: "Fornecedor (NF de Compra)",
            valor: inst.value,
            vencimento: new Date(`${inst.dueDate}T12:00:00.000Z`), // To avoid timezone offsets
            referencia: `Duplicata ${inst.number} - Ref. Compra ${orderRef.id.substring(0,6)}`,
            status: "pendente",
            createdAt: serverTimestamp(),
            createdBy: userData.name,
         });
      }
      
      await batch.commit();

      toast({ title: "Compra Lançada com Sucesso!", description: `Pedido ${orderRef.id.slice(0,6)} concluído.${nfeInstallments.length > 0 ? ' e duplicatas registradas no financeiro.' : '.'}` });
      // Reset form
      setSelectedSupplierId("");
      setSelectedBranchId("");
      setSelectedLocationId("");
      setSelectedLotId("");
      setRequestItems([]);
      setSearchTerm("");
      setNfeKey("");

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao lançar compra", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalValue = React.useMemo(() => {
    return requestItems.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);
  }, [requestItems]);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);



  if (loading || authLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-3xl font-bold font-headline flex items-center gap-3">
                <FilePlus className="text-primary" />
                Nova Compra / Lançamento
            </CardTitle>
            <CardDescription className="text-lg">Registre a entrada de produtos e atualize o estoque de forma automatizada.</CardDescription>
          </div>
          <Button variant="outline" className="h-12 border-2 border-primary/20 hover:bg-primary/5 transition-all">
             <History className="mr-2 h-5 w-5" /> Ver Histórico de Notas
          </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna 1: Configuração e Seleção */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-none shadow-md overflow-hidden bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
                <CardTitle className="text-xl flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" /> 
                    1. Informações Logísticas
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="supplier" className="text-sm font-semibold opacity-70 uppercase tracking-wider">Fornecedor da Nota</Label>
                <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isSupplierPopoverOpen}
                      className="w-full justify-between h-11 shadow-sm font-normal"
                      disabled={isSubmitting}
                    >
                      {selectedSupplierId
                        ? suppliers.find((s) => s.id === selectedSupplierId)?.name
                        : "Selecione o fornecedor..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
                        <Input
                          placeholder="Pesquisar por nome ou CNPJ..."
                          value={supplierSearch}
                          onChange={(e) => setSupplierSearch(e.target.value)}
                          className="pl-8 h-9 border-none focus-visible:ring-0"
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-[300px]">
                      <div className="p-1">
                        {filteredSuppliers.length === 0 ? (
                          <div className="p-4 text-sm text-center text-muted-foreground">
                            Nenhum fornecedor encontrado.
                          </div>
                        ) : (
                          filteredSuppliers.map((s) => (
                            <Button
                              key={s.id}
                              variant="ghost"
                              className="w-full justify-start font-normal h-auto py-2.5 px-3"
                              onClick={() => {
                                setSelectedSupplierId(s.id);
                                setIsSupplierPopoverOpen(false);
                                setSupplierSearch("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 text-primary",
                                  selectedSupplierId === s.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col items-start overflow-hidden">
                                <span className="truncate w-full">{s.name}</span>
                                {s.cnpj && <span className="text-[10px] opacity-50">{s.cnpj}</span>}
                              </div>
                            </Button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="branch" className="text-sm font-semibold opacity-70 uppercase tracking-wider">Filial Destino</Label>
                    <Select value={selectedBranchId} onValueChange={(v) => { setSelectedBranchId(v); setSelectedLocationId(""); }} disabled={isSubmitting}>
                      <SelectTrigger id="branch" className="h-11 shadow-sm"><SelectValue placeholder="Filial"/></SelectTrigger>
                      <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-sm font-semibold opacity-70 uppercase tracking-wider">Local Estocagem</Label>
                    <Select value={selectedLocationId} onValueChange={setSelectedLocationId} disabled={isSubmitting || !selectedBranchId}>
                      <SelectTrigger id="location" className="h-11 shadow-sm"><SelectValue placeholder="Setor/Local"/></SelectTrigger>
                      <SelectContent>{filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label className="text-sm font-semibold opacity-70 uppercase tracking-wider">Manifestação SEFAZ</Label>
                <Select value={sefazManifest} onValueChange={handleSefazManifest} disabled={isManifesting || !selectedBranchId}>
                  <SelectTrigger className="h-11 shadow-sm">
                    {isManifesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    <SelectValue placeholder="Manifestar Nota Fiscal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ciência da Operação">Ciência da Operação</SelectItem>
                    <SelectItem value="Confirmação da Operação">Confirmação da Operação</SelectItem>
                    <SelectItem value="Desconhecimento da Operação">Desconhecimento da Operação</SelectItem>
                    <SelectItem value="Operação não Realizada">Operação não Realizada</SelectItem>
                  </SelectContent>
                </Select>
                {sefazManifest && (
                  <Badge variant="outline" className="mt-1 bg-green-50 text-green-700 border-green-200">
                    Manifesto: {sefazManifest}
                  </Badge>
                )}
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="lot" className="text-sm font-semibold opacity-70 uppercase tracking-wider">Vincular a um Lote</Label>
                <Select value={selectedLotId} onValueChange={setSelectedLotId} disabled={isSubmitting}>
                  <SelectTrigger id="lot" className="h-11 shadow-sm border-primary/20">
                    <SelectValue placeholder="Selecione um lote (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum Lote</SelectItem>
                    {lots.map(lot => (
                      <SelectItem key={lot.id} value={lot.id}>
                        {lot.lotNumber} ({lot.registrationDate.split('-').reverse().join('/')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground italic">
                  * Vincular a um lote permite rastrear estes produtos no Relatório de Lotes.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md overflow-hidden bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
             <CardHeader className="bg-primary/5 border-b border-primary/10">
                <CardTitle className="text-xl flex items-center gap-2">
                    <FileUp className="h-5 w-5 text-primary" /> 
                    2. Adicionar Produtos
                </CardTitle>
              </CardHeader>
             <CardContent className="pt-6 space-y-6">
                <div className="space-y-3">
                    <Label htmlFor="nfe-key" className="text-xs font-bold opacity-60">CHAVE DE ACESSO NFE (44 DÍGITOS)</Label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                             <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                            <Input 
                                id="nfe-key"
                                placeholder="0000 0000 0000..."
                                className="h-11 pl-10 border-2 font-mono text-sm tracking-widest focus:border-primary shadow-inner"
                                value={nfeKey}
                                onChange={(e) => setNfeKey(e.target.value.replace(/\D/g, ''))}
                                maxLength={44}
                                disabled={isFetchingNfeKey}
                            />
                        </div>
                        <Button onClick={handleNfeKeyFetch} disabled={isFetchingNfeKey || !nfeKey} className="h-11 px-5 shadow-lg shadow-primary/10 transition-all hover:scale-105 active:scale-95">
                            {isFetchingNfeKey ? <Loader2 className="animate-spin" /> : "BUSCAR"}
                        </Button>
                    </div>
                </div>

                <div className="relative py-4 flex items-center justify-center">
                    <span className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-200 dark:border-zinc-800"></span></span>
                    <span className="relative bg-background px-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">OU SE PREFERIR</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Button asChild variant="outline" className="h-20 border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-primary hover:bg-primary/5 transition-all group flex-col gap-2">
                        <label htmlFor="nfe-xml" className="cursor-pointer">
                            <FileUp className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-[10px] font-bold">IMPORTAR XML</span>
                            <input ref={nfeInputRef} id="nfe-xml" type="file" accept=".xml" className="sr-only" onChange={handleNfeUpload}/>
                        </label>
                    </Button>

                    <div className="relative h-20 px-3 border-2 border-zinc-100 dark:border-zinc-800 rounded-xl flex flex-col justify-center gap-1.5 focus-within:border-primary transition-all shadow-inner">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            <Search className="h-3 w-3" /> Busca Manual
                        </div>
                        <Input 
                            placeholder="Buscar produto..." 
                            className="h-8 border-none bg-transparent p-0 text-sm focus-visible:ring-0 placeholder:opacity-50" 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            disabled={!selectedLocationId || isSubmitting}
                        />
                    </div>
                </div>

                {isSearching ? (
                    <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : searchTerm && (
                    <div className="max-h-60 overflow-y-auto mt-2 p-1 space-y-1 rounded-xl bg-background shadow-inner border border-zinc-100 dark:border-zinc-800">
                        {searchResults.map(product => (
                            <Button 
                                key={product.id} 
                                variant="ghost" 
                                className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-primary/5 rounded-lg border-b border-transparent last:border-0 hover:border-primary/10 transition-all group" 
                                onClick={() => handleProductSelection(product)}
                            >
                                <div className="flex items-center w-full">
                                    <Plus className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                    <div className="flex flex-col flex-1 overflow-hidden">
                                        <span className="font-semibold text-sm truncate">{product.name}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            {product.internalCode && <span className="text-[10px] text-muted-foreground font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 rounded">ID: {product.internalCode}</span>}
                                            <span className="text-[10px] opacity-40">[{product.barcode || 'S/B'}]</span>
                                        </div>
                                    </div>
                                </div>
                            </Button>
                        ))}
                        {searchResults.length === 0 && <p className="text-xs text-center text-muted-foreground p-8 italic opacity-50">Nenhum produto em catálogo para este termo.</p>}
                    </div>
                )}
             </CardContent>
          </Card>

          {nfeInstallments.length > 0 && (
              <Card className="border border-primary/20 bg-primary/5 backdrop-blur-sm">
                 <CardHeader className="pb-3">
                     <CardTitle className="text-lg flex items-center gap-2 text-primary font-bold">
                         <Calendar className="h-5 w-5" />
                         Faturamento NF ({nfeInstallments.length})
                     </CardTitle>
                     <CardDescription>Parcelas detectadas no XML para Contas a Pagar</CardDescription>
                 </CardHeader>
                 <CardContent className="pt-0 max-h-48 overflow-y-auto space-y-2">
                     {nfeInstallments.map((inst, i) => (
                         <div key={i} className="flex justify-between items-center bg-background rounded p-2 text-sm border font-medium">
                            <span className="opacity-70">Dup. {inst.number}</span>
                            <span className="opacity-70">{inst.dueDate.split('-').reverse().join('/')}</span>
                            <span className="text-primary font-black">{formatCurrency(inst.value)}</span>
                         </div>
                     ))}
                 </CardContent>
              </Card>
          )}
        </div>

        {/* Coluna 2: Carrinho de Compras */}
        <div className="lg:col-span-12 xl:col-span-7">
          <Card className="h-full border-none shadow-xl overflow-hidden flex flex-col bg-white dark:bg-zinc-900">
            <CardHeader className="bg-zinc-50 dark:bg-zinc-800/50 border-b p-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary ring-4 ring-primary/5">
                            <ShoppingCart className="h-8 w-8"/>
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold">Itens do Lançamento</CardTitle>
                            <CardDescription className="text-base">
                                {requestItems.length > 0 ? `${requestItems.length} itens prontos para entrar em estoque.` : "Seu lançamento está vazio. Adicione produtos para começar."}
                            </CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col min-h-[400px]">
              {requestItems.length > 0 ? (
                <div className="flex-1 overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 sticky top-0 z-10">
                        <TableRow className="border-none">
                          <TableHead className="pl-8 py-4">Produto</TableHead>
                          <TableHead className="w-36 text-center">Custo Unit.</TableHead>
                          <TableHead className="w-36 text-center">Quantidade</TableHead>
                          <TableHead className="text-right w-40">Subtotal</TableHead>
                          <TableHead className="w-20 pr-8 text-right"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requestItems.map(item => (
                          <TableRow key={item.productId} className="group border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-all">
                            <TableCell className="pl-8 py-6">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-base font-bold", !item.isRegistered ? "text-destructive" : "text-zinc-900 dark:text-zinc-100")}>
                                            {item.productName}
                                        </span>
                                        {!item.isRegistered && (
                                            <Badge variant="destructive" className="text-[9px] h-4 animate-pulse">NÃO CADASTRADO</Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] text-muted-foreground font-mono opacity-60">
                                            {item.isRegistered ? `ID: ${item.productId.slice(0, 8)}` : `NFE COD: ${item.nfeInternalCode}`}
                                        </span>
                                        
                                        {!item.isRegistered && (
                                            <div className="flex gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 border border-primary/20 rounded-md"
                                                    onClick={() => {
                                                        setProductToRegister(item);
                                                        setIsRegisterModalOpen(true);
                                                    }}
                                                >
                                                    <Plus className="h-3 w-3 mr-1" /> CADASTRO RÁPIDO
                                                </Button>
                                                
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-6 px-2 text-[10px] font-bold text-orange-600 hover:bg-orange-50 border border-orange-200 rounded-md"
                                                        >
                                                            <LinkIcon className="h-3 w-3 mr-1" /> VINCULAR PRODUTO
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[350px] p-0" align="start">
                                                        <div className="p-3 bg-zinc-50 border-b">
                                                            <div className="relative">
                                                                <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                                                                <Input 
                                                                    placeholder="Buscar produto para vincular..."
                                                                    className="pl-7 h-8 text-xs"
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setSearchTerm(val);
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <ScrollArea className="h-48">
                                                            <div className="p-1">
                                                                {searchResults.map(p => (
                                                                    <Button 
                                                                        key={p.id}
                                                                        variant="ghost"
                                                                        className="w-full justify-start text-[11px] h-auto py-2"
                                                                        onClick={() => handleLinkProduct(item.productId, p)}
                                                                    >
                                                                        <div className="flex flex-col items-start truncate">
                                                                            <span className="font-bold">{p.name}</span>
                                                                            <span className="text-[9px] opacity-60">ID: {p.internalCode || p.id.slice(0, 8)}</span>
                                                                        </div>
                                                                    </Button>
                                                                ))}
                                                            </div>
                                                        </ScrollArea>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                              <div className="relative group/input">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30 group-focus-within/input:opacity-100 transition-opacity">R$</span>
                                <Input 
                                    type="text" 
                                    value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(item.costPrice)} 
                                    onChange={(e) => handleCostPriceKeystroke(item.productId, e.target.value)} 
                                    className="h-10 w-32 border-2 bg-zinc-50 dark:bg-zinc-800/50 text-right font-black shadow-inner pl-8 pr-3 focus:border-primary transition-all"
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-fit mx-auto shadow-inner">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 shadow-none" onClick={() => handleItemChange(item.productId, 'quantity', Math.max(1, item.quantity - 1))}><Minus className="h-4 w-4"/></Button>
                                <Input 
                                    type="number" 
                                    value={item.quantity} 
                                    onChange={e => handleItemChange(item.productId, 'quantity', parseInt(e.target.value, 10) || 1)} 
                                    className="h-8 w-14 text-center border-none bg-transparent font-black focus-visible:ring-0" 
                                    min="1" 
                                />
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 shadow-none" onClick={() => handleItemChange(item.productId, 'quantity', item.quantity + 1)}><Plus className="h-4 w-4"/></Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-black text-primary text-base">
                                {formatCurrency(item.costPrice * item.quantity)}
                            </TableCell>
                            <TableCell className="pr-8 text-right">
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-10 w-10 rounded-2xl hover:bg-destructive/10 transition-all hover:scale-110" onClick={() => handleRemoveItem(item.productId)}>
                                <X className="h-5 w-5"/>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-20 text-muted-foreground opacity-30 space-y-6">
                    <div className="p-10 rounded-full bg-zinc-100 dark:bg-zinc-800 border-4 border-dashed border-zinc-200 dark:border-zinc-700 animate-pulse">
                        <Package className="h-20 w-20" />
                    </div>
                   <div className="text-center space-y-2">
                        <p className="text-2xl font-black uppercase tracking-tighter">Pedido Vazio</p>
                        <p className="text-sm px-10 italic">Importe uma nota fiscal ou use a busca manual ao lado para preencher este lançamento.</p>
                   </div>
                </div>
              )}
            </CardContent>
              </Card>
            </div>
          </div>
          
      {/* Modal Cadastro Rápido de Produto */}
      <Dialog open={isRegisterModalOpen} onOpenChange={setIsRegisterModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastro Rápido de Produto</DialogTitle>
            <DialogDescription>
               Foi detectado na nota mas não existe no catálogo. Cadastre-o para vinculá-lo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="space-y-2">
                 <Label>Nome do Produto (XML)</Label>
                 <Input value={productToRegister?.productName || ''} onChange={e => setProductToRegister(p => p ? {...p, productName: e.target.value} : p)} />
             </div>
             <div className="space-y-2">
                 <Label>Código NF (Referência)</Label>
                 <Input readOnly value={productToRegister?.nfeInternalCode || ''} className="bg-muted" />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label>Custo Unit. (NF)</Label>
                   <Input readOnly value={productToRegister?.costPrice ? formatCurrency(productToRegister.costPrice) : ''} className="bg-muted text-right" />
                </div>
                 <div className="space-y-2">
                    <Label>Preço de Venda Inicial</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-30">R$</span>
                        <Input 
                            type="text" 
                            id="quick-sell-price" 
                            placeholder="0,00" 
                            className="pl-8 text-right font-bold"
                            onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, '');
                                const val = digits ? (parseInt(digits, 10) / 100) : 0;
                                e.target.value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(val);
                                // Armazenamos o valor bruto no dataset para o clique do botão salvar
                                e.target.dataset.value = val.toString();
                            }}
                        />
                    </div>
                 </div>
             </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsRegisterModalOpen(false)}>Cancelar</Button>
             <Button onClick={async () => {
                 if (!productToRegister) return;
                 const sellInput = document.getElementById('quick-sell-price') as HTMLInputElement;
                 const sellPrice = parseFloat(sellInput?.dataset.value || "0");
                 try {
                     const pd = {
                         name: productToRegister.productName.toUpperCase(),
                         internalCode: productToRegister.nfeInternalCode || "",
                         costPrice: productToRegister.costPrice,
                         sellPrice: sellPrice > 0 ? sellPrice : productToRegister.costPrice,
                         createdAt: serverTimestamp(),
                         isActive: true,
                         categoryId: "",
                         categoryName: "",
                         brandId: "",
                         brandName: "",
                         productType: "product",
                         isKit: false,
                         keywords: []
                     };
                     const docRef = await addDoc(collection(db, "products"), pd);
                     
                     // Atualiza o item na lista (substituindo o temp pelo real)
                     setRequestItems(prev => prev.map(item => {
                         if (item.productId === productToRegister.productId) {
                             return {
                                 ...item,
                                 productId: docRef.id,
                                 productName: pd.name,
                                 isRegistered: true
                             };
                         }
                         return item;
                     }));
                     
                     toast({ title: "Produto cadastrado e vinculado!" });
                     setIsRegisterModalOpen(false);
                 } catch (e) {
                     toast({ title: "Erro ao cadastrar", variant: "destructive" });
                 }
             }}>Salvar e Vincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
