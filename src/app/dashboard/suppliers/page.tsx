
"use client";

import * as React from "react";
import {
  Loader2,
  PlusCircle,
  Search,
  Trash2,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Upload,
  Download,
  CalendarDays,
  Building,
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useToast } from "@/hooks/use-toast";
import type { Supplier, Phone, Branch, User as UserType } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Papa from "papaparse";
import { Parser } from "json2csv";
import { differenceInDays, format, parseISO } from "date-fns";


// CPF validation function
const validateCPF = (cpf: string): boolean => {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    const digits = cpf.split('').map(Number);
    const validator = (n: number) => (digits.slice(0, n).reduce((sum, digit, index) => sum + digit * (n + 1 - index), 0) * 10) % 11 % 10;
    return validator(9) === digits[9] && validator(10) === digits[10];
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

const initialFormData: Partial<Supplier> = {
  type: "fisica",
  name: "",
  cpf: "",
  cnpj: "",
  inscricaoEstadual: "",
  razaoSocial: "",
  birthDate: "",
  email: "",
  phones: [{ id: `phone-${Date.now()}`, type: "celular", number: "" }],
  cep: "",
  address: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  branchId: "",
};

export default function SuppliersPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<UserType | null>(null);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Dialog state
  const [open, setOpen] = React.useState(false);
  const [currentSupplier, setCurrentSupplier] = React.useState<Partial<Supplier>>(initialFormData);
  const [itemToDelete, setItemToDelete] = React.useState<Supplier | null>(null);

  // API fetching states
  const [isFetchingCnpj, setIsFetchingCnpj] = React.useState(false);
  const [isFetchingCep, setIsFetchingCep] = React.useState(false);
  const [isFetchingIe, setIsFetchingIe] = React.useState(false);

  // Search and Pagination
  const [searchTerm, setSearchTerm] = React.useState("");
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);

  const importInputRef = React.useRef<HTMLInputElement>(null);

  const isEditing = !!currentSupplier.id;

  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [suppliersSnap, branchesSnap, userSnap] = await Promise.all([
        getDocs(query(collection(db, "suppliers"), orderBy("name"))),
        getDocs(collection(db, "branches")),
        getDoc(doc(db, "users", user.uid))
      ]);

      setSuppliers(suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
      setBranches(branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
      if (userSnap.exists()) {
        setUserData(userSnap.data() as UserType);
      }
    } catch (error) {
      toast({ title: "Erro ao buscar fornecedores", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  React.useEffect(() => {
    if (user && !authLoading) {
      fetchData();
    }
  }, [fetchData, user, authLoading]);

  const filteredSuppliers = React.useMemo(() => {
    return suppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.cpf && supplier.cpf.includes(searchTerm)) ||
      (supplier.cnpj && supplier.cnpj.includes(searchTerm)) ||
      (supplier.inscricaoEstadual && supplier.inscricaoEstadual.includes(searchTerm))
    );
  }, [suppliers, searchTerm]);

  const paginatedSuppliers = React.useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredSuppliers.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredSuppliers, currentPage, rowsPerPage]);
  
  const totalPages = Math.ceil(filteredSuppliers.length / rowsPerPage);

  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
        const supplierData = JSON.parse(JSON.stringify(supplier));
        supplierData.branchId = supplierData.branchId || "";
        setCurrentSupplier(supplierData);
    } else {
        const initialDataWithBranch = { ...initialFormData, branchId: userData?.branchId || "" };
        setCurrentSupplier(initialDataWithBranch);
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setCurrentSupplier(initialFormData);
  };

  const fetchCnpjData = async () => {
    const cnpj = currentSupplier.cnpj?.replace(/\D/g, '');
    if (!cnpj || cnpj.length !== 14) {
      toast({ title: "CNPJ inválido", variant: "destructive" });
      return;
    }
    setIsFetchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!response.ok) throw new Error("CNPJ não encontrado");
      const data = await response.json();
      
      setCurrentSupplier(prev => ({
        ...prev,
        razaoSocial: data.razao_social || '',
        name: data.nome_fantasia || data.razao_social || '',
        cep: data.cep?.replace(/\D/g, '') || '',
        address: data.logradouro || '',
        number: data.numero || '',
        complement: data.complemento || '',
        neighborhood: data.bairro || '',
        city: data.municipio || '',
        state: data.uf || '',
      }));
      if (data.uf && cnpj) {
        await fetchIeData(cnpj, data.uf);
      }
    } catch (error) {
      toast({ title: "Erro ao buscar CNPJ", variant: "destructive" });
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  const fetchIeData = async (cnpj: string, uf: string) => {
    if (!cnpj || !uf) {
       toast({ title: "CNPJ e UF são necessários para buscar a IE.", variant: "destructive" });
       return;
    }
    setIsFetchingIe(true);
    try {
        const response = await fetch(`https://brasilapi.com.br/api/sintegra/v1/${uf}/${cnpj.replace(/\D/g, '')}`);
        if(!response.ok) throw new Error("Consulta de IE falhou.");
        const data = await response.json();
        if (data && data.inscricao_estadual) {
            setCurrentSupplier(prev => ({...prev, inscricaoEstadual: data.inscricao_estadual}));
        } else {
            toast({ title: "Inscrição Estadual não encontrada", description: "Verifique o CNPJ e a UF ou insira manualmente.", variant: "default" });
        }
    } catch(error) {
         toast({ title: "Erro ao buscar IE", variant: "destructive" });
    } finally {
        setIsFetchingIe(false);
    }
  };

  const fetchCepData = async () => {
    const cep = currentSupplier.cep?.replace(/\D/g, '');
    if (!cep || cep.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error("CEP não encontrado");
      const data = await response.json();
      if (data.erro) throw new Error("CEP não encontrado");
      setCurrentSupplier(prev => ({
        ...prev,
        address: data.logradouro,
        neighborhood: data.bairro,
        city: data.localidade,
        state: data.uf,
      }));
    } catch (error) {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleAddPhone = () => {
    if (currentSupplier.phones && currentSupplier.phones.length < 3) {
      setCurrentSupplier(prev => ({
        ...prev,
        phones: [...(prev.phones || []), { id: `phone-${Date.now()}`, type: 'celular', number: '' }]
      }));
    }
  };

  const handleRemovePhone = (id: string) => {
    setCurrentSupplier(prev => ({
      ...prev,
      phones: (prev.phones || []).filter(p => p.id !== id)
    }));
  };

  const handlePhoneChange = (id: string, field: 'type' | 'number', value: string) => {
    setCurrentSupplier(prev => ({
      ...prev,
      phones: (prev.phones || []).map(p => p.id === id ? { ...p, [field]: value } : p)
    }));
  };

  const handleSubmit = async () => {
    if (!currentSupplier.name || (currentSupplier.type === 'fisica' && !currentSupplier.cpf) || (currentSupplier.type === 'juridica' && !currentSupplier.cnpj)) {
      toast({ title: "Campos obrigatórios", description: "Nome e documento são obrigatórios.", variant: "destructive" });
      return;
    }
    if (currentSupplier.type === 'fisica' && !validateCPF(currentSupplier.cpf || '')) {
      toast({ title: "CPF Inválido", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
        const dataToSave: Omit<Supplier, 'id' | 'createdAt'> & { createdAt?: any } = {
            ...initialFormData,
            ...currentSupplier,
            phones: currentSupplier.phones || [],
            branchId: isEditing ? currentSupplier.branchId || '' : userData?.branchId || '',
            createdById: user?.uid || 'unknown',
            createdByName: user?.displayName || 'Sistema',
        } as any;

        if (isEditing) {
            delete dataToSave.createdAt;
            const docRef = doc(db, "suppliers", currentSupplier.id!);
            await updateDoc(docRef, dataToSave as any);
            toast({ title: "Fornecedor atualizado!" });
        } else {
            dataToSave.createdAt = serverTimestamp();
            await addDoc(collection(db, "suppliers"), dataToSave);
            toast({ title: "Fornecedor cadastrado!" });
        }
        handleCloseDialog();
        fetchData();
    } catch (error) {
        toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
        await deleteDoc(doc(db, "suppliers", itemToDelete.id));
        toast({ title: "Fornecedor excluído!", variant: "destructive" });
        fetchData();
    } catch (error) {
        toast({ title: "Erro ao excluir", variant: "destructive" });
    } finally {
        setItemToDelete(null);
    }
  };

  const handleExport = () => {
    if (suppliers.length === 0) {
      toast({ title: "Nenhum fornecedor para exportar", variant: "destructive" });
      return;
    }
    
    const dataToExport = suppliers.map(c => ({
        ...c,
        phones: c.phones.map(p => `${p.type}:${p.number}`).join('|')
    }));

    const json2csvParser = new Parser({ delimiter: ';' });
    const csv = json2csvParser.parse(dataToExport);

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `fornecedores_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
   const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      complete: async (results) => {
        const data = results.data as any[];
        
        try {
          const batch = writeBatch(db);
          let updatedCount = 0;
          let createdCount = 0;
          
          for (const row of data) {
              if (row.name && (row.cpf || row.cnpj)) {
                  const phones: Phone[] = (row.phones || '').split('|').filter(Boolean).map((p: string, index: number) => {
                    const [type, number] = p.split(':');
                    return { id: `imported-${index}`, type, number };
                  });

                  const supplierData: Partial<Omit<Supplier, 'id' | 'createdAt'>> = {
                    ...row,
                    phones: phones,
                  };
                  
                  if (row.id && suppliers.some(c => c.id === row.id)) {
                    const docRef = doc(db, "suppliers", row.id);
                    batch.update(docRef, supplierData);
                    updatedCount++;
                  } else {
                    const docRef = doc(collection(db, "suppliers"));
                    batch.set(docRef, { ...supplierData, createdAt: serverTimestamp() });
                    createdCount++;
                  }
              }
          }

          if (updatedCount === 0 && createdCount === 0) {
             toast({ title: "Nenhuma linha válida encontrada", description: "Verifique o formato da planilha.", variant: "destructive" });
             setIsSubmitting(false);
             return;
          }

          await batch.commit();
          toast({
            title: "Importação Concluída!",
            description: `${createdCount} fornecedor(es) criado(s) e ${updatedCount} atualizado(s).`,
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

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Fornecedores</h1>
            <p className="text-muted-foreground">Gerencie sua base de fornecedores.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={loading}>
              <Download className="mr-2 h-4 w-4" /> Exportar
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
            <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Novo Fornecedor</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Fornecedores</CardTitle>
            <CardDescription>
              {filteredSuppliers.length} de {suppliers.length} fornecedores encontrados.
            </CardDescription>
            <div className="flex items-center gap-4 pt-4">
                <Input
                    placeholder="Buscar por nome, CPF/CNPJ ou IE..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="flex-1"
                />
            </div>
          </CardHeader>
          <CardContent>
            {loading || authLoading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
                <AlertDialog>
                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome / Razão Social</TableHead>
                                    <TableHead>Documento</TableHead>
                                    <TableHead>Filial</TableHead>
                                    <TableHead>Data Cadastro</TableHead>
                                    <TableHead>Usuário Cadastro</TableHead>
                                    <TableHead>Dias Cadastrado</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedSuppliers.map(supplier => {
                                    const daysSinceCreation = supplier.createdAt?.toDate ? differenceInDays(new Date(), supplier.createdAt.toDate()) : 0;
                                    return (
                                        <TableRow key={supplier.id}>
                                            <TableCell className="font-medium">{supplier.name}</TableCell>
                                            <TableCell>{supplier.cpf || supplier.cnpj}</TableCell>
                                            <TableCell>{branches.find(b => b.id === supplier.branchId)?.name || 'N/A'}</TableCell>
                                            <TableCell>{supplier.createdAt?.toDate ? format(supplier.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                            <TableCell>{supplier.createdByName || 'N/A'}</TableCell>
                                            <TableCell>{daysSinceCreation} dias</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(supplier)}>Editar</Button>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setItemToDelete(supplier)}>Excluir</Button>
                                                </AlertDialogTrigger>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    {itemToDelete && (
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita e irá excluir o fornecedor <strong className="mx-1">{itemToDelete.name}</strong>.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete}>Sim, excluir</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    )}
                </AlertDialog>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
                <div className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                </div>
                <div className="flex items-center gap-2">
                     <Select value={rowsPerPage.toString()} onValueChange={(value) => setRowsPerPage(Number(value))}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {[10, 25, 50, 100].map(size => <SelectItem key={size} value={size.toString()}>{size} por página</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}><ChevronsLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages}><ChevronsRight className="h-4 w-4" /></Button>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl w-[95vw] sm:w-full" onCloseAutoFocus={handleCloseDialog}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
            <DialogDescription>Preencha os dados abaixo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4 max-h-[80vh] sm:max-h-[70vh] overflow-y-auto pr-4">
            <RadioGroup value={currentSupplier.type} onValueChange={(v) => setCurrentSupplier(p => ({...p!, type: v as any}))} className="flex gap-4">
              <div className="flex items-center space-x-2"><RadioGroupItem value="fisica" id="fisica"/><Label htmlFor="fisica">Pessoa Física</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="juridica" id="juridica"/><Label htmlFor="juridica">Pessoa Jurídica</Label></div>
            </RadioGroup>

            {isEditing && (
                <div className="space-y-1">
                    <Label htmlFor="branchId">Filial de Cadastro</Label>
                    <Select value={currentSupplier.branchId || ""} onValueChange={(value) => setCurrentSupplier(p => ({...p!, branchId: value}))}>
                        <SelectTrigger><SelectValue placeholder="Selecione uma filial" /></SelectTrigger>
                        <SelectContent>
                            {branches.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}


            {currentSupplier.type === 'juridica' ? (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1"><Label htmlFor="cnpj">CNPJ</Label><Input id="cnpj" value={currentSupplier.cnpj || ''} onChange={e => setCurrentSupplier(p => ({...p!, cnpj: e.target.value}))}/></div>
                        <Button onClick={fetchCnpjData} disabled={isFetchingCnpj}>{isFetchingCnpj ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}</Button>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1"><Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label><Input id="inscricaoEstadual" value={currentSupplier.inscricaoEstadual || ''} onChange={e => setCurrentSupplier(p => ({...p!, inscricaoEstadual: e.target.value}))}/></div>
                      <Button onClick={() => fetchIeData(currentSupplier.cnpj || '', currentSupplier.state || '')} disabled={isFetchingIe || !currentSupplier.cnpj || !currentSupplier.state}><Search className="h-4 w-4"/></Button>
                    </div>
                </div>
                <div className="space-y-1"><Label htmlFor="razaoSocial">Razão Social</Label><Input id="razaoSocial" value={currentSupplier.razaoSocial || ''} onChange={e => setCurrentSupplier(p => ({...p!, razaoSocial: e.target.value}))}/></div>
                <div className="space-y-1"><Label htmlFor="name_juridica">Nome Fantasia</Label><Input id="name_juridica" value={currentSupplier.name || ''} onChange={e => setCurrentSupplier(p => ({...p!, name: e.target.value}))}/></div>
                </>
            ) : (
                <>
                <div className="space-y-1"><Label htmlFor="name_fisica">Nome Completo</Label><Input id="name_fisica" value={currentSupplier.name || ''} onChange={e => setCurrentSupplier(p => ({...p!, name: e.target.value}))}/></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1"><Label htmlFor="cpf">CPF</Label><Input id="cpf" value={currentSupplier.cpf || ''} onChange={e => setCurrentSupplier(p => ({...p!, cpf: e.target.value}))}/></div>
                  <div className="space-y-1"><Label htmlFor="birthDate">Data de Nascimento</Label><Input id="birthDate" type="date" value={currentSupplier.birthDate || ''} onChange={e => setCurrentSupplier(p => ({...p!, birthDate: e.target.value}))}/></div>
                </div>
                </>
            )}

            <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={currentSupplier.email || ''} onChange={e => setCurrentSupplier(p => ({...p!, email: e.target.value}))}/></div>

            <div className="space-y-4">
              <Label>Telefones</Label>
              {currentSupplier.phones?.map((phone) => (
                <div key={phone.id} className="flex items-end gap-2">
                    <div className="w-40 space-y-1"><Label>Tipo</Label><Select value={phone.type} onValueChange={(v) => handlePhoneChange(phone.id, 'type', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="celular">Celular</SelectItem><SelectItem value="fixo">Fixo</SelectItem><SelectItem value="comercial">Comercial</SelectItem></SelectContent></Select></div>
                    <div className="flex-1 space-y-1"><Label>Número</Label><Input value={formatPhone(phone.number)} onChange={(e) => handlePhoneChange(phone.id, 'number', e.target.value)} /></div>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleRemovePhone(phone.id)}><Trash2 className="h-4 w-4"/></Button>
                </div>
              ))}
              {currentSupplier.phones && currentSupplier.phones.length < 3 && <Button variant="outline" size="sm" onClick={handleAddPhone}><PlusCircle className="mr-2 h-4 w-4"/>Adicionar Telefone</Button>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 space-y-1">
                    <Label htmlFor="cep">CEP</Label>
                    <div className="flex items-center gap-2"><Input id="cep" value={currentSupplier.cep || ''} onChange={e => setCurrentSupplier(p => ({...p!, cep: e.target.value}))}/><Button onClick={fetchCepData} disabled={isFetchingCep} size="icon">{isFetchingCep ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}</Button></div>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1"><Label htmlFor="address">Endereço</Label><Input id="address" value={currentSupplier.address || ''} onChange={e => setCurrentSupplier(p => ({...p!, address: e.target.value}))}/></div>
              <div className="md:col-span-1 space-y-1"><Label htmlFor="number">Número</Label><Input id="number" value={currentSupplier.number || ''} onChange={e => setCurrentSupplier(p => ({...p!, number: e.target.value}))}/></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1 space-y-1"><Label htmlFor="complement">Complemento</Label><Input id="complement" value={currentSupplier.complement || ''} onChange={e => setCurrentSupplier(p => ({...p!, complement: e.target.value}))}/></div>
              <div className="md:col-span-2 space-y-1"><Label htmlFor="neighborhood">Bairro</Label><Input id="neighborhood" value={currentSupplier.neighborhood || ''} onChange={e => setCurrentSupplier(p => ({...p!, neighborhood: e.target.value}))}/></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1"><Label htmlFor="city">Cidade</Label><Input id="city" value={currentSupplier.city || ''} onChange={e => setCurrentSupplier(p => ({...p!, city: e.target.value}))}/></div>
              <div className="md:col-span-1 space-y-1"><Label htmlFor="state">Estado (UF)</Label><Input id="state" value={currentSupplier.state || ''} onChange={e => setCurrentSupplier(p => ({...p!, state: e.target.value}))}/></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
