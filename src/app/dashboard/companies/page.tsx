"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
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
import type { Company } from "@/lib/definitions";

export default function CompaniesPage() {
  const { toast } = useToast();
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentCompany, setCurrentCompany] = React.useState<Partial<Company>>({});
  const [companyToDelete, setCompanyToDelete] = React.useState<Company | null>(null);
  
  const isEditing = !!currentCompany.id;

  const fetchCompanies = React.useCallback(async () => {
    try {
      setLoading(true);
      const companiesCollection = collection(db, "companies");
      const companySnapshot = await getDocs(companiesCollection);
      const companiesList = companySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Company)
      );
      setCompanies(companiesList);
    } catch (error) {
      toast({
        title: "Erro ao buscar empresas",
        description: "Não foi possível carregar a lista de empresas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);
  
  const handleOpenDialog = (company?: Company) => {
    setCurrentCompany(company || {});
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setCurrentCompany({});
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!currentCompany.name || currentCompany.name.trim() === "" || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isEditing) {
        const companyDoc = doc(db, "companies", currentCompany.id!);
        await updateDoc(companyDoc, { name: currentCompany.name.trim() });
        toast({
          title: "Empresa Atualizada!",
          description: "A empresa foi atualizada com sucesso.",
        });
      } else {
        const companiesCollection = collection(db, "companies");
        await addDoc(companiesCollection, { name: currentCompany.name.trim() });
        toast({
          title: "Empresa Cadastrada!",
          description: "A nova empresa foi adicionada com sucesso.",
        });
      }
      handleCloseDialog();
      fetchCompanies(); // Refresh the list
    } catch (error) {
      toast({
        title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar",
        description: `Não foi possível salvar a empresa.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;
    try {
      const companyDoc = doc(db, "companies", companyToDelete.id);
      await deleteDoc(companyDoc);
      toast({
        title: "Empresa Deletada",
        description: "A empresa foi removida com sucesso.",
        variant: "destructive",
      });
      fetchCompanies(); // Refresh the list
    } catch (error) {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover a empresa.",
        variant: "destructive",
      });
    } finally {
      setCompanyToDelete(null);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Empresas</h1>
            <p className="text-muted-foreground">Gerencie as empresas cadastradas no sistema.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Cadastrar Empresa
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={() => handleCloseDialog()}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Empresa' : 'Cadastrar Nova Empresa'}</DialogTitle>
                <DialogDescription>
                  {isEditing ? 'Altere o nome da empresa.' : 'Insira o nome da nova empresa para adicioná-la ao sistema.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Nome
                  </Label>
                  <Input
                    id="name"
                    value={currentCompany.name || ""}
                    onChange={(e) => setCurrentCompany({ ...currentCompany, name: e.target.value })}
                    className="col-span-3"
                    placeholder="Nome da Empresa"
                    disabled={isSubmitting}
                  />
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

        <Card>
          <CardHeader>
            <CardTitle>Lista de Empresas</CardTitle>
            <CardDescription>
              Total de {companies.length} empresas cadastradas.
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
                    <TableHead>Nome da Empresa</TableHead>
                    <TableHead>
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(company)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setCompanyToDelete(company)
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Deletar
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {companyToDelete && (
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Essa ação não pode ser desfeita. Isso irá deletar permanentemente a empresa
                      <strong className="mx-1">{companyToDelete.name}</strong>
                        do sistema.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setCompanyToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteCompany}>
                      Sim, deletar
                    </AlertDialogAction>
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
