
"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  User as UserIcon,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Send,
  X,
  ArrowRight,
  Package,
  PackageCheck,
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
  limit,
  startAt,
  endAt,
  where,
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
import { Badge } from "@/components/ui/badge";
import type { Product, Branch, TransferOrderItem, User, StockingLocation, ProductStock, Brand, ProductCategory } from "@/lib/definitions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function TransferRequestPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [searchResults, setSearchResults] = React.useState<Product[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [stockingLocations, setStockingLocations] = React.useState<StockingLocation[]>([]);
  const [brands, setBrands] = React.useState<Brand[]>([]);
  const [categories, setCategories] = React.useState<ProductCategory[]>([]);
  const [stockCache, setStockCache] = React.useState<Record<string, number>>({});
  
  const [originBranchId, setOriginBranchId] = React.useState<string>("");
  const [destinationBranchId, setDestinationBranchId] = React.useState<string>("");
  const [selectedBrandId, setSelectedBrandId] = React.useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("all");
  const [requestItems, setRequestItems] = React.useState<TransferOrderItem[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");

  const fetchData = React.useCallback(async (uid: string) => {
    try {
      setLoading(true);
      const [branchesSnap, userSnap, locationsSnap, brandsSnap, categoriesSnap] = await Promise.all([
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDoc(doc(db, "users", uid)),
        getDocs(collection(db, "stockingLocations")),
        getDocs(collection(db, "brands")),
        getDocs(collection(db, "productCategories")),
      ]);
      setBranches(branchesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Branch)));
      setStockingLocations(locationsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as StockingLocation)));
      setBrands(brandsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)).sort((a, b) => a.name.localeCompare(b.name)));
      setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductCategory)).sort((a, b) => a.name.localeCompare(b.name)));
      
      if (userSnap.exists()) {
        const uData = userSnap.data() as User;
        setUserData(uData);
        if (!destinationBranchId) { // Only set if not already set
            setDestinationBranchId(uData.branchId);
        }
      }
    } catch (error) {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, destinationBranchId]);


  React.useEffect(() => {
    if (user?.uid) {
      fetchData(user.uid);
    } else if (!authLoading) {
        // Handle case where there's no user but auth is not loading
        setLoading(false);
    }
  }, [fetchData, user, authLoading]);

  React.useEffect(() => {
    const handleSearch = async () => {
      const term = searchTerm.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const hasFilter = selectedBrandId !== "all" || selectedCategoryId !== "all";
      
      if (!term && !hasFilter) {
          setSearchResults([]);
          return;
      }
      
      if (term.length < 2 && !hasFilter) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const productsRef = collection(db, "products");
        let foundProducts: Product[] = [];

        if (term.length >= 2) {
          const searchWords = term.split(/\s+/).filter(w => w.length >= 2);
          const firstWord = searchWords[0];
          const termCapitalized = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
          const termUpper = firstWord.toUpperCase();

          const queries = [
            query(productsRef, where("name", ">=", firstWord), where("name", "<=", firstWord + "\uf8ff"), limit(50)),
            query(productsRef, where("name", ">=", termCapitalized), where("name", "<=", termCapitalized + "\uf8ff"), limit(50)),
            query(productsRef, where("name", ">=", termUpper), where("name", "<=", termUpper + "\uf8ff"), limit(50)),
            query(productsRef, where("keywords", "array-contains", firstWord), limit(50))
          ];

          const snapshots = await Promise.all(queries.map(q => getDocs(q)));
          const foundProductsMap = new Map<string, Product>();
          
          snapshots.forEach(snap => {
              snap.docs.forEach((docSnap) => {
                  foundProductsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Product);
              });
          });

          foundProducts = Array.from(foundProductsMap.values()).filter(p => {
            const pText = `${p.name} ${p.internalCode || ""} ${p.barcode || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return searchWords.every(word => pText.includes(word));
          });
        } else if (hasFilter) {
          let q;
          if (selectedCategoryId !== "all") {
            q = query(productsRef, where("productCategoryId", "==", selectedCategoryId), limit(100));
          } else {
            q = query(productsRef, where("brandId", "==", selectedBrandId), limit(100));
          }
          const snap = await getDocs(q);
          foundProducts = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Product));
        }

        // Client-side filtering for combined filters
        if (selectedBrandId !== "all") {
          foundProducts = foundProducts.filter(p => p.brandId === selectedBrandId);
        }
        if (selectedCategoryId !== "all") {
          foundProducts = foundProducts.filter(p => p.productCategoryId === selectedCategoryId);
        }

        setSearchResults(foundProducts.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(handleSearch, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedBrandId, selectedCategoryId]);

  const clearSearchFilters = () => {
    setSearchTerm("");
    setSelectedBrandId("all");
    setSelectedCategoryId("all");
  };

  const fetchStockForProductAndBranch = React.useCallback(async (productId: string, branchId: string) => {
    const cacheKey = `${productId}_${branchId}`;
    if (stockCache[cacheKey] !== undefined) return stockCache[cacheKey];

    const locationsForBranch = stockingLocations.filter(loc => loc.branchId === branchId);
    if (locationsForBranch.length === 0) return 0;

    let totalStock = 0;
    try {
      // Since we can have multiple locations per branch, we need to sum them up.
      // Fetch only stocks for THIS product in locations of THIS branch.
      const q = query(
        collection(db, "productStock"),
        where("productId", "==", productId),
        where("stockingLocationId", "in", locationsForBranch.map(l => l.id))
      );
      const snap = await getDocs(q);
      snap.docs.forEach(doc => {
        totalStock += (doc.data() as ProductStock).quantity;
      });

      setStockCache(prev => ({ ...prev, [cacheKey]: totalStock }));
      return totalStock;
    } catch (error) {
      console.error("Error fetching stock:", error);
      return 0;
    }
  }, [stockingLocations, stockCache]);

  const getStockFromCache = (productId: string, branchId: string): number | null => {
    const cacheKey = `${productId}_${branchId}`;
    return stockCache[cacheKey] !== undefined ? stockCache[cacheKey] : null;
  };

  const handleProductSelection = (product: Product) => {
    if (!originBranchId) {
        toast({
            title: "Selecione a Filial de Origem",
            description: "Você precisa escolher uma filial de origem antes de adicionar produtos.",
            variant: "destructive",
        });
        return;
    }
    const originStock = getStockFromCache(product.id, originBranchId);
    
    if (originStock === null) {
      // Need to fetch it first before deciding
      toast({ title: "Carregando estoque...", description: "Aguarde um momento enquanto verificamos o saldo." });
      fetchStockForProductAndBranch(product.id, originBranchId).then(stock => {
        if (stock <= 0) {
          toast({
            title: "Estoque indisponível na origem!",
            description: `O produto "${product.name}" não tem estoque na filial selecionada.`,
            variant: "destructive",
          });
        } else {
           addItemToRequest(product);
        }
      });
      return;
    }

    if (originStock <= 0) {
        toast({
            title: "Estoque indisponível na origem!",
            description: `O produto "${product.name}" não tem estoque na filial selecionada.`,
            variant: "destructive",
        });
        return;
    }

    addItemToRequest(product);
  };

  const addItemToRequest = (product: Product) => {
    setRequestItems((prev) => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        return [...prev, { productId: product.id, productName: product.name, quantity: 1 }];
      }
    });
    // Pre-fetch destination stock to have it ready
    fetchStockForProductAndBranch(product.id, destinationBranchId);
    setSearchTerm("");
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    const originStock = getStockFromCache(productId, originBranchId) || 0;
    if (quantity > originStock) {
        toast({ title: "Quantidade excede o estoque", description: `Apenas ${originStock} unidades disponíveis na origem.`, variant: "destructive"});
        return;
    }
    setRequestItems(prev => prev.map(item => item.productId === productId ? { ...item, quantity } : item));
  };

  const handleRemoveItem = (productId: string) => {
    setRequestItems(prev => prev.filter(item => item.productId !== productId));
  };
  
  const handleSubmit = async () => {
    if (!originBranchId || !destinationBranchId || requestItems.length === 0) {
      toast({ title: "Dados incompletos", description: "Selecione as filiais de origem e destino e adicione produtos.", variant: "destructive"});
      return;
    }
    if (originBranchId === destinationBranchId) {
      toast({ title: "Seleção Inválida", description: "A filial de origem não pode ser a mesma de destino.", variant: "destructive"});
      return;
    }
    if (!user || !userData) {
       toast({ title: "Erro de Autenticação", variant: "destructive"});
       return;
    }

    setIsSubmitting(true);
    try {
        await addDoc(collection(db, "transferOrders"), {
            originBranchId,
            destinationBranchId,
            status: 'pending',
            items: requestItems,
            requesterId: user.uid,
            requesterName: userData.name,
            createdAt: serverTimestamp(),
        });

        toast({ title: "Solicitação Enviada!", description: "Sua solicitação de transferência foi registrada."});
        // Reset form
        setOriginBranchId("");
        // Keep destination branch pre-filled
        // setDestinationBranchId(""); 
        setRequestItems([]);
        setSearchTerm("");

    } catch (error) {
        toast({ title: "Erro ao enviar solicitação", variant: "destructive"});
        console.error(error);
    } finally {
        setIsSubmitting(false);
    }
  }
  
  if (loading || authLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-3xl font-bold font-headline flex items-center gap-3">
                <Send className="text-primary" />
                Solicitar Transferência
            </CardTitle>
            <CardDescription className="text-lg">Mova itens entre filiais com facilidade e controle total.</CardDescription>
          </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna 1: Configuração e Seleção */}
        <div className="lg:col-span-5 space-y-6">
            <Card className="border-none shadow-md overflow-hidden bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <GitFork className="h-5 w-5 text-primary" /> 
                        1. Localização e Fluxo
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="relative flex flex-col gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="origin-branch" className="text-sm font-semibold opacity-70">SAIRÁ DE (ORIGEM)</Label>
                            <Select value={originBranchId} onValueChange={setOriginBranchId} disabled={isSubmitting}>
                                <SelectTrigger id="origin-branch" className="h-12 text-base border-2 focus:border-primary transition-all shadow-sm">
                                    <SelectValue placeholder="Escolher filial de origem"/>
                                </SelectTrigger>
                                <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-center -my-3 relative z-10">
                            <div className="bg-background border-2 border-primary/20 p-2 rounded-full shadow-md">
                                <ArrowRight className="h-4 w-4 text-primary rotate-90 sm:rotate-0" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="destination-branch" className="text-sm font-semibold opacity-70">IRÁ PARA (DESTINO)</Label>
                            <Select value={destinationBranchId} onValueChange={setDestinationBranchId} disabled={isSubmitting || !userData?.isAdmin}>
                                <SelectTrigger id="destination-branch" className="h-12 text-base border-2 border-dashed focus:border-primary transition-all shadow-sm">
                                    <SelectValue placeholder="Escolher filial de destino"/>
                                </SelectTrigger>
                                <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-md overflow-hidden bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" /> 
                        2. Adicionar Produtos
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <div className="space-y-4">
                        <div className="relative">
                            <Input 
                                placeholder="Nome ou código do produto..." 
                                className="h-11 pl-4 bg-background shadow-inner" 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                disabled={!originBranchId || isSubmitting}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                             <Select value={selectedBrandId} onValueChange={setSelectedBrandId} disabled={!originBranchId || isSubmitting}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Marca" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as Marcas</SelectItem>
                                    {brands.map(brand => (
                                        <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId} disabled={!originBranchId || isSubmitting}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as Categorias</SelectItem>
                                    {categories.map(category => (
                                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                         {(searchTerm || selectedBrandId !== "all" || selectedCategoryId !== "all") && (
                            <div className="flex justify-end">
                                <Button variant="ghost" size="sm" onClick={clearSearchFilters} className="text-primary hover:text-primary/80 h-auto py-0 text-xs font-semibold">
                                    <X className="h-3 w-3 mr-1"/> LIMPAR FILTROS
                                </Button>
                            </div>
                        )}
                    </div>

                    {isSearching ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (searchTerm || selectedBrandId !== "all" || selectedCategoryId !== "all") && (
                        <div className="max-h-60 overflow-y-auto mt-2 p-1 space-y-1 rounded-xl bg-background shadow-inner border border-zinc-100 dark:border-zinc-800">
                            {searchResults.map(product => (
                                <Button 
                                    key={product.id} 
                                    variant="ghost" 
                                    className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-primary/5 rounded-lg border-b border-transparent last:border-0 hover:border-primary/10 transition-all group" 
                                    onClick={() => handleProductSelection(product)} 
                                    disabled={!originBranchId}
                                >
                                    <div className="flex items-center w-full">
                                        <Plus className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <div className="flex flex-col flex-1 overflow-hidden">
                                            <span className="font-semibold text-sm truncate">{product.name}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="secondary" className="text-[10px] h-4 py-0 px-1 font-normal opacity-70">
                                                    {brands.find(b => b.id === product.brandId)?.name || 'S/M'}
                                                </Badge>
                                                {product.internalCode && <span className="text-[10px] text-muted-foreground font-mono">[{product.internalCode}]</span>}
                                            </div>
                                        </div>
                                    </div>
                                </Button>
                            ))}
                            {searchResults.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                    <Search className="h-10 w-10 mb-2"/>
                                    <p className="text-xs font-medium">Nenhum produto encontrado.</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Coluna 2: Carrinho de Transferência */}
        <div className="lg:col-span-7">
             <Card className="h-full border-none shadow-lg overflow-hidden flex flex-col bg-white dark:bg-zinc-900">
                <CardHeader className="bg-zinc-50 dark:bg-zinc-800/50 border-b">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <ShoppingCart className="h-6 w-6"/>
                            </div>
                            <div>
                                <CardTitle className="text-xl">Pedido de Transferência</CardTitle>
                                <CardDescription>
                                    {requestItems.length > 0 ? `${requestItems.length} itens prontos para solicitar` : "Seu pedido está vazio"}
                                </CardDescription>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                   {requestItems.length > 0 ? (
                    <div className="flex-1 overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="pl-6">Produto</TableHead>
                                    <TableHead className="text-center w-24">Origem</TableHead>
                                    <TableHead className="text-center w-24">Destino</TableHead>
                                    <TableHead className="w-40">Quantidade</TableHead>
                                    <TableHead className="w-16 pr-6 text-right"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requestItems.map(item => {
                                    const originStock = getStockFromCache(item.productId, originBranchId);
                                    const destStock = getStockFromCache(item.productId, destinationBranchId);
                                    
                                    if (originStock === null) fetchStockForProductAndBranch(item.productId, originBranchId);
                                    if (destStock === null) fetchStockForProductAndBranch(item.productId, destinationBranchId);

                                    return (
                                    <TableRow key={item.productId} className="group border-zinc-100 dark:border-zinc-800">
                                        <TableCell className="pl-6 font-semibold py-4">
                                            <div className="flex flex-col">
                                                <span className="text-zinc-900 dark:text-zinc-100">{item.productName}</span>
                                                <span className="text-xs text-muted-foreground opacity-70">UID: {item.productId.slice(0, 8)}...</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <Badge 
                                                    variant={originStock !== null ? (originStock > 0 ? "outline" : "destructive") : "secondary"}
                                                    className={cn("font-bold text-sm h-8 min-w-10 justify-center", originStock !== null && originStock > 0 && "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800")}
                                                >
                                                    {originStock !== null ? originStock : <Loader2 className="h-3 w-3 animate-spin"/>}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="font-bold text-sm h-8 min-w-10 justify-center opacity-60">
                                                {destStock !== null ? destStock : <Loader2 className="h-3 w-3 animate-spin"/>}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-fit">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 shadow-none" onClick={() => handleQuantityChange(item.productId, item.quantity - 1)}><Minus className="h-3 w-3"/></Button>
                                                <Input 
                                                    type="number" 
                                                    value={item.quantity} 
                                                    className="h-8 w-12 text-center border-none bg-transparent font-bold focus-visible:ring-0" 
                                                    onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value, 10) || 1)}
                                                />
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 shadow-none" onClick={() => handleQuantityChange(item.productId, item.quantity + 1)}><Plus className="h-3 w-3"/></Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-9 w-9 rounded-xl transition-colors" onClick={() => handleRemoveItem(item.productId)}>
                                                <X className="h-4 w-4"/>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )})}
                            </TableBody>
                        </Table>
                    </div>
                   ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground opacity-50 space-y-4">
                        <div className="p-6 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse">
                            <Package className="h-16 w-16" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold">Nenhum item adicionado</p>
                            <p className="text-sm px-10">Use a busca à esquerda para encontrar e adicionar produtos a este pedido.</p>
                        </div>
                    </div>
                   )}
                </CardContent>
                <CardFooter className="bg-zinc-50 dark:bg-zinc-800/30 p-8 pt-6">
                    <Button 
                        className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all group" 
                        disabled={requestItems.length === 0 || isSubmitting} 
                        onClick={handleSubmit}
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-6 w-6 animate-spin mr-3"/>
                        ) : (
                            <PackageCheck className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform"/>
                        )}
                        FINALIZAR SOLICITAÇÃO AGORA
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>
    </div>
  );
}
