
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
  Pencil,
  Check,
  Contact,
  Home as HomeIcon,
  Phone as PhoneIcon,
  ChevronDown,
  Frown,
  FileSpreadsheet,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Phone, Branch, User as UserType, Address } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Progress } from "@/components/ui/progress";
import Papa from "papaparse";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  limit, 
  startAfter, 
  orderBy, 
  serverTimestamp, 
  setDoc,
  writeBatch,
  QueryDocumentSnapshot,
  DocumentData
} from "firebase/firestore";

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
    residenceType: undefined,
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

export default function CustomersPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<UserType | null>(null);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = React.useState(true);

  // Dialog state
  const [open, setOpen] = React.useState(false);
  const [currentCustomer, setCurrentCustomer] = React.useState<Partial<Customer>>(initialFormData);
  const [itemToDelete, setItemToDelete] = React.useState<Customer | null>(null);

  const [isFetchingCep, setIsFetchingCep] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");

  const importInputRef = React.useRef<HTMLInputElement>(null);
  const isEditing = !!currentCustomer.id;

  const fetchMetaData = React.useCallback(async (uid: string) => {
    try {
      setLoading(true);
      const [branchesSnap, userSnap] = await Promise.all([
        getDocs(collection(db, "branches")),
        getDoc(doc(db, "users", uid))
      ]);

      setBranches(branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
      if (userSnap.exists()) {
        setUserData(userSnap.data() as UserType);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (user && !authLoading) {
      fetchMetaData(user.uid);
    }
  }, [fetchMetaData, user, authLoading]);

  const handleSearch = React.useCallback(async (lastDoc: QueryDocumentSnapshot<DocumentData> | null = null) => {
    const term = searchTerm.trim();
    if (term.length < 3) {
      setCustomers([]);
      setLastVisible(null);
      setIsLastPage(true);
      return;
    }

    setIsSearching(true);
    try {
      const customersRef = collection(db, "customers");
      
      // Perform multiple prefix searches to catch different casings (Firestore sensitivity workaround)
      const termLower = term.toLowerCase();
      const termCapitalized = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();
      const termUpper = term.toUpperCase();
      const searchTerms = Array.from(new Set([term, termLower, termCapitalized, termUpper]));

      const queries = searchTerms.map(t => 
        query(
            customersRef,
            where("name", ">=", t),
            where("name", "<=", t + "\uf8ff"),
            limit(50)
        )
      );

      const snapshots = await Promise.all(queries.map(q => getDocs(q)));
      
      const resultsMap = new Map<string, Customer>();
      snapshots.forEach(snap => {
          snap.docs.forEach(doc => {
              resultsMap.set(doc.id, { id: doc.id, ...doc.data() } as Customer);
          });
      });

      let results = Array.from(resultsMap.values());

      // Tenta pesquisa por prefixo em documentos (pontuação digitada ou somente números) se o termo possuir números
      if (!lastDoc && results.length < 10) {
          const hasNumbers = /\d/.test(term);
          if (hasNumbers) {
            const cleanTerm = term.replace(/\D/g, '');
            const queries = [
                query(customersRef, where("cpf", ">=", term), where("cpf", "<=", term + "\uf8ff"), limit(10)),
                query(customersRef, where("cnpj", ">=", term), where("cnpj", "<=", term + "\uf8ff"), limit(10))
            ];
            
            if (term !== cleanTerm && cleanTerm.length > 0) {
                queries.push(query(customersRef, where("cpf", ">=", cleanTerm), where("cpf", "<=", cleanTerm + "\uf8ff"), limit(10)));
                queries.push(query(customersRef, where("cnpj", ">=", cleanTerm), where("cnpj", "<=", cleanTerm + "\uf8ff"), limit(10)));
            }

            const snaps = await Promise.all(queries.map(q => getDocs(q)));
            snaps.forEach(snap => {
                snap.docs.forEach(d => {
                    if(!resultsMap.has(d.id)) results.push({id: d.id, ...d.data()} as Customer);
                });
            });
          }
      }

      // Sort results by name
      results.sort((a, b) => a.name.localeCompare(b.name));

      setCustomers(results);
      setLastVisible(null);
      setIsLastPage(true); // Disable Load More for merged results

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
        handleSearch(null);
      } else if (searchTerm.trim().length === 0) {
        setCustomers([]);
        setIsLastPage(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, handleSearch]);

  const handleOpenDialog = (customer?: Customer) => {
    if (customer) {
        const customerData = JSON.parse(JSON.stringify(customer));
        customerData.phones = (customerData.phones || []).map((p: any, i: number) => ({ ...p, id: p.id || `phone-${Date.now()}-${i}` }));
        customerData.addresses = (customerData.addresses && customerData.addresses.length > 0) 
          ? customerData.addresses.map((a: any, i: number) => ({ ...a, id: a.id || `address-${Date.now()}-${i}` }))
          : [{...initialAddress, id: `address-${Date.now()}`}];
        
        setCurrentCustomer(customerData);
    } else {
        setCurrentCustomer({
            ...initialFormData,
            phones: [{ id: `phone-${Date.now()}`, type: "celular", number: "" }],
            addresses: [{...initialAddress, id: `address-${Date.now()}`}],
            branchId: userData?.branchId || ""
        });
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setCurrentCustomer(initialFormData);
  };

  const fetchCepData = async (addressId: string) => {
    const address = currentCustomer.addresses?.find(a => a.id === addressId);
    if (!address || !address.cep) return;
    const cep = address.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setIsFetchingCep(addressId);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error("CEP não encontrado");
      const data = await response.json();
      if (data.erro) throw new Error("CEP não encontrado");

      setCurrentCustomer(prev => ({
          ...prev,
          addresses: (prev.addresses || []).map(a => a.id === addressId ? {
              ...a,
              address: data.logradouro,
              neighborhood: data.bairro,
              city: data.localidade,
              state: data.uf,
          } : a)
      }));
    } catch (error) {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    } finally {
      setIsFetchingCep(null);
    }
  };

  const handleAddPhone = () => {
    setCurrentCustomer(prev => ({
      ...prev,
      phones: [...(prev.phones || []), { id: `phone-${Date.now()}`, type: 'celular', number: '' }]
    }));
  };

  const handleRemovePhone = (id: string) => {
    setCurrentCustomer(prev => ({
      ...prev,
      phones: (prev.phones || []).filter(p => p.id !== id)
    }));
  };

  const handlePhoneChange = (id: string, field: 'type' | 'number', value: string) => {
    setCurrentCustomer(prev => ({
      ...prev,
      phones: (prev.phones || []).map(p => p.id === id ? { ...p, [field]: value } : p)
    }));
  };
  
  const handleAddAddress = () => {
     setCurrentCustomer(prev => ({
       ...prev,
       addresses: [...(prev?.addresses || []), {...initialAddress, id: `address-${Date.now()}`}]
     }));
  }

  const handleRemoveAddress = (id: string) => {
    if (currentCustomer.addresses && currentCustomer.addresses.length <= 1) {
        toast({ title: "Ação não permitida", description: "O cliente deve ter ao menos um endereço.", variant: "destructive"});
        return;
    }
    setCurrentCustomer(prev => ({
        ...prev,
        addresses: (prev.addresses || []).filter(a => a.id !== id)
    }));
  };
  
  const handleAddressChange = (id: string, field: keyof Address, value: string) => {
      setCurrentCustomer(prev => ({
          ...prev,
          addresses: (prev.addresses || []).map(a => a.id === id ? { ...a, [field]: value } : a)
      }));
  };

  const handleSubmit = async () => {
    if (!currentCustomer.name) {
      toast({ title: "Campos obrigatórios", description: "Nome é obrigatório.", variant: "destructive" });
      return;
    }

    const invalidAddress = currentCustomer.addresses?.find(a => !a.residenceType);
    if (invalidAddress) {
      toast({ title: "Campos obrigatórios", description: "O tipo de residência é obrigatório para todos os endereços.", variant: "destructive" });
      return;
    }

    const docValue = currentCustomer.type === 'fisica' ? currentCustomer.cpf : currentCustomer.cnpj;
    const cleanDoc = docValue?.replace(/\D/g, '') || '';
    
    if (!cleanDoc) {
        toast({ title: "Documento obrigatório", description: "CPF ou CNPJ é obrigatório.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    try {
        const dataToSave: any = {
            type: currentCustomer.type,
            name: currentCustomer.name,
            email: currentCustomer.email || "",
            birthDate: currentCustomer.birthDate || "",
            phones: (currentCustomer.phones || []).map(({ id, ...rest }: any) => rest),
            addresses: (currentCustomer.addresses || []).map(({ id, ...rest }: any) => rest),
            branchId: currentCustomer.branchId || userData?.branchId || "",
        };

        if (currentCustomer.type === 'fisica') {
            dataToSave.cpf = currentCustomer.cpf;
            dataToSave.cnpj = "";
            dataToSave.razaoSocial = "";
            dataToSave.inscricaoEstadual = "";
        } else {
            dataToSave.cnpj = currentCustomer.cnpj;
            dataToSave.cpf = "";
            dataToSave.razaoSocial = currentCustomer.razaoSocial || "";
            dataToSave.inscricaoEstadual = currentCustomer.inscricaoEstadual || "";
        }

        if (isEditing) {
            await updateDoc(doc(db, "customers", currentCustomer.id!), dataToSave);
            toast({ title: "Cadastro atualizado!" });
        } else {
            dataToSave.createdAt = serverTimestamp();
            dataToSave.createdById = user?.uid || 'unknown';
            dataToSave.createdByName = userData?.name || 'Sistema';
            
            await setDoc(doc(db, "customers", cleanDoc), dataToSave);
            toast({ title: "Cadastro criado!" });
        }
        handleCloseDialog();
        handleSearch(null);
    } catch (error) {
        toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
        await deleteDoc(doc(db, "customers", itemToDelete.id));
        toast({ title: "Cliente excluído!", variant: "destructive" });
        handleSearch(null);
    } catch (error) {
        toast({ title: "Erro ao excluir", variant: "destructive" });
    } finally {
        setItemToDelete(null);
    }
  };

  const handleExport = async () => {
    const snap = await getDocs(collection(db, "customers"));
    const customers = snap.docs.map(doc => doc.data() as Customer);
    
    if (customers.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }

    const flattenedData = customers.map(c => {
        const flat: any = {
            ID: c.id || "",
            Tipo: c.type || "",
            Nome: c.name || "",
            Email: c.email || "",
            Data_Nascimento: c.birthDate || "",
            CPF: c.cpf || "",
            CNPJ: c.cnpj || "",
            Razao_Social: c.razaoSocial || "",
            IE: c.inscricaoEstadual || "",
            Filial: branches.find(b => b.id === c.branchId)?.name || c.branchId || "",
            Criado_Por_ID: c.createdById || "",
            Criado_Por_Nome: c.createdByName || "",
            Criado_Em: c.createdAt?.toDate ? c.createdAt.toDate().toISOString() : (c.createdAt || ""),
        };

        // Telefones (até 2)
        flat.Fone1_Tipo = c.phones?.[0]?.type || "";
        flat.Fone1_Numero = c.phones?.[0]?.number || "";
        flat.Fone2_Tipo = c.phones?.[1]?.type || "";
        flat.Fone2_Numero = c.phones?.[1]?.number || "";

        // Endereços (até 2)
        [0, 1].forEach(i => {
            const addr = c.addresses?.[i];
            const prefix = `End${i + 1}`;
            flat[`${prefix}_Tipo`] = addr?.type || "";
            flat[`${prefix}_CEP`] = addr?.cep || "";
            flat[`${prefix}_Logradouro`] = addr?.address || "";
            flat[`${prefix}_Numero`] = addr?.number || "";
            flat[`${prefix}_Complemento`] = addr?.complement || "";
            flat[`${prefix}_Bairro`] = addr?.neighborhood || "";
            flat[`${prefix}_Cidade`] = addr?.city || "";
            flat[`${prefix}_UF`] = addr?.state || "";
            flat[`${prefix}_Tipo_Residencia`] = addr?.residenceType || "";
        });

        return flat;
    });

    const columns = [
        "ID", "Tipo", "Nome", "Email", "Data_Nascimento", "CPF", "CNPJ", "Razao_Social", "IE", "Filial",
        "Criado_Por_ID", "Criado_Por_Nome", "Criado_Em",
        "Fone1_Tipo", "Fone1_Numero", "Fone2_Tipo", "Fone2_Numero",
        "End1_Tipo", "End1_CEP", "End1_Logradouro", "End1_Numero", "End1_Complemento", "End1_Bairro", "End1_Cidade", "End1_UF", "End1_Tipo_Residencia",
        "End2_Tipo", "End2_CEP", "End2_Logradouro", "End2_Numero", "End2_Complemento", "End2_Bairro", "End2_Cidade", "End2_UF", "End2_Tipo_Residencia"
    ];

    const csv = Papa.unparse({
        fields: columns,
        data: flattenedData
    }, { delimiter: ';' });
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `clientes_completo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        ID: "",
        Tipo: "fisica",
        Nome: "João Exemplo",
        Email: "joao@exemplo.com",
        Data_Nascimento: "1990-01-01",
        CPF: "123.456.789-01",
        CNPJ: "",
        Razao_Social: "",
        IE: "",
        Filial: branches[0]?.name || "Matriz",
        Criado_Por_ID: "",
        Criado_Por_Nome: "",
        Criado_Em: "",
        Fone1_Tipo: "celular",
        Fone1_Numero: "(11) 99999-9999",
        Fone2_Tipo: "fixo",
        Fone2_Numero: "(11) 4444-4444",
        End1_Tipo: "Residencial",
        End1_CEP: "01001-000",
        End1_Logradouro: "Praça da Sé",
        End1_Numero: "100",
        End1_Complemento: "Apto 10",
        End1_Bairro: "Sé",
        End1_Cidade: "São Paulo",
        End1_UF: "SP",
        End1_Tipo_Residencia: "Apartamento",
        End2_Tipo: "",
        End2_CEP: "",
        End2_Logradouro: "",
        End2_Numero: "",
        End2_Complemento: "",
        End2_Bairro: "",
        End2_Cidade: "",
        End2_UF: "",
        End2_Tipo_Residencia: ""
      },
      {
        ID: "",
        Tipo: "juridica",
        Nome: "Empresa Exemplo LTDA",
        Email: "contato@empresa.com",
        Data_Nascimento: "",
        CPF: "",
        CNPJ: "12.345.678/0001-90",
        Razao_Social: "Empresa de Exemplo Serviços LTDA",
        IE: "123456789",
        Filial: branches[0]?.name || "Matriz",
        Criado_Por_ID: "",
        Criado_Por_Nome: "",
        Criado_Em: "",
        Fone1_Tipo: "comercial",
        Fone1_Numero: "(11) 3333-3333",
        Fone2_Tipo: "",
        Fone2_Numero: "",
        End1_Tipo: "Comercial",
        End1_CEP: "01310-100",
        End1_Logradouro: "Avenida Paulista",
        End1_Numero: "1500",
        End1_Complemento: "Sala 501",
        End1_Bairro: "Bela Vista",
        End1_Cidade: "São Paulo",
        End1_UF: "SP",
        End1_Tipo_Residencia: "Sobrado",
        End2_Tipo: "",
        End2_CEP: "",
        End2_Logradouro: "",
        End2_Numero: "",
        End2_Complemento: "",
        End2_Bairro: "",
        End2_Cidade: "",
        End2_UF: "",
        End2_Tipo_Residencia: ""
      }
    ];

    const columns = [
        "ID", "Tipo", "Nome", "Email", "Data_Nascimento", "CPF", "CNPJ", "Razao_Social", "IE", "Filial",
        "Criado_Por_ID", "Criado_Por_Nome", "Criado_Em",
        "Fone1_Tipo", "Fone1_Numero", "Fone2_Tipo", "Fone2_Numero",
        "End1_Tipo", "End1_CEP", "End1_Logradouro", "End1_Numero", "End1_Complemento", "End1_Bairro", "End1_Cidade", "End1_UF", "End1_Tipo_Residencia",
        "End2_Tipo", "End2_CEP", "End2_Logradouro", "End2_Numero", "End2_Complemento", "End2_Bairro", "End2_Cidade", "End2_UF", "End2_Tipo_Residencia"
    ];

    const csv = Papa.unparse({ fields: columns, data: templateData }, { delimiter: ';' });
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "modelo_importacao_clientes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      complete: async (results) => {
        const data = results.data as any[];
        const total = data.length;
        if (total === 0) {
            setIsImporting(false);
            return;
        }

        try {
          let batch = writeBatch(db);
          let count = 0;
          let processedCount = 0;
          let errorCount = 0;
          
          const normalizeDate = (dateStr: string) => {
              if (!dateStr) return "";
              const clean = dateStr.trim();
              // Se já estiver no formato YYYY-MM-DD, retorna original
              if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
              // Se estiver no formato DD/MM/YYYY, converte
              const dmy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
              if (dmy) {
                  const day = dmy[1].padStart(2, '0');
                  const month = dmy[2].padStart(2, '0');
                  const year = dmy[3];
                  return `${year}-${month}-${day}`;
              }
              return clean;
          };
          
          for (let i = 0; i < total; i++) {
              const row = data[i];
              const rawId = (row.CPF || row.CNPJ || row.ID || row.cpf || row.cnpj || row.id || '').toString().trim();
              const name = row.Nome || row.name;
              
              if (name && rawId) {
                  // Lógica inteligente de ID: limpa se for documento, mantém se for UUID
                  const cleanDigits = rawId.replace(/\D/g, '');
                  const finalDocId = (cleanDigits.length === 11 || cleanDigits.length === 14) ? cleanDigits : rawId;

                  const getSafeUUID = () => {
                      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
                      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                  };

                  // Processa Telefones
                  const phones: Phone[] = [];
                  const f1_num = row.Fone1_Numero || row.phone1_number;
                  const f1_type = row.Fone1_Tipo || row.phone1_type;
                  if (f1_num) {
                      phones.push({ id: getSafeUUID(), type: (f1_type || 'celular') as any, number: f1_num });
                  }
                  const f2_num = row.Fone2_Numero || row.phone2_number;
                  const f2_type = row.Fone2_Tipo || row.phone2_type;
                  if (f2_num) {
                      phones.push({ id: getSafeUUID(), type: (f2_type || 'celular') as any, number: f2_num });
                  }

                  // Processa Endereços
                  const addresses: Address[] = [];
                  [1, 2].forEach(idx => {
                      const prefixPT = `End${idx}`;
                      const prefixEN = `address${idx}`;
                      const addr = row[`${prefixPT}_Logradouro`] || row[`${prefixEN}_address`];
                      const cep = row[`${prefixPT}_CEP`] || row[`${prefixEN}_cep`];

                      if (addr || cep) {
                          addresses.push({
                              id: getSafeUUID(),
                              type: (row[`${prefixPT}_Tipo`] || row[`${prefixEN}_type`] || (idx === 1 ? 'Residencial' : 'Comercial')) as any,
                              cep: cep || "",
                              address: addr || "",
                              number: row[`${prefixPT}_Numero`] || row[`${prefixEN}_number`] || "",
                              complement: row[`${prefixPT}_Complemento`] || row[`${prefixEN}_complement`] || "",
                              neighborhood: row[`${prefixPT}_Bairro`] || row[`${prefixEN}_neighborhood`] || "",
                              city: row[`${prefixPT}_Cidade`] || row[`${prefixEN}_city`] || "",
                              state: row[`${prefixPT}_UF`] || row[`${prefixEN}_state`] || "",
                              residenceType: (row[`${prefixPT}_Tipo_Residencia`] || row[`${prefixEN}_residenceType`]) as any || ""
                          });
                      }
                  });

                  const branchVal = row.Filial || row.branchId;
                  const customerData: any = {
                    type: (row.Tipo || row.type) || (row.CNPJ || row.cnpj ? 'juridica' : 'fisica'),
                    name: name,
                    email: row.Email || row.email || "",
                    birthDate: normalizeDate(row.Data_Nascimento || row.birthDate || ""),
                    cpf: row.CPF || row.cpf || "",
                    cnpj: row.CNPJ || row.cnpj || "",
                    razaoSocial: row.Razao_Social || row.razaoSocial || "",
                    inscricaoEstadual: row.IE || row.inscricaoEstadual || "",
                    phones,
                    addresses,
                    branchId: branches.find(b => b.name.toLowerCase() === (branchVal || "").toString().toLowerCase())?.id || branchVal || userData?.branchId || "",
                    createdAt: serverTimestamp(),
                    createdById: user?.uid || 'unknown',
                    createdByName: userData?.name || 'Import'
                  };

                  batch.set(doc(db, "customers", finalDocId), customerData, { merge: true });
                  count++;
                  processedCount++;
              } else {
                  errorCount++;
                  console.warn(`Linha ${i+2} ignorada por falta de Nome ou ID.`);
              }
              
              if (count === 400) {
                  await batch.commit();
                  batch = writeBatch(db);
                  count = 0;
              }
              
              setImportProgress(Math.round(((i + 1) / total) * 100));
          }
          
          if (count > 0) await batch.commit();
          toast({ 
              title: "Importação Concluída!", 
              description: `${processedCount} processados. ${errorCount > 0 ? `${errorCount} linhas ignoradas.` : ''}` 
          });
          handleSearch(null);
        } catch (error: any) {
           console.error("Erro fatal no processamento:", error);
           toast({ 
             title: "Erro na importação", 
             description: `Falha ao processar arquivo: ${error?.message || 'Erro desconhecido'}`, 
             variant: "destructive" 
           });
        } finally {
            setIsImporting(false);
            setImportProgress(0);
            if (importInputRef.current) importInputRef.current.value = "";
        }
      }
    });
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl shadow-sm border border-border/50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <User className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Clientes</h1>
            <p className="text-muted-foreground mt-1">Gestão centralizada de clientes e contatos.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handleDownloadTemplate} className="shadow-sm hover:shadow-md transition-all border-dashed"><FileSpreadsheet className="mr-2 h-4 w-4" /> Modelo</Button>
          <Button variant="secondary" onClick={handleExport} disabled={loading} className="shadow-sm hover:shadow-md transition-all"><Download className="mr-2 h-4 w-4" /> Exportar</Button>
          <Button asChild variant="secondary" className="shadow-sm hover:shadow-md transition-all">
            <label htmlFor="import-csv" className="cursor-pointer flex items-center">
              <Upload className="mr-2 h-4 w-4" /> Importar
              <input ref={importInputRef} id="import-csv" type="file" accept=".csv" className="sr-only" onChange={handleImport} disabled={isSubmitting}/>
            </label>
          </Button>
          <Button onClick={() => handleOpenDialog()} className="shadow-md hover:shadow-lg transition-all gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"><PlusCircle className="h-4 w-4" /><span>Novo Cliente</span></Button>
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-card/50 backdrop-blur-xl">
        <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40"></div>
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-2 text-xl"><Search className="h-5 w-5 text-primary"/> Pesquisa Inteligente</CardTitle>
          <CardDescription>Busca rápida por Nome, CPF ou CNPJ (mínimo de 3 caracteres).</CardDescription>
          <div className="flex items-center gap-4 pt-4">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none transition-colors group-focus-within:text-primary">
                  <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input 
                    placeholder="Digite para buscar clientes..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="pl-12 py-6 text-lg rounded-xl shadow-inner border-muted-foreground/20 focus-visible:ring-primary/30 transition-all bg-background/60"
                />
              </div>
              {isSearching && (
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
          </div>
        </CardHeader>
        <CardContent>
          {loading || authLoading ? (
              <div className="flex flex-col justify-center items-center h-64 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
                <p className="text-muted-foreground animate-pulse">Carregando dados...</p>
              </div>
          ) : searchTerm.length < 3 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed border-border/60 rounded-xl bg-muted/20 mx-6 mb-6">
                  <div className="p-4 bg-muted rounded-full mb-4">
                    <Contact className="h-10 w-10 text-primary opacity-60" />
                  </div>
                  <p className="text-lg font-medium text-foreground/80">Pronto para buscar</p>
                  <p className="text-sm">Digite pelo menos 3 caracteres para encontrar clientes.</p>
              </div>
          ) : customers.length === 0 && !isSearching ? (
              <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-border/60 rounded-xl bg-destructive/5 mx-6 mb-6">
                  <div className="p-4 bg-destructive/10 rounded-full mb-4">
                    <Frown className="h-10 w-10 text-destructive/80" />
                  </div>
                  <p className="font-semibold text-lg">Nenhum cliente encontrado</p>
                  <p className="text-sm text-muted-foreground max-w-sm">Não foi possível encontrar resultados para a sua busca. Verifique a ortografia ou limpe a pesquisa.</p>
              </div>
          ) : (
              <AlertDialog>
                  <div className="border rounded-xl overflow-x-auto bg-card shadow-sm mx-6 mb-6">
                      <Table>
                          <TableHeader className="bg-muted/50">
                              <TableRow>
                                  <TableHead>Nome / Razão Social</TableHead>
                                  <TableHead>Documento</TableHead>
                                  <TableHead>Filial</TableHead>
                                  <TableHead>Cadastro</TableHead>
                                  <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {customers.map(customer => (
                                  <TableRow key={customer.id}>
                                      <TableCell className="font-medium">{customer.name}</TableCell>
                                      <TableCell>{customer.cpf || customer.cnpj}</TableCell>
                                      <TableCell>{branches.find(b => b.id === customer.branchId)?.name || 'N/A'}</TableCell>
                                      <TableCell>{customer.createdAt?.toDate ? format(customer.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                      <TableCell className="text-right">
                                          <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(customer)}>Editar</Button>
                                          <AlertDialogTrigger asChild>
                                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setItemToDelete(customer)}>Excluir</Button>
                                          </AlertDialogTrigger>
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </div>

                  {!isLastPage && (
                    <div className="flex justify-center mt-4">
                        <Button variant="outline" onClick={() => handleSearch(lastVisible)} disabled={isSearching}>
                            {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ChevronDown className="mr-2 h-4 w-4"/>}
                            Carregar mais clientes
                        </Button>
                    </div>
                  )}

                  {itemToDelete && (
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação irá excluir permanentemente o cliente <strong className="mx-1">{itemToDelete.name}</strong> do banco de dados.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDelete}>Sim, excluir</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  )}
              </AlertDialog>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full p-0 overflow-hidden border-none shadow-2xl" onCloseAutoFocus={handleCloseDialog}>
          <div className="h-2 w-full bg-gradient-to-r from-primary to-primary/50"></div>
          <DialogHeader className="px-6 py-4 border-b bg-muted/20">
            <DialogTitle className="text-2xl flex items-center gap-2">
              <User className="h-6 w-6 text-primary" />
              {isEditing ? 'Editar Cliente' : 'Novo Cadastro de Cliente'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-8 p-6 max-h-[75vh] sm:max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
            <RadioGroup value={currentCustomer.type} onValueChange={(v) => setCurrentCustomer(p => ({...p!, type: v as any}))} className="flex gap-4">
              <div className="flex items-center space-x-2"><RadioGroupItem value="fisica" id="fisica"/><Label htmlFor="fisica">Pessoa Física</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="juridica" id="juridica"/><Label htmlFor="juridica">Pessoa Jurídica</Label></div>
            </RadioGroup>

            <div className="space-y-1">
                <Label htmlFor="branchId">Filial</Label>
                <Select value={currentCustomer.branchId || ""} onValueChange={(value) => setCurrentCustomer(p => ({...p!, branchId: value}))}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma filial" /></SelectTrigger>
                    <SelectContent>{branches.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>

            {currentCustomer.type === 'juridica' ? (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1"><Label htmlFor="cnpj">CNPJ</Label><Input id="cnpj" value={currentCustomer.cnpj || ''} onChange={e => setCurrentCustomer(p => ({...p!, cnpj: e.target.value}))}/></div>
                    <div className="space-y-1"><Label htmlFor="inscricaoEstadual">IE</Label><Input id="inscricaoEstadual" value={currentCustomer.inscricaoEstadual || ''} onChange={e => setCurrentCustomer(p => ({...p!, inscricaoEstadual: e.target.value}))}/></div>
                </div>
                <div className="space-y-1"><Label htmlFor="razaoSocial">Razão Social</Label><Input id="razaoSocial" value={currentCustomer.razaoSocial || ''} onChange={e => setCurrentCustomer(p => ({...p!, razaoSocial: e.target.value}))}/></div>
                <div className="space-y-1"><Label htmlFor="name_juridica">Nome Fantasia</Label><Input id="name_juridica" value={currentCustomer.name || ''} onChange={e => setCurrentCustomer(p => ({...p!, name: e.target.value}))}/></div>
                </>
            ) : (
                <>
                <div className="space-y-1"><Label htmlFor="name_fisica">Nome Completo</Label><Input id="name_fisica" value={currentCustomer.name || ''} onChange={e => setCurrentCustomer(p => ({...p!, name: e.target.value}))}/></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1"><Label htmlFor="cpf">CPF</Label><Input id="cpf" value={currentCustomer.cpf || ''} onChange={e => setCurrentCustomer(p => ({...p!, cpf: e.target.value}))}/></div>
                  <div className="space-y-1"><Label htmlFor="birthDate">Data de Nascimento</Label><Input id="birthDate" type="date" value={currentCustomer.birthDate || ''} onChange={e => setCurrentCustomer(p => ({...p!, birthDate: e.target.value}))}/></div>
                </div>
                </>
            )}

            <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={currentCustomer.email || ''} onChange={e => setCurrentCustomer(p => ({...p!, email: e.target.value}))}/></div>

            <div className="space-y-4 bg-muted/20 p-5 rounded-2xl border border-border/50">
              <Label className="flex items-center gap-2 mb-2 text-base"><PhoneIcon className="h-4 w-4 text-primary" /> Telefones</Label>
              {(currentCustomer.phones || []).map((phone) => (
                <div key={phone.id} className="flex items-end gap-2">
                    <div className="w-40 space-y-1"><Select value={phone.type} onValueChange={(v) => handlePhoneChange(phone.id, 'type', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="celular">Celular</SelectItem><SelectItem value="fixo">Fixo</SelectItem><SelectItem value="comercial">Comercial</SelectItem></SelectContent></Select></div>
                    <div className="flex-1"><Input value={formatPhone(phone.number)} onChange={(e) => handlePhoneChange(phone.id, 'number', e.target.value)} /></div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemovePhone(phone.id)}><Trash2 className="h-4 w-4"/></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={handleAddPhone}><PlusCircle className="mr-2 h-4 w-4"/>Adicionar Telefone</Button>
            </div>
            
            <div className="space-y-4">
                <Label className="flex items-center gap-2 mb-2 text-base"><Building className="h-4 w-4 text-primary" /> Endereços</Label>
                {(currentCustomer.addresses || []).map((address, index) => (
                    <div key={address.id} className="p-5 space-y-4 relative bg-muted/30 border border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-center"><h4 className="font-semibold flex items-center gap-2"><HomeIcon className="h-4 w-4 text-primary"/> Endereço {index + 1}</h4>{currentCustomer.addresses!.length > 1 && <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleRemoveAddress(address.id)}><Trash2 className="h-4 w-4"/></Button>}</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="flex items-center gap-2"><Input placeholder="CEP" value={address.cep || ''} onChange={e => handleAddressChange(address.id, 'cep', e.target.value)} className="bg-background"/><Button onClick={() => fetchCepData(address.id)} disabled={isFetchingCep === address.id} size="icon" className="shrink-0">{isFetchingCep === address.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}</Button></div>
                            <Input placeholder="Rua" className="md:col-span-2 bg-background" value={address.address || ''} onChange={e => handleAddressChange(address.id, 'address', e.target.value)}/>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <Select 
                                value={address.residenceType || ""} 
                                onValueChange={(v) => handleAddressChange(address.id, 'residenceType', v as any)}
                            >
                                <SelectTrigger className={cn("bg-background", !address.residenceType && "border-destructive")}>
                                    <SelectValue placeholder="Tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Casa">Casa</SelectItem>
                                    <SelectItem value="Apartamento">Apartamento</SelectItem>
                                    <SelectItem value="Sobrado">Sobrado</SelectItem>
                                    <SelectItem value="Outro">Outro</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input placeholder="Nº" value={address.number || ''} onChange={e => handleAddressChange(address.id, 'number', e.target.value)} className="bg-background"/>
                            <Input placeholder="Complemento" value={address.complement || ''} onChange={e => handleAddressChange(address.id, 'complement', e.target.value)} className="bg-background"/>
                            <Input placeholder="Bairro" value={address.neighborhood || ''} onChange={e => handleAddressChange(address.id, 'neighborhood', e.target.value)} className="bg-background"/>
                            <div className="flex gap-2">
                                <Input placeholder="Cidade" value={address.city || ''} onChange={e => handleAddressChange(address.id, 'city', e.target.value)} className="bg-background flex-1"/>
                                <Input placeholder="UF" value={address.state || ''} onChange={e => handleAddressChange(address.id, 'state', e.target.value)} className="w-12 uppercase bg-background text-center"/>
                            </div>
                        </div>
                    </div>
                ))}
                <Button variant="outline" size="sm" onClick={handleAddAddress}><PlusCircle className="mr-2 h-4 w-4"/>Adicionar Endereço</Button>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting} className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-md transition-all px-8 text-primary-foreground">{isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />} Salvar Cliente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isImporting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <Card className="w-full max-w-md shadow-2xl border-primary/20 bg-card/95 backdrop-blur-xl animate-in zoom-in-95 duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                Importando Clientes
              </CardTitle>
              <CardDescription>
                Processando arquivo CSV e sincronizando com o banco de dados. Por favor, não feche a página.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Progress value={importProgress} className="h-3 bg-primary/10" />
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="text-primary">{importProgress}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
