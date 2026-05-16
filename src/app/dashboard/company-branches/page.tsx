
"use client";

import * as React from "react";
import Image from "next/image";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Search, FileText, Upload, CheckCircle, Image as ImageIcon } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { CompanyBranch, Branch } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";

const initialFormData: Partial<CompanyBranch> = {
  cnpj: "",
  razao_social: "",
  nome_fantasia: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cep: "",
  cidade: "",
  uf: "",
  telefone: "",
  branchId: "",
  certificatePassword: "",
  logoUrl: "",
};

export default function CompanyBranchesPage() {
  const { toast } = useToast();
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isFetchingCnpj, setIsFetchingCnpj] = React.useState(false);

  const [currentData, setCurrentData] = React.useState<Partial<CompanyBranch>>(initialFormData);
  const [certificateFile, setCertificateFile] = React.useState<File | null>(null);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = React.useState<CompanyBranch | null>(null);
  const certificateFileInputRef = React.useRef<HTMLInputElement>(null);
  const logoFileInputRef = React.useRef<HTMLInputElement>(null);

  const isEditing = !!currentData.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [companyBranchesSnap, branchesSnap] = await Promise.all([
        getDocs(query(collection(db, "companyBranches"), orderBy("razao_social"))),
        getDocs(query(collection(db, "branches"), orderBy("name"))),
      ]);
      setCompanyBranches(companyBranchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyBranch)));
      setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
    } catch (error) {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (item?: CompanyBranch) => {
    if (item) {
      setCurrentData(JSON.parse(JSON.stringify(item)));
      setLogoPreview(item.logoUrl || null);
    } else {
      setCurrentData(initialFormData);
      setLogoPreview(null);
    }
    setCertificateFile(null);
    setLogoFile(null);
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentData(initialFormData);
    setCertificateFile(null);
    setLogoFile(null);
    setLogoPreview(null);
    setOpen(false);
  };

  const fetchCnpjData = async () => {
    if (!currentData.cnpj) return;
    const cnpj = currentData.cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      toast({ title: "CNPJ inválido", description: "O CNPJ deve ter 14 dígitos.", variant: "destructive" });
      return;
    }
    setIsFetchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!response.ok) throw new Error("Erro ao buscar CNPJ.");
      const data = await response.json();
      setCurrentData(prev => ({
        ...prev,
        razao_social: data.razao_social || '',
        nome_fantasia: data.nome_fantasia || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cep: data.cep?.replace(/\D/g, '') || '',
        cidade: data.municipio || '',
        uf: data.uf || '',
        telefone: data.ddd_telefone_1 || '',
      }));
    } catch (error) {
      toast({ title: "Erro ao buscar CNPJ", description: "Não foi possível encontrar os dados para este CNPJ.", variant: "destructive" });
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'certificate' | 'logo') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (fileType === 'certificate') {
        if (file.type !== "application/x-pkcs12") {
          toast({ title: "Arquivo inválido", description: "Por favor, selecione um arquivo .pfx ou .p12.", variant: "destructive"});
          return;
        }
        setCertificateFile(file);
      } else {
        if (!file.type.startsWith('image/')) {
          toast({ title: "Arquivo inválido", description: "Por favor, selecione uma imagem.", variant: "destructive"});
          return;
        }
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
      }
    }
  }

  const handleSubmit = async () => {
    if (!currentData.cnpj || !currentData.razao_social || !currentData.branchId) {
        toast({ title: "Campos obrigatórios", description: "CNPJ, Razão Social e Filial são obrigatórios.", variant: "destructive" });
        return;
    };
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const dataToSave: Partial<CompanyBranch> = { ...currentData };
      delete dataToSave.id;

      if (certificateFile && dataToSave.cnpj) {
        const filePath = `certificates/${dataToSave.cnpj}/certificate.pfx`;
        const fileRef = ref(storage, filePath);
        await uploadBytes(fileRef, certificateFile);
        dataToSave.certificateUrl = await getDownloadURL(fileRef);
        dataToSave.certificateFileName = certificateFile.name;
        dataToSave.certificateExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }

      if (logoFile && dataToSave.cnpj) {
        const logoPath = `company-logos/${dataToSave.cnpj}/logo.png`;
        const logoRef = ref(storage, logoPath);
        await uploadBytes(logoRef, logoFile);
        dataToSave.logoUrl = await getDownloadURL(logoRef);
      }

      if (isEditing) {
        const docRef = doc(db, "companyBranches", currentData.id!);
        await updateDoc(docRef, dataToSave);
        toast({ title: "Empresa Filial Atualizada!" });
      } else {
        await addDoc(collection(db, "companyBranches"), dataToSave);
        toast({ title: "Empresa Filial Cadastrada!" });
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error(error);
      toast({ title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.certificateUrl) {
          const filePath = `certificates/${itemToDelete.cnpj}/certificate.pfx`;
          const fileRef = ref(storage, filePath);
          await deleteObject(fileRef).catch(err => console.warn("Could not delete certificate file:", err));
      }
      if (itemToDelete.logoUrl) {
          const logoPath = `company-logos/${itemToDelete.cnpj}/logo.png`;
          const logoRef = ref(storage, logoPath);
          await deleteObject(logoRef).catch(err => console.warn("Could not delete logo file:", err));
      }
      await deleteDoc(doc(db, "companyBranches", itemToDelete.id));
      toast({ title: "Registro Deletado", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
      setItemToDelete(null);
    }
  };
  
  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || 'N/A';

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Empresas Filiais</h1>
            <p className="text-muted-foreground">Gerencie os dados cadastrais e certificados digitais de suas filiais.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Cadastrar Empresa Filial</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl" onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Empresa Filial' : 'Nova Empresa Filial'}</DialogTitle>
                <DialogDescription>
                  Preencha o CNPJ para buscar os dados automaticamente ou preencha manualmente.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
                {/* Informações da Empresa */}
                <Card>
                  <CardHeader><CardTitle className="text-lg">Informações da Empresa</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="cnpj" className="text-right">CNPJ</Label>
                      <div className="col-span-3 flex gap-2">
                        <Input id="cnpj" value={currentData.cnpj || ''} onChange={e => setCurrentData(p => ({ ...p, cnpj: e.target.value }))} className="flex-1" placeholder="00.000.000/0000-00" disabled={isSubmitting}/>
                        <Button onClick={fetchCnpjData} disabled={isFetchingCnpj || isSubmitting}>
                          {isFetchingCnpj ? <Loader2 className="animate-spin" /> : <Search />}
                        </Button>
                      </div>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="branchId" className="text-right">Vincular à Filial</Label>
                      <Select value={currentData.branchId || ''} onValueChange={value => setCurrentData(p => ({...p!, branchId: value }))} disabled={isSubmitting}>
                        <SelectTrigger className="col-span-3"><SelectValue placeholder="Selecione a filial do sistema" /></SelectTrigger>
                        <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="razao_social" className="text-right">Razão Social</Label>
                      <Input id="razao_social" value={currentData.razao_social || ''} onChange={e => setCurrentData(p => ({ ...p, razao_social: e.target.value }))} className="col-span-3" disabled={isSubmitting}/>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="nome_fantasia" className="text-right">Nome Fantasia</Label>
                      <Input id="nome_fantasia" value={currentData.nome_fantasia || ''} onChange={e => setCurrentData(p => ({ ...p, nome_fantasia: e.target.value }))} className="col-span-3" disabled={isSubmitting}/>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="telefone" className="text-right">Telefone</Label>
                      <Input id="telefone" value={currentData.telefone || ''} onChange={e => setCurrentData(p => ({ ...p, telefone: e.target.value }))} className="col-span-3" disabled={isSubmitting}/>
                    </div>
                  </CardContent>
                </Card>

                {/* Endereço */}
                 <Card>
                    <CardHeader><CardTitle className="text-lg">Endereço</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="cep" className="text-right">CEP</Label>
                            <Input id="cep" value={currentData.cep || ''} onChange={e => setCurrentData(p => ({ ...p, cep: e.target.value }))} className="col-span-3" disabled={isSubmitting}/>
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="logradouro" className="text-right">Endereço</Label>
                            <Input id="logradouro" value={currentData.logradouro || ''} onChange={e => setCurrentData(p => ({ ...p, logradouro: e.target.value }))} className="col-span-3" disabled={isSubmitting}/>
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="numero" className="text-right">Número</Label>
                            <Input id="numero" value={currentData.numero || ''} onChange={e => setCurrentData(p => ({ ...p, numero: e.target.value }))} className="col-span-3" disabled={isSubmitting}/>
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="complemento" className="text-right">Complemento</Label>
                            <Input id="complemento" value={currentData.complemento || ''} onChange={e => setCurrentData(p => ({ ...p, complemento: e.target.value }))} className="col-span-3" disabled={isSubmitting}/>
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="bairro" className="text-right">Bairro</Label>
                            <Input id="bairro" value={currentData.bairro || ''} onChange={e => setCurrentData(p => ({ ...p, bairro: e.target.value }))} className="col-span-3" disabled={isSubmitting}/>
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="cidade" className="text-right">Cidade</Label>
                            <Input id="cidade" value={currentData.cidade || ''} onChange={e => setCurrentData(p => ({ ...p, cidade: e.target.value }))} className="col-span-3" disabled={isSubmitting}/>
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="uf" className="text-right">UF</Label>
                            <Input id="uf" value={currentData.uf || ''} onChange={e => setCurrentData(p => ({ ...p, uf: e.target.value }))} className="col-span-3" disabled={isSubmitting}/>
                        </div>
                    </CardContent>
                 </Card>
                
                <Card>
                  <CardHeader><CardTitle className="text-lg">Identidade Visual e Certificado</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                     <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right pt-2">Logo</Label>
                        <div className="col-span-3 flex items-center gap-4">
                          <div className="w-24 h-24 rounded-md border border-dashed flex items-center justify-center bg-muted">
                            {logoPreview ? <Image src={logoPreview} alt="Preview da Logo" width={96} height={96} className="object-contain rounded-md" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
                          </div>
                           <Button asChild variant="outline">
                              <label htmlFor="logo-file-input" className="cursor-pointer">
                                  <Upload className="mr-2 h-4 w-4" />
                                  Selecionar Logo
                                  <input ref={logoFileInputRef} id="logo-file-input" type="file" accept="image/*" className="sr-only" onChange={(e) => handleFileChange(e, 'logo')} />
                              </label>
                          </Button>
                        </div>
                     </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="certificateFile" className="text-right">Certificado Digital (A1)</Label>
                         <div className="col-span-3 flex items-center gap-2">
                            <Button asChild variant="outline">
                                <label htmlFor="certificate-file-input" className="cursor-pointer">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Selecionar Arquivo (.pfx)
                                    <input ref={certificateFileInputRef} id="certificate-file-input" type="file" accept=".pfx,.p12" className="sr-only" onChange={(e) => handleFileChange(e, 'certificate')} />
                                </label>
                            </Button>
                            <span className="text-sm text-muted-foreground truncate">{certificateFile?.name || currentData.certificateFileName || "Nenhum arquivo"}</span>
                        </div>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="certificatePassword" className="text-right">Senha</Label>
                        <Input id="certificatePassword" type="password" value={currentData.certificatePassword || ''} onChange={e => setCurrentData(p => ({ ...p, certificatePassword: e.target.value }))} className="col-span-3" disabled={isSubmitting} />
                    </div>
                  </CardContent>
                </Card>

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

        <Card>
          <CardHeader>
            <CardTitle>Empresas Cadastradas</CardTitle>
            <CardDescription>
              Total de {companyBranches.length} empresas filiais cadastradas.
            </CardDescription>
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
                    <TableHead>Logo</TableHead>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Filial Vinculada</TableHead>
                    <TableHead>Certificado</TableHead>
                    <TableHead><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyBranches.map((item) => (
                    <TableRow key={item.id}>
                       <TableCell>
                        <div className="w-16 h-10 flex items-center justify-center">
                          {item.logoUrl ? <Image src={item.logoUrl} alt={item.nome_fantasia} width={64} height={40} className="object-contain" /> : <div className="w-full h-full bg-muted rounded-md" />}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{item.razao_social}</TableCell>
                      <TableCell>{item.cnpj}</TableCell>
                      <TableCell>{getBranchName(item.branchId)}</TableCell>
                       <TableCell>
                        <Badge variant={item.certificateUrl ? "default" : "secondary"}>
                          {item.certificateUrl ? <CheckCircle className="mr-2 h-4 w-4"/> : <FileText className="mr-2 h-4 w-4" />}
                          {item.certificateUrl ? 'Instalado' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(item)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-red-600" onSelect={(e) => { e.preventDefault(); setItemToDelete(item);}}>
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
              {itemToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita e irá excluir o registro de <strong className="mx-1">{itemToDelete.razao_social}</strong>.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
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
