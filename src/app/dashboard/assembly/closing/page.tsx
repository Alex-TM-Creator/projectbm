
"use client";

import * as React from "react";
import {
  Loader2,
  Save,
  ShoppingCart,
  PlusCircle,
  Trash2,
  User as UserIcon,
  Search,
  Wrench,
  Package,
  HardHat,
  DollarSign,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
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
  Montador,
  AssistanceRequest,
  ProductType,
  AssemblyClosing,
  AssemblyClosingItem,
  AssemblyAssistanceItem,
} from "@/lib/definitions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function AssemblyClosingPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Data from other collections
  const [montadores, setMontadores] = React.useState<Montador[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [astecHistory, setAstecHistory] = React.useState<AssistanceRequest[]>([]);
  const [productTypes, setProductTypes] = React.useState<ProductType[]>([]);

  // Form State
  const [selectedMontadorId, setSelectedMontadorId] = React.useState<string>("");
  const [productSearch, setProductSearch] = React.useState("");
  const [astecSearch, setAstecSearch] = React.useState("");
  const [closingDate, setClosingDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
  
  const [orderItems, setOrderItems] = React.useState<AssemblyClosingItem[]>([]);
  const [assistanceItems, setAssistanceItems] = React.useState<AssemblyAssistanceItem[]>([]);
  const [observations, setObservations] = React.useState("");

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [montadoresSnap, productsSnap, astecSnap, productTypesSnap] = await Promise.all([
        getDocs(query(collection(db, "montadores"), orderBy("name"))),
        getDocs(query(collection(db, "products"), orderBy("name"))),
        getDocs(query(collection(db, "astec"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "productTypes")),
      ]);
      setMontadores(montadoresSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Montador)));
      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setAstecHistory(astecSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AssistanceRequest)));
      setProductTypes(productTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductType)));
    } catch (error) {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (user && !authLoading) {
      fetchData();
    }
  }, [fetchData, user, authLoading]);
  
  const filteredProducts = React.useMemo(() => {
    if (!productSearch) return [];
    return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.internalCode?.includes(productSearch));
  }, [productSearch, products]);
  
  const filteredAstec = React.useMemo(() => {
    if (!astecSearch) return [];
    return astecHistory.filter(a => a.orderNumber.toString().includes(astecSearch) || a.customerName.toLowerCase().includes(astecSearch.toLowerCase()));
  }, [astecSearch, astecHistory]);

  const selectedMontador = React.useMemo(() => montadores.find(m => m.id === selectedMontadorId), [selectedMontadorId, montadores]);

  const handleAddItem = (product: Product) => {
    let autoDiscountType: 'percentage' | 'fixed' = 'percentage';
    let autoDiscountValue = 0;

    if (selectedMontador && selectedMontador.automaticDiscounts) {
      const discountRule = selectedMontador.automaticDiscounts.find(d => d.productTypeId === product.productTypeId);
      if (discountRule) {
        autoDiscountType = discountRule.discountType;
        autoDiscountValue = discountRule.discountValue;
      }
    }

    setOrderItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      
      const calculateTotal = (item: AssemblyClosingItem) => {
        const itemTotal = item.unitPrice * item.quantity;
        let discount = 0;
        if (item.discountType === 'percentage') {
          discount = itemTotal * (item.discountValue / 100);
        } else {
          discount = item.discountValue;
        }
        return itemTotal - discount;
      };

      if (existing) {
        const updatedItems = prev.map(item => {
          if (item.productId === product.id) {
            const newItem = { ...item, quantity: item.quantity + 1 };
            newItem.total = calculateTotal(newItem);
            return newItem;
          }
          return item;
        });
        return updatedItems;
      }

      const newItem: AssemblyClosingItem = {
        productId: product.id,
        productName: product.name,
        internalCode: product.internalCode,
        quantity: 1,
        unitPrice: product.salePrice,
        discountType: autoDiscountType,
        discountValue: autoDiscountValue,
        total: 0, // Placeholder, calculated next
        productTypeId: product.productTypeId,
      };
      newItem.total = calculateTotal(newItem);
      
      return [...prev, newItem];
    });
    setProductSearch("");
  };


  const handleUpdateItem = (productId: string, field: 'quantity' | 'unitPrice' | 'discountValue' | 'discountType', value: any) => {
    setOrderItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const updatedItem = { ...item, [field]: value };
        const itemTotal = updatedItem.unitPrice * updatedItem.quantity;
        
        let discount = 0;
        if(updatedItem.discountType === 'percentage') {
          discount = itemTotal * (updatedItem.discountValue / 100);
        } else {
          discount = updatedItem.discountValue;
        }

        updatedItem.total = itemTotal - discount;
        return updatedItem;
      }
      return item;
    }));
  };

  const handleRemoveItem = (productId: string) => {
    setOrderItems(prev => prev.filter(item => item.productId !== productId));
  };
  
  const handleAddAssistance = (astec: AssistanceRequest) => {
    setAssistanceItems(prev => {
      if (prev.some(item => item.astecId === astec.id)) return prev;
      return [...prev, {
        astecId: astec.id,
        assistanceNumber: astec.assistanceNumber || 0,
        value: 0
      }];
    });
    setAstecSearch("");
  };

  const handleUpdateAssistance = (astecId: string, value: number) => {
    setAssistanceItems(prev => prev.map(item => item.astecId === astecId ? { ...item, value } : item));
  };

  const handleRemoveAssistance = (astecId: string) => {
    setAssistanceItems(prev => prev.filter(item => item.astecId !== astecId));
  };
  
  const calculations = React.useMemo(() => {
    const subtotalProducts = orderItems.reduce((sum, item) => sum + item.total, 0);
    const subtotalAssistance = assistanceItems.reduce((sum, item) => sum + item.value, 0);
    const totalGeral = subtotalProducts + subtotalAssistance;
    const totalDescontos = orderItems.reduce((sum, item) => {
        const itemTotal = item.unitPrice * item.quantity;
        const discount = item.discountType === 'percentage'
          ? itemTotal * (item.discountValue / 100)
          : item.discountValue;
        return sum + discount;
    }, 0);
    const totalFinal = totalGeral; // Total final é o valor bruto da montagem
    
    const productTypeNovoId = productTypes.find(pt => pt.name.toLowerCase().includes('novo'))?.id;
    const productTypeSalvadoId = productTypes.find(pt => pt.name.toLowerCase().includes('salvado'))?.id;
    
    const totalNovo = orderItems.filter(i => i.productTypeId === productTypeNovoId).reduce((sum, item) => sum + item.total, 0);
    const totalSalvado = orderItems.filter(i => i.productTypeId === productTypeSalvadoId).reduce((sum, item) => sum + item.total, 0);

    let comissaoAplicada = false;
    let comissaoNovo = 0;
    let comissaoSalvado = 0;
    let bonus = 0;

    if (selectedMontador) {
        const baseCalculoComissao = subtotalProducts;
        
        comissaoAplicada = (selectedMontador.commissionThresholds || []).some(
            range => baseCalculoComissao >= range.from && baseCalculoComissao <= range.to
        );
        
        if (comissaoAplicada) {
             const comissaoNovoDef = selectedMontador.productTypeCommissions.find(c => c.productTypeName.toLowerCase().includes('novo'));
            if (comissaoNovoDef) {
                comissaoNovo = totalNovo * (comissaoNovoDef.commissionPercentage / 100);
            }
            
            const comissaoSalvadoDef = selectedMontador.productTypeCommissions.find(c => c.productTypeName.toLowerCase().includes('salvado'));
            if (comissaoSalvadoDef) {
                comissaoSalvado = totalSalvado * (comissaoSalvadoDef.commissionPercentage / 100);
            }
        }
        
        const applicableBonusRange = (selectedMontador.salesRanges || []).find(range => baseCalculoComissao >= range.from && baseCalculoComissao <= range.to);
        if (applicableBonusRange) {
            if (applicableBonusRange.bonusType === 'fixed') {
                bonus = applicableBonusRange.bonusValue;
            } else {
                bonus = baseCalculoComissao * (applicableBonusRange.bonusValue / 100);
            }
        }
    }
    
    const totalComissao = comissaoNovo + comissaoSalvado;
    const totalPremio = totalComissao + bonus;

    return {
      subtotalProducts,
      subtotalAssistance,
      totalGeral,
      totalDescontos,
      totalFinal,
      totalNovo,
      totalSalvado,
      comissaoAplicada,
      comissaoNovo,
      comissaoSalvado,
      totalComissao,
      bonus,
      totalPremio
    };
  }, [orderItems, assistanceItems, selectedMontador, productTypes]);

  const handleSubmit = async () => {
    if (!selectedMontadorId || (orderItems.length === 0 && assistanceItems.length === 0)) {
      toast({ title: "Dados Incompletos", description: "Selecione um montador e adicione ao menos um item.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
        await addDoc(collection(db, "assemblyClosings"), {
            montadorId: selectedMontadorId,
            montadorName: selectedMontador?.name || 'N/A',
            closingDate,
            items: orderItems,
            assistanceItems,
            observations,
            ...calculations,
            createdAt: serverTimestamp(),
            createdByUserId: user?.uid,
            createdByUserName: user?.displayName,
            status: 'pending',
        });
        toast({ title: "Fechamento de Montagem Salvo!", description: "O registro foi salvo com sucesso." });
        
        // Reset form
        setSelectedMontadorId("");
        setOrderItems([]);
        setAssistanceItems([]);
        setObservations("");

    } catch (error) {
        toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatCurrencyForInput = (value?: number) => {
    if (value === undefined || value === null) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };
  
  const handlePercentageInputChange = (
    updater: (value: number) => void
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numericValue = rawValue ? parseFloat(rawValue) / 100 : 0;
    updater(numericValue);
  };


  if (loading || authLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <CardTitle className="text-3xl font-bold font-headline flex items-center gap-3">
          <HardHat /> Fechamento de Montagem
        </CardTitle>
        <CardDescription>Registre os produtos montados, assistências e calcule a premiação do montador.</CardDescription>
      </CardHeader>
      
      <Card>
        <CardHeader>
          <CardTitle>1. Informações Gerais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="montador">Montador</Label>
            <Select value={selectedMontadorId} onValueChange={setSelectedMontadorId} disabled={isSubmitting}>
              <SelectTrigger id="montador"><SelectValue placeholder="Selecione o montador"/></SelectTrigger>
              <SelectContent>{montadores.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
           <div className="space-y-2">
            <Label htmlFor="closing-date">Data do Fechamento</Label>
            <Input id="closing-date" type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} disabled={isSubmitting}/>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <Card>
            <CardHeader><CardTitle>2. Adicionar Produtos Montados</CardTitle></CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar produto..." className="pl-10" value={productSearch} onChange={e => setProductSearch(e.target.value)} disabled={!selectedMontadorId}/>
              </div>
              {filteredProducts.length > 0 && (
                <div className="max-h-60 overflow-y-auto mt-2 space-y-1 pr-2 rounded-md border">
                  {filteredProducts.map(p => 
                    <Button key={p.id} variant="ghost" className="w-full justify-start h-auto py-2" onClick={() => handleAddItem(p)}>
                      <div className="flex flex-col text-left">
                        <p>{p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">Cód: {p.internalCode}</p>
                      </div>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
           </Card>
           <Card>
            <CardHeader><CardTitle>3. Adicionar Assistência Técnica</CardTitle></CardHeader>
            <CardContent>
               <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar OS ou cliente..." className="pl-10" value={astecSearch} onChange={e => setAstecSearch(e.target.value)} disabled={!selectedMontadorId}/>
              </div>
               {filteredAstec.length > 0 && (
                <div className="max-h-60 overflow-y-auto mt-2 space-y-1 pr-2 rounded-md border">
                  {filteredAstec.map(a => 
                    <Button key={a.id} variant="ghost" className="w-full justify-start h-auto py-2" onClick={() => handleAddAssistance(a)}>
                      <div className="flex flex-col text-left">
                        <p>OS #{a.assistanceNumber} - {a.customerName}</p>
                      </div>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
           </Card>
      </div>
        
      <Card>
          <CardHeader>
            <CardTitle>4. Itens do Fechamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <Table>
               <TableHeader>
                <TableRow>
                  <TableHead>Cód. Interno</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-24 text-center">Qtd.</TableHead>
                  <TableHead className="w-32">Valor Unit.</TableHead>
                  <TableHead className="w-48">Desconto</TableHead>
                  <TableHead className="w-32 text-right">Total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
               <TableBody>
                {orderItems.map(item => (
                  <TableRow key={item.productId}>
                    <TableCell className="font-mono">{item.internalCode}</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell><Input type="number" value={item.quantity} onChange={e => handleUpdateItem(item.productId, 'quantity', parseInt(e.target.value) || 1)} className="h-8 w-16 text-center mx-auto" min="1"/></TableCell>
                    <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                          <Input
                            type="text"
                            value={
                              item.discountType === 'percentage'
                                ? formatCurrencyForInput(item.discountValue)?.replace(/,/g, '.')
                                : formatCurrencyForInput(item.discountValue)
                            }
                            onChange={(e) => {
                              const rawValue = e.target.value.replace(/[^0-9]/g, '');
                              const numericValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
                              handleUpdateItem(item.productId, 'discountValue', numericValue);
                            }}
                            className="h-8 w-20 text-right"
                          />
                        <Select
                          value={item.discountType}
                          onValueChange={(value) => handleUpdateItem(item.productId, 'discountType', value as 'percentage' | 'fixed')}
                        >
                          <SelectTrigger className="h-8 w-[5rem]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">%</SelectItem>
                            <SelectItem value="fixed">R$</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(item.total)}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItem(item.productId)}><Trash2 className="h-4 w-4"/></Button></TableCell>
                  </TableRow>
                ))}
                {assistanceItems.map(item => (
                   <TableRow key={item.astecId}>
                    <TableCell>ASTEC #{item.assistanceNumber}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-center">1</TableCell>
                    <TableCell><Input type="text" value={formatCurrencyForInput(item.value)} onChange={e => handleUpdateAssistance(item.astecId, parseFloat(e.target.value.replace(/\D/g, '')) / 100 || 0)} className="h-8 w-28"/></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{formatCurrency(item.value)}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveAssistance(item.astecId)}><Trash2 className="h-4 w-4"/></Button></TableCell>
                  </TableRow>
                ))}
               </TableBody>
            </Table>
          </CardContent>
        </Card>

       <Card>
        <CardHeader>
          <CardTitle>5. Resumo e Premiação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-semibold text-lg">Resumo Financeiro</h4>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal Produtos:</span> <span>{formatCurrency(calculations.subtotalProducts)}</span></div>
            <div className="pl-4 border-l-2 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Montagem (Novo):</span> <span>{formatCurrency(calculations.totalNovo)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Montagem (Salvado):</span> <span>{formatCurrency(calculations.totalSalvado)}</span></div>
            </div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal Assistência:</span> <span>{formatCurrency(calculations.subtotalAssistance)}</span></div>
            <div className="border-t"></div>
            <div className="flex justify-between font-bold"><span >Total Geral:</span> <span>{formatCurrency(calculations.totalGeral)}</span></div>
          </div>
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-semibold text-lg">Cálculo de Premiação</h4>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Base de Cálculo:</span> <span>{formatCurrency(calculations.subtotalProducts)}</span></div>
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Comissão por Tipo:</span> 
                <Badge variant={calculations.comissaoAplicada ? "default" : "secondary"}>{calculations.comissaoAplicada ? 'Aplicada' : 'Não Aplicada'}</Badge>
            </div>
            {calculations.comissaoAplicada && (
              <div className="pl-4 border-l-2 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Comissão (Novo):</span> <span>{formatCurrency(calculations.comissaoNovo)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Comissão (Salvado):</span> <span>{formatCurrency(calculations.comissaoSalvado)}</span></div>
              </div>
            )}
             <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bônus por Faixa:</span> <span>{formatCurrency(calculations.bonus)}</span></div>
             <div className="border-t"></div>
            <div className="flex justify-between font-bold text-lg text-primary"><span >Total do Prêmio:</span> <span>{formatCurrency(calculations.totalPremio)}</span></div>
          </div>
        </CardContent>
        <CardFooter>
          <Button size="lg" className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
             {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
            Salvar Fechamento
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
