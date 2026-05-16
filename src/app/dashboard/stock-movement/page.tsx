
"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  Package,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Send,
  SlidersHorizontal,
  X,
  ArrowDown,
  ArrowRight,
  PackageCheck,
  Truck,
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
  where,
  writeBatch,
  limit,
  startAt,
  endAt,
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

interface TransferItem {
  productId: string;
  productName: string;
  quantity: number;
  availableStock: number;
}

export default function StockMovementPage() {
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
  
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("");
  const [originLocationId, setOriginLocationId] = React.useState<string>("");
  const [destinationLocationId, setDestinationLocationId] = React.useState<string>("");
  const [selectedBrandId, setSelectedBrandId] = React.useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("all");
  const [transferItems, setTransferItems] = React.useState<TransferItem[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");


  const fetchData = React.useCallback(async (uid?: string) => {
    try {
      setLoading(true);
      const [branchesSnap, locationsSnap, brandsSnap, categoriesSnap] = await Promise.all([
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(collection(db, "stockingLocations")),
        getDocs(collection(db, "brands")),
        getDocs(collection(db, "productCategories")),
      ]);
      setBranches(branchesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Branch)));
      setStockingLocations(locationsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as StockingLocation)));
      setBrands(brandsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)).sort((a, b) => a.name.localeCompare(b.name)));
      setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductCategory)).sort((a, b) => a.name.localeCompare(b.name)));

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

  const filteredLocations = React.useMemo(() => {
    if (!selectedBranchId) return [];
    return stockingLocations.filter(loc => loc.branchId === selectedBranchId && loc.isActive);
  }, [stockingLocations, selectedBranchId]);
  
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

  const fetchStockForProductAndLocation = React.useCallback(async (productId: string, locationId: string) => {
    const cacheKey = `${productId}_${locationId}`;
    if (stockCache[cacheKey] !== undefined) return stockCache[cacheKey];

    try {
      const q = query(
        collection(db, "productStock"),
        where("productId", "==", productId),
        where("stockingLocationId", "==", locationId)
      );
      const snap = await getDocs(q);
      let quantity = 0;
      if (!snap.empty) {
        quantity = (snap.docs[0].data() as ProductStock).quantity || 0;
      }
      setStockCache(prev => ({ ...prev, [cacheKey]: quantity }));
      return quantity;
    } catch (error) {
      console.error("Error fetching stock:", error);
      return 0;
    }
  }, [stockCache]);

  const getStockFromCache = (productId: string, locationId: string): number | null => {
    const cacheKey = `${productId}_${locationId}`;
    return stockCache[cacheKey] !== undefined ? stockCache[cacheKey] : null;
  };


  const handleProductSelection = (product: Product) => {
    if (!originLocationId) {
        toast({ title: "Selecione o Local de Origem", variant: "destructive"});
        return;
    }
    const originStock = getStockFromCache(product.id, originLocationId);
    
    if (originStock === null) {
      toast({ title: "Carregando estoque...", description: "Verificando saldo do produto no local selecionado." });
      fetchStockForProductAndLocation(product.id, originLocationId).then(stock => {
         if (stock <= 0) {
            toast({ title: "Estoque indisponível na origem!", variant: "destructive"});
        } else {
            addItemToTransfer(product, stock);
        }
      });
      return;
    }

    if (originStock <= 0) {
        toast({ title: "Estoque indisponível na origem!", variant: "destructive"});
        return;
    }

    addItemToTransfer(product, originStock);
  };

  const addItemToTransfer = (product: Product, availableStock: number) => {
    setTransferItems((prev) => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev;
      } else {
        return [...prev, { productId: product.id, productName: product.name, quantity: 1, availableStock }];
      }
    });
    setSearchTerm("");
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    const item = transferItems.find(i => i.productId === productId);
    if (!item) return;

    if (quantity < 1) return;
    if (quantity > item.availableStock) {
        toast({ title: "Quantidade excede o estoque", description: `Apenas ${item.availableStock} unidades disponíveis na origem.`, variant: "destructive"});
        return;
    }
    setTransferItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity } : i));
  };

  const handleRemoveItem = (productId: string) => {
    setTransferItems(prev => prev.filter(item => item.productId !== productId));
  };
  
  const handleSubmit = async () => {
    if (!originLocationId || !destinationLocationId || transferItems.length === 0) {
      toast({ title: "Dados incompletos", variant: "destructive"});
      return;
    }
    if (originLocationId === destinationLocationId) {
      toast({ title: "Locais inválidos", description: "O local de origem não pode ser o mesmo de destino.", variant: "destructive"});
      return;
    }
    if (!user || !userData) {
       toast({ title: "Erro de Autenticação", variant: "destructive"});
       return;
    }

    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
        for (const item of transferItems) {
            // Decrement from origin
            const originStockQuery = query(collection(db, "productStock"), where("productId", "==", item.productId), where("stockingLocationId", "==", originLocationId));
            const originStockSnap = await getDocs(originStockQuery);
            if (!originStockSnap.empty) {
                const stockDoc = originStockSnap.docs[0];
                batch.update(stockDoc.ref, { quantity: stockDoc.data().quantity - item.quantity });
            }
             batch.set(doc(collection(db, "stockMovements")), { productId: item.productId, stockingLocationId: originLocationId, type: 'transfer', quantityChange: -item.quantity, reason: 'Movimentação Interna - Saída', createdAt: serverTimestamp(), userId: user.uid, userName: userData.name });
            
            // Increment in destination
            const destStockQuery = query(collection(db, "productStock"), where("productId", "==", item.productId), where("stockingLocationId", "==", destinationLocationId));
            const destStockSnap = await getDocs(destStockQuery);
             if (!destStockSnap.empty) {
                const stockDoc = destStockSnap.docs[0];
                batch.update(stockDoc.ref, { quantity: (stockDoc.data().quantity || 0) + item.quantity });
            } else {
                batch.set(doc(collection(db, "productStock")), { productId: item.productId, stockingLocationId: destinationLocationId, quantity: item.quantity });
            }
            batch.set(doc(collection(db, "stockMovements")), { productId: item.productId, stockingLocationId: destinationLocationId, type: 'transfer', quantityChange: item.quantity, reason: 'Movimentação Interna - Entrada', createdAt: serverTimestamp(), userId: user.uid, userName: userData.name });
        }

        await batch.commit();

        toast({ title: "Movimentação Concluída!", description: "O estoque foi atualizado com sucesso."});
        setTransferItems([]);
        setSearchTerm("");
        // Clear stock cache to force refresh on next interaction
        setStockCache({});
        fetchData();

    } catch (error) {
        toast({ title: "Erro ao realizar movimentação", variant: "destructive"});
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
                <SlidersHorizontal className="text-primary" />
                Movimentação Interna
            </CardTitle>
            <CardDescription className="text-lg">Remaneje produtos entre locais de estocagem na mesma filial.</CardDescription>
          </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna 1: Configuração e Seleção */}
        <div className="lg:col-span-5 space-y-6">
            <Card className="border-none shadow-md overflow-hidden bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <GitFork className="h-5 w-5 text-primary" /> 
                        1. Localização do Fluxo
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="branch" className="text-sm font-semibold opacity-70">FILIAL</Label>
                        <Select value={selectedBranchId} onValueChange={setSelectedBranchId} disabled={isSubmitting}>
                            <SelectTrigger id="branch" className="h-11 shadow-sm">
                                <SelectValue placeholder="Escolha a filial"/>
                            </SelectTrigger>
                            <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>

                    <div className="relative flex flex-col gap-2 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="origin-location" className="text-[10px] font-bold tracking-wider opacity-50 uppercase">SAIRÁ DE (ORIGEM)</Label>
                            <Select value={originLocationId} onValueChange={setOriginLocationId} disabled={isSubmitting || !selectedBranchId}>
                                <SelectTrigger id="origin-location" className="h-12 text-base border-2 focus:border-primary transition-all shadow-sm">
                                    <SelectValue placeholder="Selecione o local de origem"/>
                                </SelectTrigger>
                                <SelectContent>{filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-center -my-2 relative z-10">
                            <div className="bg-background border-2 border-primary/20 p-1.5 rounded-full shadow-md">
                                <ArrowDown className="h-3.5 w-3.5 text-primary" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="destination-location" className="text-[10px] font-bold tracking-wider opacity-50 uppercase">IRÁ PARA (DESTINO)</Label>
                            <Select value={destinationLocationId} onValueChange={setDestinationLocationId} disabled={isSubmitting || !selectedBranchId}>
                                <SelectTrigger id="destination-location" className="h-12 text-base border-2 border-dashed focus:border-primary transition-all shadow-sm">
                                    <SelectValue placeholder="Selecione o local de destino"/>
                                </SelectTrigger>
                                <SelectContent>{filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
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
                                disabled={!originLocationId || isSubmitting}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                             <Select value={selectedBrandId} onValueChange={setSelectedBrandId} disabled={!originLocationId || isSubmitting}>
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
                            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId} disabled={!originLocationId || isSubmitting}>
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
                        <div className="max-h-52 overflow-y-auto mt-2 p-1 space-y-1 rounded-xl bg-background shadow-inner border border-zinc-100 dark:border-zinc-800">
                            {searchResults.map(product => (
                                <Button 
                                    key={product.id} 
                                    variant="ghost" 
                                    className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-primary/5 rounded-lg border-b border-transparent last:border-0 hover:border-primary/10 transition-all group" 
                                    onClick={() => handleProductSelection(product)} 
                                    disabled={!originLocationId}
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
                                <div className="flex flex-col items-center justify-center py-10 opacity-30">
                                    <p className="text-xs font-medium italic">Nenhum produto encontrado.</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Coluna 2: Carrinho de Movimentação */}
        <div className="lg:col-span-7">
             <Card className="h-full border-none shadow-lg overflow-hidden flex flex-col bg-white dark:bg-zinc-900">
                <CardHeader className="bg-zinc-50 dark:bg-zinc-800/50 border-b">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                                <ShoppingCart className="h-6 w-6"/>
                            </div>
                            <div>
                                <CardTitle className="text-xl">Lista de Remanejamento</CardTitle>
                                <CardDescription>
                                    {transferItems.length > 0 ? `${transferItems.length} itens prontos para movimentar` : "Selecione produtos para começar"}
                                </CardDescription>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                   {transferItems.length > 0 ? (
                    <div className="flex-1 overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 sticky top-0 z-10">
                                <TableRow className="border-none">
                                    <TableHead className="pl-6">Produto</TableHead>
                                    <TableHead className="text-center w-28">Estoque Atual</TableHead>
                                    <TableHead className="w-40 text-center">Qtde a Mover</TableHead>
                                    <TableHead className="w-16 pr-6 text-right"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transferItems.map(item => (
                                    <TableRow key={item.productId} className="group border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/30 dark:hover:bg-zinc-800/10 transition-colors">
                                        <TableCell className="pl-6 font-semibold py-4">
                                            <div className="flex flex-col">
                                                <span className="text-zinc-900 dark:text-zinc-100">{item.productName}</span>
                                                <span className="text-[10px] text-muted-foreground opacity-70 font-mono">UID: {item.productId.slice(0, 8)}...</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="font-bold text-sm h-8 min-w-12 justify-center text-green-600 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800 shadow-sm">
                                                {getStockFromCache(item.productId, originLocationId) !== null ? getStockFromCache(item.productId, originLocationId) : <Loader2 className="h-3 w-3 animate-spin"/>}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-fit mx-auto shadow-inner">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 shadow-none" onClick={() => handleQuantityChange(item.productId, item.quantity - 1)}><Minus className="h-3.5 w-3.5"/></Button>
                                                <Input 
                                                    type="number" 
                                                    value={item.quantity} 
                                                    className="h-8 w-12 text-center border-none bg-transparent font-bold focus-visible:ring-0" 
                                                    onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value, 10) || 1)}
                                                />
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white dark:hover:bg-zinc-700 shadow-none" onClick={() => handleQuantityChange(item.productId, item.quantity + 1)}><Plus className="h-3.5 w-3.5"/></Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-9 w-9 rounded-xl transition-all hover:scale-110" onClick={() => handleRemoveItem(item.productId)}>
                                                <X className="h-4 w-4"/>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                   ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground opacity-40 space-y-5">
                        <div className="p-8 rounded-full bg-zinc-50 dark:bg-zinc-800/50 border-2 border-dashed border-zinc-200 dark:border-zinc-700 animate-pulse">
                            <Truck className="h-16 w-16" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold">Nenhuma movimentação pendente</p>
                            <p className="text-sm px-10">Selecione o local de origem e adicione os produtos para iniciar o remanejamento.</p>
                        </div>
                    </div>
                   )}
                </CardContent>
                <CardFooter className="bg-zinc-50 dark:bg-zinc-800/30 p-8 pt-6">
                    <Button 
                        className="w-full h-16 rounded-2xl text-lg font-black shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all group overflow-hidden relative" 
                        disabled={transferItems.length === 0 || isSubmitting} 
                        onClick={handleSubmit}
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-6 w-6 animate-spin mr-3"/>
                        ) : (
                            <>
                                <PackageCheck className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform relative z-10"/>
                                <span className="relative z-10 uppercase tracking-wide">Confirmar Remanejamento Agora</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>
    </div>
  );
}
