
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Package, Search, Copy, Power, PowerOff, Download, Upload, ChevronDown, Frown, FileSpreadsheet, Save } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  where,
  setDoc,
  writeBatch,
  limit,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
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
  DropdownMenuSeparator,
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
import type { Product, Brand, ProductCategory, ProductType, Markup, StockingLocation, ProductStock, User } from "@/lib/definitions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Parser } from "json2csv";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Papa from "papaparse";

const generateKeywords = (name: string, internalCode?: string, barcode?: string) => {
  const clean = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const text = `${clean(name)} ${clean(internalCode || "")} ${clean(barcode || "")}`;
  const words = text.split(/[^\w\d]+/).filter(w => w.length >= 2);
  return Array.from(new Set(words));
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatCurrencyForInput = (value?: number) => {
  if (value === undefined || value === null) return '';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(value);
};

const formatPercentageForInput = (value?: number) => {
  if (value === undefined || value === null || isNaN(value)) return '';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type CurrentStock = {
    [locationId: string]: {
        quantity: number;
        minimumQuantity?: number;
        maximumQuantity?: number;
    }
}

export default function ProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [brands, setBrands] = React.useState<Brand[]>([]);
  const [productCategories, setProductCategories] = React.useState<ProductCategory[]>([]);
  const [productTypes, setProductTypes] = React.useState<ProductType[]>([]);
  const [markups, setMarkups] = React.useState<Markup[]>([]);
  const [stockingLocations, setStockingLocations] = React.useState<StockingLocation[]>([]);
  const [productStocks, setProductStocks] = React.useState<ProductStock[]>([]);
  const [userData, setUserData] = React.useState<User | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);

  const [currentProduct, setCurrentProduct] = React.useState<Partial<Product>>({});
  const [currentStock, setCurrentStock] = React.useState<CurrentStock>({});
  const [productToDelete, setProductToDelete] = React.useState<Product | null>(null);
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [isLastPage, setIsLastPage] = React.useState(true);

  const isEditing = !!currentProduct.id;
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const fetchData = React.useCallback(async (uid?: string) => {
    try {
      setLoading(true);
      const [brandsSnap, categoriesSnap, typesSnap, markupsSnap, locationsSnap] = await Promise.all([
        getDocs(query(collection(db, "brands"), orderBy("name"))),
        getDocs(query(collection(db, "productCategories"), orderBy("name"))),
        getDocs(query(collection(db, "productTypes"), orderBy("name"))),
        getDocs(query(collection(db, "markups"), orderBy("name"))),
        getDocs(query(collection(db, "stockingLocations"), orderBy("order"))),
      ]);

      setBrands(brandsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)));
      setProductCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductCategory)));
      setProductTypes(typesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductType)));
      setMarkups(markupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Markup)));
      setStockingLocations(locationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockingLocation)));
      setProductStocks([]); // Setado vazio no boot para não travar; será populado no search

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
    const uid = auth.currentUser?.uid;
    fetchData(uid);
  }, [fetchData]);

  const handleSearch = React.useCallback(async () => {
    const term = searchTerm.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (term.length < 3) {
      setProducts([]);
      setIsLastPage(true);
      return;
    }

    setIsSearching(true);
    try {
      const productsRef = collection(db, "products");
      const searchWords = term.split(/\s+/).filter(w => w.length >= 2);
      if (searchWords.length === 0) {
        setIsSearching(false);
        return;
      }

      const firstWord = searchWords[0];
      const termCapitalized = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
      
      const queries = [
        query(productsRef, where("name", ">=", firstWord), where("name", "<=", firstWord + "\uf8ff"), limit(100)),
        query(productsRef, where("name", ">=", termCapitalized), where("name", "<=", termCapitalized + "\uf8ff"), limit(100)),
        query(productsRef, where("keywords", "array-contains", firstWord), limit(100))
      ];

      const snapshots = await Promise.all(queries.map(q => getDocs(q)));
      const resultsMap = new Map<string, Product>();
      
      snapshots.forEach(snap => {
          snap.docs.forEach(doc => {
              resultsMap.set(doc.id, { id: doc.id, ...doc.data() } as Product);
          });
      });

      let results = Array.from(resultsMap.values());

      results = results.filter(p => {
        const pText = `${p.name} ${p.internalCode || ""} ${p.barcode || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return searchWords.every(word => pText.includes(word));
      });

      results.sort((a, b) => a.name.localeCompare(b.name));

      // --- OTIMIZAÇÃO: BUSCAR ESTOQUE APENAS PARA OS RESULTADOS (LIMITADOS E FRACIONADOS) ---
      const productIds = results.map(p => p.id!);
      const stockPromises = [];
      const chunkSize = 30; // Limite do operador in no Firestore

      for (let i = 0; i < productIds.length; i += chunkSize) {
        const chunk = productIds.slice(i, i + chunkSize);
        stockPromises.push(getDocs(query(collection(db, "productStock"), where("productId", "in", chunk))));
      }

      const stockSnaps = await Promise.all(stockPromises);
      const allStocks = stockSnaps.flatMap(snap => snap.docs.map(docSnap => docSnap.data() as ProductStock));
      
      setProductStocks(allStocks);
      setProducts(results);
      setIsLastPage(true); 

    } catch (error) {
      console.error(error);
      toast({ title: "Erro na pesquisa", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, toast]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 3) {
        handleSearch();
      } else if (searchTerm.trim().length === 0) {
        setProducts([]);
        setIsLastPage(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, handleSearch]);

  const handleProductTypeChange = (selectedTypeId: string) => {
    const productType = productTypes.find(t => t.id === selectedTypeId);
    
    setCurrentProduct(prev => {
        if (!prev) return prev;

        const currentName = prev.name || "";
        const baseName = currentName.replace(/\s*\([NS]\)$/, '').trim();
        let newName = baseName;

        if (productType) {
            const typeNameLower = productType.name.toLowerCase();
            if (typeNameLower.includes('novo')) {
                newName = `${baseName} (N) `;
            } else if (typeNameLower.includes('salvado')) {
                newName = `${baseName} (S) `;
            }
        }
        
        return {
            ...prev,
            productTypeId: selectedTypeId,
            name: newName
        };
    });
  };

  const handleOpenDialog = (product?: Product) => {
    setCurrentProduct(product || { isActive: true, freightType: 'fixed', freightValue: 0, volumeQuantity: 1 });
    if (product) {
        const stocksForProduct = productStocks.filter(s => s.productId === product.id);
        const stockMap = stocksForProduct.reduce((acc, stock) => {
            acc[stock.stockingLocationId] = {
              quantity: stock.quantity,
              minimumQuantity: stock.minimumQuantity,
              maximumQuantity: stock.maximumQuantity
            };
            return acc;
        }, {} as CurrentStock);
        setCurrentStock(stockMap);
    } else {
        setCurrentStock({});
    }
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentProduct({});
    setCurrentStock({});
    setOpen(false);
  };
  
  const handleDuplicate = (productToDuplicate: Product) => {
    const newProduct = { ...productToDuplicate };
    delete newProduct.id; 
    newProduct.name = `${newProduct.name} (Cópia)`;
    newProduct.internalCode = ''; 
    newProduct.barcode = '';
    handleOpenDialog(newProduct);
  };

  const handleCurrencyChange = (field: 'costPrice' | 'salePrice' | 'freightValue') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    const numericValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
    setCurrentProduct(prev => ({...prev, [field]: numericValue }));
  }

  const handlePercentageChange = (field: 'icms' | 'ipi' | 'pis' | 'cofins' | 'freightValue') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    const numericValue = rawValue ? parseFloat(rawValue) / 100 : 0;
    setCurrentProduct(prev => ({...prev, [field]: numericValue }));
  }
  
  React.useEffect(() => {
    const costPrice = currentProduct.costPrice || 0;
    const freightType = currentProduct.freightType;
    const freightValue = currentProduct.freightValue || 0;
    const markupId = currentProduct.markupId;
    
    if (costPrice > 0 && markupId) {
        const markup = markups.find(m => m.id === markupId);
        if (markup) {
            let costWithFreight = costPrice;
            if (freightType === 'fixed') {
                costWithFreight += freightValue;
            } else if (freightType === 'percentage') {
                costWithFreight *= (1 + freightValue / 100);
            }
            const salePrice = costWithFreight * (1 + markup.percentage / 100);
            setCurrentProduct(prev => ({ ...prev, salePrice }));
        }
    }
  }, [currentProduct.costPrice, currentProduct.freightType, currentProduct.freightValue, currentProduct.markupId, markups]);

  const handleSubmit = async () => {
    if (!currentProduct.name || !currentProduct.brandId || !currentProduct.productCategoryId || !currentProduct.productTypeId) {
        toast({ title: "Campos obrigatórios", description: "Preencha todos os campos obrigatórios na aba 'Dados Gerais'.", variant: "destructive" });
        return;
    }
     if (!currentProduct.ncm || !currentProduct.cfop || !currentProduct.cst || !currentProduct.origin) {
        toast({ title: "Campos de Tributação Obrigatórios", description: "Preencha NCM, CFOP, CST/CSOSN e Origem na aba 'Tributação'.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    let productId = currentProduct.id;
    try {
      let internalCode = currentProduct.internalCode || "";
      if (!isEditing) {
        const highestQuery = query(collection(db, "products"), orderBy("internalCode", "desc"), limit(1));
        const highestSnap = await getDocs(highestQuery);
        let nextCode = 1;
        if (!highestSnap.empty) {
            nextCode = parseInt(highestSnap.docs[0].data().internalCode || '0', 10) + 1;
        }
        internalCode = nextCode.toString();
      }
      
      const keywords = generateKeywords(currentProduct.name!, internalCode, currentProduct.barcode);

      const dataToSave = {
        name: currentProduct.name,
        internalCode: internalCode,
        barcode: currentProduct.barcode || '',
        brandId: currentProduct.brandId,
        productCategoryId: currentProduct.productCategoryId,
        productTypeId: currentProduct.productTypeId,
        unitOfMeasure: currentProduct.unitOfMeasure || 'UN',
        volumeQuantity: currentProduct.volumeQuantity || 1,
        costPrice: currentProduct.costPrice || 0,
        freightType: currentProduct.freightType || 'fixed',
        freightValue: currentProduct.freightValue || 0,
        salePrice: currentProduct.salePrice || 0,
        markupId: currentProduct.markupId || '',
        isActive: currentProduct.isActive === undefined ? true : currentProduct.isActive,
        ncm: currentProduct.ncm,
        cest: currentProduct.cest || '',
        cfop: currentProduct.cfop,
        cst: currentProduct.cst,
        origin: currentProduct.origin,
        icms: currentProduct.icms || 0,
        ipi: currentProduct.ipi || 0,
        pis: currentProduct.pis || 0,
        cofins: currentProduct.cofins || 0,
        keywords: keywords,
      };

      if (isEditing) {
        const docRef = doc(db, "products", productId!);
        await updateDoc(docRef, dataToSave);
        toast({ title: "Produto Atualizado!" });
      } else {
        const newDocRef = await addDoc(collection(db, "products"), { ...dataToSave, createdAt: serverTimestamp() });
        productId = newDocRef.id;
        toast({ title: "Produto Cadastrado!" });
      }

      const batch = writeBatch(db);
      for (const locationId of Object.keys(currentStock)) {
        const stockData = currentStock[locationId];
        const stockQuery = query(collection(db, "productStock"), where("productId", "==", productId), where("stockingLocationId", "==", locationId));
        const stockSnap = await getDocs(stockQuery);
        
        if (!stockSnap.empty) {
            const stockDoc = stockSnap.docs[0];
            batch.update(stockDoc.ref, {
              quantity: Number(stockData.quantity) || 0,
              minimumQuantity: Number(stockData.minimumQuantity) || 0,
              maximumQuantity: Number(stockData.maximumQuantity) || 0,
            });
        } else if (Object.values(stockData).some(v => Number(v) > 0)) {
            const newStockRef = doc(collection(db, "productStock"));
            batch.set(newStockRef, {
                productId: productId,
                stockingLocationId: locationId,
                quantity: Number(stockData.quantity) || 0,
                minimumQuantity: Number(stockData.minimumQuantity) || 0,
                maximumQuantity: Number(stockData.maximumQuantity) || 0,
            });
        }
      }
      await batch.commit();

      handleCloseDialog();
      if (searchTerm.length >= 3) handleSearch(); 
    } catch (error) {
      console.error("Error saving product/stock:", error);
      toast({ title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    const movementsQuery = query(collection(db, "stockMovements"), where("productId", "==", productToDelete.id), limit(1));
    const movementsSnap = await getDocs(movementsQuery);
    
    if (!movementsSnap.empty) {
        toast({
            title: "Exclusão não permitida",
            description: "Este produto possui um histórico de movimentação de estoque e não pode ser excluído.",
            variant: "destructive"
        });
        setProductToDelete(null);
        return;
    }

    try {
      await deleteDoc(doc(db, "products", productToDelete.id));
      
      const stockQuery = query(collection(db, "productStock"), where("productId", "==", productToDelete.id));
      const stockSnap = await getDocs(stockQuery);
      const batch = writeBatch(db);
      stockSnap.forEach(stockDoc => {
        batch.delete(stockDoc.ref);
      });
      await batch.commit();

      toast({ title: "Produto Deletado", variant: "destructive" });
      handleSearch();
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
      setProductToDelete(null);
    }
  };
  
  const handleToggleActive = async (product: Product) => {
    try {
        const docRef = doc(db, "products", product.id);
        await updateDoc(docRef, { isActive: !product.isActive });
        toast({ title: `Produto ${!product.isActive ? 'Ativado' : 'Desativado'}`});
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: !p.isActive } : p));
    } catch(error) {
        toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
  }

  const getRelationName = (collection: {id: string, name: string}[], id?: string) => {
    if (!id) return "N/A";
    return collection.find(item => item.id === id)?.name || "Inválido";
  }
  
  const getTotalStock = (productId: string) => {
    return productStocks
      .filter(s => s.productId === productId)
      .reduce((sum, s) => sum + s.quantity, 0);
  }

  const resolveHierarchy = (catId: string) => {
    const res = { category: '', group: '', subgroup: '' };
    let current = productCategories.find(c => c.id === catId);
    if (!current) return res;

    if (current.level === 'subgroup') {
        res.subgroup = current.name;
        const parent = productCategories.find(c => c.id === current?.parentId);
        if (parent) {
            res.group = parent.name;
            const grandParent = productCategories.find(c => c.id === parent.parentId);
            if (grandParent) res.category = grandParent.name;
        }
    } else if (current.level === 'group') {
        res.group = current.name;
        const parent = productCategories.find(c => c.id === current?.parentId);
        if (parent) res.category = parent.name;
    } else {
        res.category = current.name;
    }
    return res;
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const [querySnapshot, stockSnapshot] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "productStock"))
      ]);
      const allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const exportStocks = stockSnapshot.docs.map(doc => doc.data() as ProductStock);
      
      if (allProducts.length === 0) {
        toast({ title: "Nenhum produto cadastrado para exportar", variant: "destructive" });
        return;
      }

      const activeLocations = stockingLocations.filter(l => l.isActive !== false);

      const dataToExport = allProducts.map(p => {
          const { id, internalCode, barcode, name, brandId, productCategoryId, productTypeId, markupId, unitOfMeasure, volumeQuantity, costPrice, freightType, freightValue, salePrice, isActive, ncm, cest, cfop, cst, origin, icms, ipi, pis, cofins } = p;
          
          const hierarchy = resolveHierarchy(productCategoryId);
          const stockData: any = {};
          activeLocations.forEach(loc => {
              const stock = exportStocks.find(s => s.productId === p.id && s.stockingLocationId === loc.id);
              stockData[loc.name] = stock?.quantity || 0;
          });

          return {
              id,
              internalCode,
              barcode,
              name,
              brand: getRelationName(brands, brandId),
              category: hierarchy.category,
              group: hierarchy.group,
              subgroup: hierarchy.subgroup,
              type: getRelationName(productTypes, productTypeId),
              markup: getRelationName(markups, markupId),
              unitOfMeasure,
              volumeQuantity,
              costPrice: costPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
              freightType,
              freightValue: freightValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
              salePrice: salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
              isActive: isActive ? 'Sim' : 'Não',
              ncm,
              cest,
              cfop,
              cst,
              origin,
              icms: icms?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
              ipi: ipi?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
              pis: pis?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
              cofins: cofins?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
              ...stockData
          };
      });

      const json2csvParser = new Parser({ delimiter: ';' });
      const csv = json2csvParser.parse(dataToExport);

      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `catalogo_products_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Exportação concluída!" });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao exportar produtos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleExportTemplate = () => {
    const activeLocations = stockingLocations.filter(l => l.isActive !== false);
    const stockHeaders = activeLocations.map(loc => loc.name);
    
    const fields = [
      'id', 'internalCode', 'barcode', 'name', 'brand', 'category', 'group', 'subgroup', 
      'type', 'markup', 'unitOfMeasure', 'volumeQuantity', 'costPrice', 'freightType', 
      'freightValue', 'salePrice', 'isActive', 'ncm', 'cest', 'cfop', 'cst', 'origin', 
      'icms', 'ipi', 'pis', 'cofins', ...stockHeaders
    ];

    const json2csvParser = new Parser({ fields, delimiter: ';' });
    const csv = json2csvParser.parse([]);

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `modelo_importacao_produtos.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Modelo gerado com sucesso!" });
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    setImportProgress(0);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      complete: async (results) => {
        const data = results.data as any[];
        const totalRows = data.length;
        if (totalRows === 0) {
          setIsSubmitting(false);
          setImportProgress(0);
          return;
        }
        
        try {
          let batch = writeBatch(db);
          let opCount = 0;
          let updatedCount = 0;
          let createdCount = 0;

          const highestQuery = query(collection(db, "products"), orderBy("internalCode", "desc"), limit(1));
          const highestSnap = await getDocs(highestQuery);
          let nextCode = 1;
          if (!highestSnap.empty) {
              nextCode = parseInt(highestSnap.docs[0].data().internalCode || '0', 10) + 1;
          }

          const activeLocations = stockingLocations.filter(l => l.isActive !== false);
          const allCategories = [...productCategories];

          for (let i = 0; i < totalRows; i++) {
            setImportProgress(Math.round((i / totalRows) * 100));
            const row = data[i];
            if (!row.name) continue;

            const parseNum = (val: string) => {
              if (!val) return 0;
              const cleaned = val.toString().replace(/[R$\s.]/g, '').replace(',', '.');
              return parseFloat(cleaned) || 0;
            }

            const findId = (list: {id: string, name: string}[], name: string) => 
              list.find(item => item.name.toLowerCase().trim() === name?.toString().toLowerCase().trim())?.id || "";
            
            const brandId = findId(brands, row.brand);
            const typeId = findId(productTypes, row.type);
            const markupId = findId(markups, row.markup);
            
            // --- Hierarchy Creation Logic ---
            let currentParentId: string | null = null;
            let finalCatId = "";

            const hierarchyLevels: { name: string, level: 'category' | 'group' | 'subgroup' }[] = [
                { name: row.category, level: 'category' },
                { name: row.group, level: 'group' },
                { name: row.subgroup, level: 'subgroup' }
            ];

            for (const h of hierarchyLevels) {
                if (!h.name) break;
                const nameTrimmed = h.name.toString().trim();
                const level = h.level;
                
                let found = allCategories.find(c => 
                    c.name.toLowerCase() === nameTrimmed.toLowerCase() && 
                    c.level === level && 
                    c.parentId === currentParentId
                );

                if (found) {
                    currentParentId = found.id;
                    finalCatId = found.id;
                } else {
                    const newId = doc(collection(db, "productCategories")).id;
                    const newCat = {
                        id: newId,
                        name: nameTrimmed,
                        level: level,
                        parentId: currentParentId,
                        order: allCategories.filter(c => c.parentId === currentParentId).length
                    };
                    batch.set(doc(db, "productCategories", newId), newCat);
                    allCategories.push(newCat as ProductCategory);
                    currentParentId = newId;
                    finalCatId = newId;
                    opCount++;
                }
            }

            let internalCode = row.internalCode || "";
            let productId = row.id;

            let isUpdate = false;
            let productDocRef;

            if (productId) {
              const existingDoc = await getDoc(doc(db, "products", productId));
              if (existingDoc.exists()) {
                isUpdate = true;
                productDocRef = existingDoc.ref;
              }
            }

            if (!isUpdate && !internalCode) {
              internalCode = (nextCode++).toString();
            }

            const keywords = generateKeywords(row.name, internalCode, row.barcode);

            const productData = {
              name: row.name,
              internalCode: internalCode,
              barcode: row.barcode || '',
              brandId: brandId || brands[0]?.id || '',
              productCategoryId: finalCatId || productCategories[0]?.id || '',
              productTypeId: typeId || productTypes[0]?.id || '',
              unitOfMeasure: row.unitOfMeasure || 'UN',
              volumeQuantity: parseInt(row.volumeQuantity, 10) || 1,
              costPrice: parseNum(row.costPrice),
              freightType: (row.freightType as any) || 'fixed',
              freightValue: parseNum(row.freightValue),
              salePrice: parseNum(row.salePrice),
              markupId: markupId || '',
              isActive: row.isActive === 'Sim' || row.isActive === 'true' || row.isActive === true,
              ncm: row.ncm || '',
              cest: row.cest || '',
              cfop: row.cfop || '',
              cst: row.cst || '',
              origin: row.origin || '0',
              icms: parseNum(row.icms),
              ipi: parseNum(row.ipi),
              pis: parseNum(row.pis),
              cofins: parseNum(row.cofins),
              keywords: keywords,
            };

            if (isUpdate && productDocRef) {
              batch.update(productDocRef, productData);
              updatedCount++;
            } else {
              productDocRef = doc(collection(db, "products"));
              batch.set(productDocRef, { ...productData, createdAt: serverTimestamp() });
              productId = productDocRef.id;
              createdCount++;
            }
            opCount++;

            activeLocations.forEach(loc => {
              if (row[loc.name] !== undefined) {
                  const qty = parseInt(row[loc.name], 10) || 0;
                  const stockRef = doc(db, "productStock", `${productId}_${loc.id}`);
                  batch.set(stockRef, {
                      productId,
                      stockingLocationId: loc.id,
                      quantity: qty,
                  }, { merge: true });
                  opCount++;
              }
            });

            if (opCount >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              opCount = 0;
            }
          }

          if (opCount > 0) {
            await batch.commit();
          }

          setImportProgress(100);
          toast({ title: "Importação Concluída!", description: `${createdCount} criados, ${updatedCount} atualizados.` });
          fetchData();
        } catch (error) {
           console.error(error);
           toast({ title: "Erro na importação", description: "Ocorreu um erro ao processar o lote.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
            setImportProgress(0);
            if (importInputRef.current) importInputRef.current.value = "";
        }
      },
      error: () => {
        toast({ title: "Erro ao ler o arquivo", description: "Verifique o formato do CSV.", variant: "destructive" });
        setIsSubmitting(false);
        setImportProgress(0);
      }
    });
  };

  const renderActions = (product: Product) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button aria-haspopup="true" size="icon" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Toggle menu</span>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleOpenDialog(product)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDuplicate(product)}><Copy className="mr-2 h-4 w-4" />Duplicar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleToggleActive(product)}>
                {product.isActive ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                {product.isActive ? "Desativar" : "Ativar"}
            </DropdownMenuItem>
            <AlertDialogTrigger asChild>
                <DropdownMenuItem className="text-red-600" onSelect={(e) => { e.preventDefault(); setProductToDelete(product);}}>
                    <Trash2 className="mr-2 h-4 w-4" />Deletar
                </DropdownMenuItem>
            </AlertDialogTrigger>
        </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Produtos</h1>
            <p className="text-muted-foreground">Gerencie o catálogo central de produtos. Pesquise para visualizar.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportTemplate} disabled={loading}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Baixar Modelo
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={loading}>
              <Download className="mr-2 h-4 w-4" /> Exportar Tudo
            </Button>
            <Button asChild variant="outline">
              <label htmlFor="import-csv" className="cursor-pointer">
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
              <DialogContent className="max-w-3xl flex flex-col max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>{isEditing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto pr-6 scrollbar-hide">
                  <Tabs defaultValue="general">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="general">Dados Gerais</TabsTrigger>
                      <TabsTrigger value="taxation">Tributação</TabsTrigger>
                      <TabsTrigger value="stock">Estoque</TabsTrigger>
                    </TabsList>
                      <TabsContent value="general" className="mt-0">
                        <div className="grid gap-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="name">Nome do Produto</Label><Input id="name" value={currentProduct.name || ""} onChange={(e) => setCurrentProduct(p => ({...p, name: e.target.value}))} disabled={isSubmitting}/></div>
                            <div className="space-y-2">
                              <Label htmlFor="internalCode">Código Interno</Label>
                              <Input id="internalCode" value={isEditing ? currentProduct.internalCode || "" : "(gerado automaticamente)"} disabled />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2"><Label htmlFor="barcode">Código de Barras (EAN/GTIN)</Label><Input id="barcode" value={currentProduct.barcode || ""} onChange={(e) => setCurrentProduct(p => ({...p, barcode: e.target.value}))} disabled={isSubmitting}/></div>
                            <div className="space-y-2"><Label htmlFor="unitOfMeasure">Unidade de Medida</Label><Input id="unitOfMeasure" value={currentProduct.unitOfMeasure || "UN"} onChange={(e) => setCurrentProduct(p => ({...p, unitOfMeasure: e.target.value.toUpperCase()}))} className="w-24" placeholder="UN" disabled={isSubmitting}/></div>
                            <div className="space-y-2"><Label htmlFor="volumeQuantity">Qtde. Volume</Label><Input id="volumeQuantity" type="number" min="1" value={currentProduct.volumeQuantity || 1} onChange={(e) => setCurrentProduct(p => ({...p, volumeQuantity: parseInt(e.target.value, 10) || 1}))} className="w-24" disabled={isSubmitting}/></div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2"><Label>Marca</Label><Select value={currentProduct.brandId} onValueChange={(v) => setCurrentProduct(p=>({...p, brandId: v}))}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-2"><Label>Categoria</Label><Select value={currentProduct.productCategoryId} onValueChange={(v) => setCurrentProduct(p=>({...p, productCategoryId: v}))}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{productCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-2"><Label>Tipo de Produto</Label><Select value={currentProduct.productTypeId} onValueChange={handleProductTypeChange}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{productTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                          </div>
                          <div className="flex items-center space-x-2 pt-2">
                              <Switch id="isActive" checked={currentProduct.isActive} onCheckedChange={(checked) => setCurrentProduct(p => ({...p, isActive: checked }))} />
                              <Label htmlFor="isActive">Produto Ativo</Label>
                          </div>
                          <Card>
                              <CardHeader><CardTitle className="text-lg">Precificação</CardTitle></CardHeader>
                              <CardContent className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2"><Label>Preço de Custo (R$)</Label><Input value={formatCurrencyForInput(currentProduct.costPrice)} onChange={handleCurrencyChange('costPrice')} disabled={isSubmitting}/></div>
                                      <div className="space-y-2">
                                        <Label>Tipo de Frete</Label>
                                        <RadioGroup value={currentProduct.freightType} onValueChange={(v) => setCurrentProduct(p => ({...p, freightType: v as any}))} className="flex gap-4">
                                          <div className="flex items-center space-x-2"><RadioGroupItem value="fixed" id="fixed" /><Label htmlFor="fixed">Fixo (R$)</Label></div>
                                          <div className="flex items-center space-x-2"><RadioGroupItem value="percentage" id="percentage" /><Label htmlFor="percentage">Percentual (%)</Label></div>
                                        </RadioGroup>
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                      <div className="space-y-2">
                                          <Label>Valor do Frete</Label>
                                          <Input 
                                              value={currentProduct.freightType === 'percentage' ? formatPercentageForInput(currentProduct.freightValue) : formatCurrencyForInput(currentProduct.freightValue)} 
                                              onChange={currentProduct.freightType === 'percentage' ? handlePercentageChange('freightValue') : handleCurrencyChange('freightValue')} 
                                              disabled={isSubmitting}
                                          />
                                      </div>
                                      <div className="space-y-2"><Label>Markup</Label><Select value={currentProduct.markupId} onValueChange={(v) => setCurrentProduct(p=>({...p, markupId: v}))}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{markups.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.percentage}%)</SelectItem>)}</SelectContent></Select></div>
                                      <div className="space-y-2"><Label>Preço de Venda (R$)</Label><Input value={formatCurrencyForInput(currentProduct.salePrice)} onChange={handleCurrencyChange('salePrice')} disabled={isSubmitting}/></div>
                                  </div>
                              </CardContent>
                          </Card>
                        </div>
                      </TabsContent>
                      <TabsContent value="taxation" className="mt-0">
                        <div className="grid gap-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="ncm">NCM</Label><Input id="ncm" value={currentProduct.ncm || ""} onChange={(e) => setCurrentProduct(p => ({...p, ncm: e.target.value}))} disabled={isSubmitting} placeholder="Ex: 8471.30.00"/></div>
                            <div className="space-y-2"><Label htmlFor="cest">CEST (Opcional)</Label><Input id="cest" value={currentProduct.cest || ""} onChange={(e) => setCurrentProduct(p => ({...p, cest: e.target.value}))} disabled={isSubmitting} placeholder="Ex: 21.053.00"/></div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2"><Label>Origem da Mercadoria</Label><Input id="origin" value={currentProduct.origin || ""} onChange={(e) => setCurrentProduct(p=>({...p, origin: e.target.value}))} placeholder="Ex: 0" disabled={isSubmitting} /></div>
                            <div className="space-y-2"><Label>CFOP (Padrão)</Label><Input id="cfop" value={currentProduct.cfop || ""} onChange={(e) => setCurrentProduct(p=>({...p, cfop: e.target.value}))} placeholder="Ex: 5102" disabled={isSubmitting} /></div>
                            <div className="space-y-2"><Label>CST/CSOSN</Label><Input id="cst" value={currentProduct.cst || ""} onChange={(e) => setCurrentProduct(p=>({...p, cst: e.target.value}))} placeholder="Ex: 102" disabled={isSubmitting} /></div>
                          </div>
                          <Card>
                            <CardHeader><CardTitle className="text-lg">Alíquotas de Impostos</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="space-y-2"><Label>ICMS (%)</Label><Input value={formatPercentageForInput(currentProduct.icms)} onChange={handlePercentageChange('icms')} disabled={isSubmitting} placeholder="0,00"/></div>
                              <div className="space-y-2"><Label>IPI (%)</Label><Input value={formatPercentageForInput(currentProduct.ipi)} onChange={handlePercentageChange('ipi')} disabled={isSubmitting} placeholder="0,00"/></div>
                              <div className="space-y-2"><Label>PIS (%)</Label><Input value={formatPercentageForInput(currentProduct.pis)} onChange={handlePercentageChange('pis')} disabled={isSubmitting} placeholder="0,00"/></div>
                              <div className="space-y-2"><Label>COFINS (%)</Label><Input value={formatPercentageForInput(currentProduct.cofins)} onChange={handlePercentageChange('cofins')} disabled={isSubmitting} placeholder="0,00"/></div>
                            </CardContent>
                          </Card>
                        </div>
                      </TabsContent>
                      <TabsContent value="stock" className="mt-0">
                        <div className="grid gap-6 py-4">
                          {stockingLocations.map(location => (
                            <div key={location.id} className="grid grid-cols-3 gap-4 items-end">
                              <div className="col-span-3"><Label htmlFor={`stock-${location.id}`}>{location.name}</Label></div>
                              <div className="space-y-1">
                                  <Label htmlFor={`stock-qnt-${location.id}`} className="text-xs">Estoque Atual</Label>
                                  <Input 
                                    id={`stock-qnt-${location.id}`}
                                    type="number" 
                                    placeholder="0" 
                                    value={currentStock[location.id]?.quantity || ''}
                                    onChange={e => setCurrentStock(p => ({...p, [location.id]: {...p[location.id], quantity: Number(e.target.value)} }))}
                                    disabled={isSubmitting}
                                  />
                              </div>
                              <div className="space-y-1">
                                  <Label htmlFor={`stock-min-${location.id}`} className="text-xs">Estoque Mínimo</Label>
                                  <Input 
                                    id={`stock-min-${location.id}`}
                                    type="number" 
                                    placeholder="0" 
                                    value={currentStock[location.id]?.minimumQuantity || ''}
                                    onChange={e => setCurrentStock(p => ({...p, [location.id]: {...p[location.id], minimumQuantity: Number(e.target.value)} }))}
                                    disabled={isSubmitting}
                                  />
                              </div>
                              <div className="space-y-1">
                                  <Label htmlFor={`stock-max-${location.id}`} className="text-xs">Estoque Máximo</Label>
                                  <Input 
                                    id={`stock-max-${location.id}`}
                                    type="number" 
                                    placeholder="0" 
                                    value={currentStock[location.id]?.maximumQuantity || ''}
                                    onChange={e => setCurrentStock(p => ({...p, [location.id]: {...p[location.id], maximumQuantity: Number(e.target.value)} }))}
                                    disabled={isSubmitting}
                                  />
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                  </Tabs>
                </div>
                <DialogFooter className="pt-4 border-t">
                    <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Catálogo de Produtos</CardTitle>
            <CardDescription>Digite para pesquisar no catálogo. Nenhuma leitura inicial é feita.</CardDescription>
            
            {isSubmitting && importProgress > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span>Processando importação...</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            )}

            <div className="flex items-center gap-4 pt-4">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Busca por nome (várias palavras), código ou EAN..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {isSearching && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </div>
          </CardHeader>
          <CardContent>
            {searchTerm.length < 3 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
                    <Package className="h-12 w-12 mb-4 opacity-20" />
                    <p>Digite pelo menos 3 caracteres para iniciar a busca.</p>
                </div>
            ) : products.length === 0 && !isSearching ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Frown className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="font-semibold">Nenhum produto encontrado</p>
                    <p className="text-sm text-muted-foreground">Tente outros termos ou verifique a ortografia.</p>
                </div>
            ) : (
            <AlertDialog>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Cód. Interno</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-center">Estoque Total</TableHead>
                      <TableHead className="text-center">Preço de Venda</TableHead>
                      <TableHead className="w-20 text-right"><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id} className={!product.isActive ? 'bg-muted/30 text-muted-foreground' : ''}>
                        <TableCell>
                          <Badge variant={product.isActive ? "default" : "secondary"}>{product.isActive ? "Ativo" : "Inativo"}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono">{product.internalCode}</TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{getRelationName(brands, product.brandId)}</TableCell>
                        <TableCell>{getRelationName(productCategories, product.productCategoryId)}</TableCell>
                        <TableCell className="text-center font-semibold">{getTotalStock(product.id)}</TableCell>
                        <TableCell className="font-bold text-center text-primary">{formatCurrency(product.salePrice)}</TableCell>
                        <TableCell className="text-right">
                            {renderActions(product)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {productToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita e irá excluir o produto <strong className="mx-1">{productToDelete.name}</strong>.</AlertDialogDescription>
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
