
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, SprayCan, Download, Upload } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  writeBatch,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { CleaningProduct, Company, PriceColumnConfig } from "@/lib/definitions";
import Papa from "papaparse";
import { Parser } from "json2csv";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


export default function CleaningProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = React.useState<CleaningProduct[]>([]);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [priceColumnConfig, setPriceColumnConfig] = React.useState<PriceColumnConfig>({ id: 'priceColumnConfig' });
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentProduct, setCurrentProduct] = React.useState<Partial<CleaningProduct>>({ name: "", price: 0, price2: 0, price3: 0 });
  const [productToDelete, setProductToDelete] = React.useState<CleaningProduct | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");

  const isEditing = !!currentProduct.id;
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const filteredProducts = React.useMemo(() => {
    if (!searchTerm) {
      return products;
    }
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);


  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [productsSnap, companiesSnap, configSnap] = await Promise.all([
        getDocs(query(collection(db, "cleaningProducts"), orderBy("name"))),
        getDocs(query(collection(db, "companies"), orderBy("name"))),
        getDoc(doc(db, "settings", "priceColumnConfig")),
      ]);

      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CleaningProduct)));
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
  
  const handleOpenDialog = (product?: CleaningProduct) => {
    setCurrentProduct(product || { name: "", price: 0, price2: 0, price3: 0 });
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentProduct({ name: "", price: 0, price2: 0, price3: 0 });
    setOpen(false);
  };

  const handleCurrencyChange = (field: 'price' | 'price2' | 'price3') => (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    setCurrentProduct(prev => ({...prev, [field]: Number(value) / 100 }));
  }

  const formatCurrencyForInput = (value?: number) => {
    if (value === undefined || value === null) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(value);
  }
  
  const formatCurrency = (value?: number) => {
    if (value === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  const handleSubmit = async () => {
    if (!currentProduct.name || currentProduct.name.trim() === "" || currentProduct.price === undefined || currentProduct.price < 0) {
      toast({ title: "Dados inválidos", description: "Nome e preço principal são obrigatórios.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
        const dataToSave = {
            name: currentProduct.name,
            price: currentProduct.price || 0,
            price2: currentProduct.price2 || 0,
            price3: currentProduct.price3 || 0,
        };

      if (isEditing) {
        const docRef = doc(db, "cleaningProducts", currentProduct.id!);
        await updateDoc(docRef, dataToSave);
        toast({ title: "Produto atualizado!" });
      } else {
        await addDoc(collection(db, "cleaningProducts"), dataToSave);
        toast({ title: "Produto cadastrado!" });
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      toast({ title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteDoc(doc(db, "cleaningProducts", productToDelete.id));
      toast({ title: "Produto deletado", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
      setProductToDelete(null);
    }
  };
  
  const handleColumnCompanyChange = async (column: 'price1CompanyId' | 'price2CompanyId' | 'price3CompanyId', companyId: string) => {
      const newConfig = { ...priceColumnConfig, [column]: companyId === 'none' ? null : companyId };
      setPriceColumnConfig(newConfig); // Optimistic update
      try {
          const configRef = doc(db, "settings", "priceColumnConfig");
          await setDoc(configRef, newConfig, { merge: true });
      } catch (error) {
          toast({ title: "Erro ao salvar configuração", variant: "destructive" });
          fetchData(); // Revert on error
      }
  };

  const getCompanyName = (companyId: string | null | undefined): string => {
    if (!companyId) return '';
    return companies.find(c => c.id === companyId)?.name || '';
  }

  const handleExport = () => {
    if (products.length === 0) {
      toast({ title: "Nenhum produto para exportar", variant: "destructive" });
      return;
    }
    const dataToExport = products.map(({ id, name, price, price2, price3 }) => ({ id, name, price, price2, price3 }));
    const json2csvParser = new Parser({ fields: ['id', 'name', 'price', 'price2', 'price3'], delimiter: ';' });
    const csv = json2csvParser.parse(dataToExport);

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `modelo_produtos_limpeza_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      complete: async (results) => {
        const data = results.data as { id?: string; name: string; price: string; price2?: string; price3?: string }[];
        
        try {
          const batch = writeBatch(db);
          let updatedCount = 0;
          let createdCount = 0;

          data.forEach(row => {
            const price = parseFloat(row.price?.replace(',', '.') || '0');
            const price2 = parseFloat(row.price2?.replace(',', '.') || '0');
            const price3 = parseFloat(row.price3?.replace(',', '.') || '0');
            
            if (row.name && !isNaN(price)) {
              const productData = {
                name: row.name,
                price: price,
                price2: isNaN(price2) ? 0 : price2,
                price3: isNaN(price3) ? 0 : price3,
              };

              if (row.id && products.some(p => p.id === row.id)) {
                // Update existing product
                const docRef = doc(db, "cleaningProducts", row.id);
                batch.update(docRef, productData);
                updatedCount++;
              } else {
                // Create new product
                const docRef = doc(collection(db, "cleaningProducts"));
                batch.set(docRef, productData);
                createdCount++;
              }
            }
          });

          if (updatedCount === 0 && createdCount === 0) {
             toast({ title: "Nenhuma linha válida encontrada", description: "Verifique o formato da planilha.", variant: "destructive" });
             return;
          }

          await batch.commit();
          toast({
            title: "Importação Concluída!",
            description: `${createdCount} produto(s) criado(s) e ${updatedCount} atualizado(s).`,
          });
          fetchData();

        } catch (error) {
           toast({ title: "Erro na importação", description: "Não foi possível salvar os dados da planilha.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
            if (importInputRef.current) {
                importInputRef.current.value = "";
            }
        }
      },
      error: () => {
        toast({ title: "Erro ao ler o arquivo", description: "Verifique o formato do CSV.", variant: "destructive" });
        setIsSubmitting(false);
      }
    });
  };

  const renderCompanySelector = (column: 'price1CompanyId' | 'price2CompanyId' | 'price3CompanyId', label: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={column} className="text-xs">{label}</Label>
      <Select
        value={priceColumnConfig[column] || 'none'}
        onValueChange={(value) => handleColumnCompanyChange(column, value)}
      >
        <SelectTrigger id={column} className="h-8 w-48">
          <SelectValue placeholder="Selecione uma empresa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhuma</SelectItem>
          {companies.map(company => (
            <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <SprayCan/> Produtos de Limpeza
            </h1>
            <p className="text-muted-foreground">
              Gerencie os produtos de limpeza e seus respectivos valores.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={loading}>
              <Download className="mr-2 h-4 w-4" /> Exportar Modelo
            </Button>
            <Button asChild variant="outline">
              <label htmlFor="import-csv">
                <Upload className="mr-2 h-4 w-4" />
                Importar
                <input
                  ref={importInputRef}
                  id="import-csv"
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  onChange={handleImport}
                  disabled={isSubmitting}
                />
              </label>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Novo Produto</span>
                </Button>
              </DialogTrigger>
              <DialogContent onCloseAutoFocus={handleCloseDialog}>
                <DialogHeader>
                  <DialogTitle>{isEditing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Produto</Label>
                    <Input id="name" value={currentProduct.name || ""} onChange={(e) => setCurrentProduct({...currentProduct, name: e.target.value})} placeholder="Ex: Detergente" disabled={isSubmitting}/>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="price">Preço 1 (R$)</Label>
                        <Input id="price" value={formatCurrencyForInput(currentProduct.price)} onChange={handleCurrencyChange('price')} placeholder="0,00" disabled={isSubmitting}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="price2">Preço 2 (R$)</Label>
                        <Input id="price2" value={formatCurrencyForInput(currentProduct.price2)} onChange={handleCurrencyChange('price2')} placeholder="0,00" disabled={isSubmitting}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="price3">Preço 3 (R$)</Label>
                        <Input id="price3" value={formatCurrencyForInput(currentProduct.price3)} onChange={handleCurrencyChange('price3')} placeholder="0,00" disabled={isSubmitting}/>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>Cancelar</Button>
                  <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Lista de Produtos</CardTitle>
            <CardDescription>
              {searchTerm ? `Mostrando ${filteredProducts.length} de ${products.length} produtos cadastrados.` : `Total de ${products.length} produtos cadastrados.`}
            </CardDescription>
            <div className="flex flex-col sm:flex-row gap-4 pt-4 justify-between items-center">
              <div className="w-full sm:w-auto">
                <Input 
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-4">
                {renderCompanySelector('price1CompanyId', 'Coluna Preço 1')}
                {renderCompanySelector('price2CompanyId', 'Coluna Preço 2')}
                {renderCompanySelector('price3CompanyId', 'Coluna Preço 3')}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
            <AlertDialog>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>{getCompanyName(priceColumnConfig.price1CompanyId) || "Preço 1"}</TableHead>
                    <TableHead>{getCompanyName(priceColumnConfig.price2CompanyId) || "Preço 2"}</TableHead>
                    <TableHead>{getCompanyName(priceColumnConfig.price3CompanyId) || "Preço 3"}</TableHead>
                    <TableHead><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{formatCurrency(product.price)}</TableCell>
                      <TableCell>{formatCurrency(product.price2)}</TableCell>
                      <TableCell>{formatCurrency(product.price3)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(product)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-red-600" onSelect={(e) => { e.preventDefault(); setProductToDelete(product);}}>
                                <Trash2 className="mr-2 h-4 w-4" />Deletar
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {productToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>Essa ação não pode ser desfeita e irá excluir o produto <strong className="mx-1">{productToDelete.name}</strong>.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Sim, deletar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              )}
            </AlertDialog>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
