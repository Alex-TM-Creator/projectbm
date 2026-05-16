
"use client";

import * as React from "react";
import { Loader2, Save, ShoppingCart, GitFork, Plus, Minus, User as UserIcon, Trash2, Search, Building2, Package, Banknote } from "lucide-react";
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, doc, getDoc } from "firebase/firestore";
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
import type { CleaningProduct, Branch, CleaningRequestItem, Company, PriceColumnConfig } from "@/lib/definitions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFoot } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";


export default function CleaningRequestPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [products, setProducts] = React.useState<CleaningProduct[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [priceColumnConfig, setPriceColumnConfig] = React.useState<PriceColumnConfig>({ id: 'priceColumnConfig' });

  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("");
  const [requestItems, setRequestItems] = React.useState<CleaningRequestItem[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [orderItemSearchTerm, setOrderItemSearchTerm] = React.useState("");

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [productsSnap, branchesSnap, companiesSnap, configSnap] = await Promise.all([
        getDocs(query(collection(db, "cleaningProducts"), orderBy("name"))),
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(query(collection(db, "companies"), orderBy("name"))),
        getDoc(doc(db, "settings", "priceColumnConfig")),
      ]);
      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CleaningProduct)));
      setBranches(branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
      setCompanies(companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company)));
      if (configSnap.exists()) {
        setPriceColumnConfig(configSnap.data() as PriceColumnConfig);
      }
    } catch (error) {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredProducts = React.useMemo(() => {
    if (!searchTerm) {
      return products;
    }
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);
  
  const filteredRequestItems = React.useMemo(() => {
    if (!orderItemSearchTerm) {
      return requestItems;
    }
    return requestItems.filter(item =>
      item.productName.toLowerCase().includes(orderItemSearchTerm.toLowerCase())
    );
  }, [requestItems, orderItemSearchTerm]);

  const handleProductSelection = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setRequestItems(prev => {
        const existingItem = prev.find(item => item.productId === productId);
        if (existingItem) {
            return prev.filter(item => item.productId !== productId);
        } else {
            return [...prev, { 
                productId: product.id, 
                productName: product.name, 
                quantity: 1, 
                price: product.price,
                price2: product.price2,
                price3: product.price3,
            }];
        }
    });
  };

  const handleRemoveItem = (productId: string) => {
    setRequestItems(prev => prev.filter(item => item.productId !== productId));
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setRequestItems(prev => prev.map(item => item.productId === productId ? { ...item, quantity: newQuantity } : item));
  };
  
  const totalItemsCount = React.useMemo(() => requestItems.reduce((sum, item) => sum + item.quantity, 0), [requestItems]);
  const totalValue = React.useMemo(() => requestItems.reduce((sum, item) => sum + (item.price * item.quantity), 0), [requestItems]);
  const totalValue2 = React.useMemo(() => requestItems.reduce((sum, item) => sum + ((item.price2 || 0) * item.quantity), 0), [requestItems]);
  const totalValue3 = React.useMemo(() => requestItems.reduce((sum, item) => sum + ((item.price3 || 0) * item.quantity), 0), [requestItems]);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const getCompanyName = (companyId: string | null | undefined): string => companies.find(c => c.id === companyId)?.name || '';


  const handleSubmit = async () => {
    if (!selectedBranchId) {
        toast({ title: "Filial não selecionada", description: "Por favor, selecione uma filial.", variant: "destructive"});
        return;
    }
    if (requestItems.length === 0) {
        toast({ title: "Nenhum produto selecionado", description: "Adicione ao menos um produto ao pedido.", variant: "destructive"});
        return;
    }
    if (!user) {
        toast({ title: "Usuário não autenticado", description: "Por favor, faça login novamente.", variant: "destructive"});
        return;
    }
    
    setIsSubmitting(true);
    try {
        const branchName = branches.find(b => b.id === selectedBranchId)?.name || 'N/A';
        // Map to the basic CleaningRequestItem for Firestore
        const itemsToSave: CleaningRequestItem[] = requestItems.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            price2: item.price2,
            price3: item.price3
        }));

        await addDoc(collection(db, "cleaningRequests"), {
            userId: user.uid,
            userName: user.displayName || "Usuário desconhecido",
            branchId: selectedBranchId,
            branchName,
            items: itemsToSave,
            totalValue,
            createdAt: serverTimestamp(),
        });
        toast({ title: "Pedido Salvo!", description: "O pedido de material de limpeza foi registrado." });
        setSelectedBranchId("");
        setRequestItems([]);
        setOrderItemSearchTerm("");
    } catch (error) {
        toast({ title: "Erro ao salvar pedido", variant: "destructive"});
        console.error(error);
    } finally {
        setIsSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <ShoppingCart className="text-primary h-8 w-8" /> Solicitar Limpeza
          </h1>
          <p className="text-muted-foreground text-sm">
            Selecione uma filial e planeje sua requisição de materiais de forma intuitiva.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Painel Informações */}
        <Card className="border-none shadow-glass bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden xl:col-span-8 border border-border/10">
          <CardHeader className="bg-muted/10 border-b border-border/10 p-5">
              <CardTitle className="text-xl font-headline flex items-center gap-2"><Building2 className="h-5 w-5 text-primary"/> Dados da Solicitação</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
               <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Solicitante</Label>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-background/50 border border-border/50">
                      <div className="p-2 bg-primary/10 rounded-xl"><UserIcon className="h-5 w-5 text-primary" /></div>
                      <span className="font-bold text-foreground/80">{user?.displayName || "Usuário"}</span>
                  </div>
              </div>
              <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5"><GitFork className="h-3 w-3"/> Filial Destino</Label>
                  <Select value={selectedBranchId} onValueChange={setSelectedBranchId} disabled={isSubmitting}>
                      <SelectTrigger className="h-auto py-4 px-4 rounded-2xl bg-background/50 border-border/50 focus:ring-primary/20"><SelectValue placeholder="Selecione a filial..." /></SelectTrigger>
                      <SelectContent className="rounded-xl shadow-glass">
                          {branches.map(b => <SelectItem key={b.id} value={b.id} className="font-semibold">{b.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
          </CardContent>
        </Card>

        {/* Resumo do Pedido Dinâmico */}
         <Card className="border-none shadow-soft bg-primary/5 backdrop-blur-md rounded-3xl overflow-hidden xl:col-span-4 flex flex-col justify-center items-center p-6 text-center border-primary/10">
            <div className="p-4 bg-primary/10 rounded-2xl mb-4 text-primary">
               <Banknote className="h-8 w-8" />
            </div>
            <p className="text-[10px] uppercase font-bold text-primary/70 tracking-widest mb-2">Total Estimado</p>
            <p className="text-4xl font-bold font-mono tracking-tighter text-foreground mb-6">{formatCurrency(totalValue)}</p>
            
            <div className="flex items-center gap-2 text-sm text-foreground/80 bg-background px-4 py-2 rounded-xl shadow-sm border border-border/50">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-bold font-mono">{totalItemsCount}</span> itens de limpeza
            </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <Card className="border-none shadow-soft bg-card/60 backdrop-blur-md rounded-3xl overflow-hidden">
                <CardHeader className="bg-muted/10 border-b border-border/10 p-5">
                  <CardTitle className="text-lg font-headline">Catálogo de Produtos</CardTitle>
                  <div className="relative mt-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar produto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/20"
                      />
                  </div>
                </CardHeader>
                <CardContent className="h-[600px] overflow-y-auto p-4 custom-scrollbar">
                    <div className="space-y-2">
                        {filteredProducts.map(product => {
                            const isChecked = requestItems.some(i => i.productId === product.id);
                            return (
                            <div key={product.id} 
                                 className={cn(
                                     "flex items-start space-x-3 rounded-2xl border p-4 transition-all duration-200 hover:shadow-sm cursor-pointer",
                                     isChecked ? "border-primary/50 bg-primary/5 shadow-sm" : "border-border/30 hover:border-primary/30 hover:bg-muted/5 bg-background/50"
                                 )}
                                 onClick={() => handleProductSelection(product.id)}
                            >
                                <Checkbox 
                                    id={`product-${product.id}`} 
                                    checked={isChecked}
                                    onCheckedChange={() => handleProductSelection(product.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className={cn("mt-1", isChecked && "text-primary border-primary")}
                                />
                                <div className="flex-1 space-y-1">
                                    <Label htmlFor={`product-${product.id}`} className="font-bold text-foreground/90 cursor-pointer pointer-events-none text-sm">{product.name}</Label>
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                        {priceColumnConfig.price1CompanyId && <Badge variant="secondary" className="text-[9px] font-mono font-medium px-2 py-0">{getCompanyName(priceColumnConfig.price1CompanyId)}: {formatCurrency(product.price)}</Badge>}
                                        {priceColumnConfig.price2CompanyId && <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground/80 px-2 py-0 border-border/50">{formatCurrency(product.price2 || 0)}</Badge>}
                                        {priceColumnConfig.price3CompanyId && <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground/80 px-2 py-0 border-border/50">{formatCurrency(product.price3 || 0)}</Badge>}
                                    </div>
                                </div>
                            </div>
                        )})}
                         {filteredProducts.length === 0 && (
                          <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-2">
                              <Search className="h-8 w-8 text-muted-foreground/30" />
                              <p className="text-sm">Nenhum produto encontrado.</p>
                          </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2">
          <Card className="border-none shadow-glass bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden h-full flex flex-col">
            <CardHeader className="bg-muted/10 border-b border-border/10 p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                      <CardTitle className="text-xl font-headline">Itens do Pedido</CardTitle>
                      <CardDescription>Gerencie as quantidades do que foi selecionado.</CardDescription>
                  </div>
                  <div className="relative w-full md:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar no pedido..."
                        value={orderItemSearchTerm}
                        onChange={(e) => setOrderItemSearchTerm(e.target.value)}
                        className="pl-10 bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/20"
                      />
                  </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-0 min-h-[400px]">
                {requestItems.length > 0 ? (
                <Table>
                    <TableHeader className="bg-muted/20 sticky top-0 z-10 backdrop-blur-md">
                        <TableRow className="border-border/50">
                            <TableHead className="text-[10px] uppercase font-bold tracking-widest py-4">Produto</TableHead>
                            <TableHead className="w-40 text-[10px] uppercase font-bold tracking-widest py-4 text-center">Quantidade</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest py-4">{getCompanyName(priceColumnConfig.price1CompanyId) || "Subtotal 1"}</TableHead>
                            {priceColumnConfig.price2CompanyId && <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest py-4">{getCompanyName(priceColumnConfig.price2CompanyId)}</TableHead>}
                            {priceColumnConfig.price3CompanyId && <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest py-4">{getCompanyName(priceColumnConfig.price3CompanyId)}</TableHead>}
                            <TableHead className="w-16"><span className="sr-only">Remover</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRequestItems.map(item => (
                            <TableRow key={item.productId} className="hover:bg-primary/5 transition-colors border-border/5">
                                <TableCell className="font-bold text-sm text-foreground/80 py-4">{item.productName}</TableCell>
                                <TableCell>
                                    <div className="flex items-center justify-center gap-2">
                                        <Button size="icon" variant="outline" className="h-8 w-8 rounded-xl border-border/50 hover:bg-primary hover:text-primary-foreground transition-colors" onClick={() => handleQuantityChange(item.productId, item.quantity - 1)} disabled={item.quantity <= 1}>
                                            <Minus className="h-3 w-3"/>
                                        </Button>
                                        <Input type="number" value={item.quantity} onChange={e => handleQuantityChange(item.productId, parseInt(e.target.value) || 1)} className="w-16 h-8 text-center font-mono font-bold bg-background/50 border-border/50 rounded-lg no-spinners" min="1"/>
                                        <Button size="icon" variant="outline" className="h-8 w-8 rounded-xl border-border/50 hover:bg-primary hover:text-primary-foreground transition-colors" onClick={() => handleQuantityChange(item.productId, item.quantity + 1)}>
                                            <Plus className="h-3 w-3"/>
                                        </Button>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-bold font-mono text-primary">{formatCurrency(item.price * item.quantity)}</TableCell>
                                {priceColumnConfig.price2CompanyId && <TableCell className="text-right font-mono text-muted-foreground/80">{formatCurrency((item.price2 || 0) * item.quantity)}</TableCell>}
                                {priceColumnConfig.price3CompanyId && <TableCell className="text-right font-mono text-muted-foreground/80">{formatCurrency((item.price3 || 0) * item.quantity)}</TableCell>}
                                <TableCell className="text-center">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors" onClick={() => handleRemoveItem(item.productId)}>
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Remover</span>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFoot>
                        <TableRow className="bg-muted/10 border-t border-border/10">
                            <TableCell colSpan={2} className="text-right font-bold text-xs uppercase tracking-widest py-5">Soma Estimada</TableCell>
                            <TableCell className="text-right font-bold font-mono text-[16px] text-foreground py-5">{formatCurrency(totalValue)}</TableCell>
                            {priceColumnConfig.price2CompanyId && <TableCell className="text-right font-bold font-mono text-[16px] text-muted-foreground/70 py-5">{formatCurrency(totalValue2)}</TableCell>}
                            {priceColumnConfig.price3CompanyId && <TableCell className="text-right font-bold font-mono text-[16px] text-muted-foreground/70 py-5">{formatCurrency(totalValue3)}</TableCell>}
                            <TableCell />
                        </TableRow>
                    </TableFoot>
                </Table>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-8">
                        <div className="p-6 bg-muted/20 rounded-full mb-4">
                            <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                        <h3 className="text-xl font-bold font-headline mb-2 text-foreground/80">Carrinho Vazio</h3>
                        <p className="text-muted-foreground text-sm max-w-[250px]">
                            Selecione os produtos da lista ao lado para planejar o seu pedido de limpeza.
                        </p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="p-6 border-t border-border/10">
                 <Button className="w-full text-lg h-14 rounded-2xl shadow-md transition-all font-bold hover:shadow-lg hover:scale-[1.01]" onClick={handleSubmit} disabled={isSubmitting || requestItems.length === 0}>
                    {isSubmitting ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Processando...</>
                    ) : (
                        <><Save className="mr-2 h-5 w-5"/> Concluir Solicitação</>
                    )}
                </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
