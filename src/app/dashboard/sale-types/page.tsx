

"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, ArrowUp, ArrowDown, Check, X, BriefcaseBusiness, ShoppingCart, Truck, Wrench, GitFork, User } from "lucide-react";
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
  DropdownMenuCheckboxItem,
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
import type { SaleType, Role, Branch } from "@/lib/definitions";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SaleTypesPage() {
  const { toast } = useToast();
  const [saleTypes, setSaleTypes] = React.useState<SaleType[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [currentType, setCurrentType] = React.useState<Partial<SaleType>>({ countsTowardsMercantilGoal: true, countsTowardsFreightGoal: true, countsTowardsServiceGoal: true, roleIds: [], branchIds: [], consolidateToRoleIds: [] });
  const [typeToDelete, setTypeToDelete] = React.useState<SaleType | null>(null);

  const isEditing = !!currentType.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [saleTypesSnap, rolesSnap, branchesSnap] = await Promise.all([
        getDocs(query(collection(db, "saleTypes"), orderBy("order"))),
        getDocs(query(collection(db, "roles"), orderBy("name"))),
        getDocs(query(collection(db, "branches"), orderBy("name"))),
      ]);
      
      let itemsList = saleTypesSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as SaleType)
      );

      const needsMigration = itemsList.some(item => 
        typeof item.order !== 'number' || 
        typeof item.countsTowardsMercantilGoal !== 'boolean' ||
        typeof item.countsTowardsFreightGoal !== 'boolean' ||
        typeof item.countsTowardsServiceGoal !== 'boolean'
      );

      if (needsMigration) {
        const batch = writeBatch(db);
        itemsList.forEach((item, index) => {
          const updateData: Partial<SaleType> = {};
          if (typeof item.order !== 'number') {
            updateData.order = index;
            item.order = index;
          }
           if (typeof item.countsTowardsMercantilGoal !== 'boolean') {
            updateData.countsTowardsMercantilGoal = true;
            item.countsTowardsMercantilGoal = true;
          }
           if (typeof item.countsTowardsFreightGoal !== 'boolean') {
            updateData.countsTowardsFreightGoal = true;
            item.countsTowardsFreightGoal = true;
          }
           if (typeof item.countsTowardsServiceGoal !== 'boolean') {
            updateData.countsTowardsServiceGoal = true;
            item.countsTowardsServiceGoal = true;
          }
          if (Object.keys(updateData).length > 0) {
            const docRef = doc(db, "saleTypes", item.id);
            batch.update(docRef, updateData);
          }
        });
        await batch.commit();
      }

      itemsList.sort((a, b) => a.order - b.order);
      setSaleTypes(itemsList);
      setRoles(rolesSnap.docs.map(d => ({id: d.id, ...d.data()}) as Role));
      setBranches(branchesSnap.docs.map(d => ({id: d.id, ...d.data()}) as Branch));

    } catch (error) {
      toast({
        title: "Erro ao buscar tipos de venda",
        description: "Não foi possível carregar a lista.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (type?: SaleType) => {
    const defaultData = { countsTowardsMercantilGoal: true, countsTowardsFreightGoal: true, countsTowardsServiceGoal: true, roleIds: [], branchIds: [], consolidateToRoleIds: [] };
    setCurrentType(type ? JSON.parse(JSON.stringify(type)) : defaultData);
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentType({ countsTowardsMercantilGoal: true, countsTowardsFreightGoal: true, countsTowardsServiceGoal: true, roleIds: [], branchIds: [], consolidateToRoleIds: [] });
    setOpen(false);
  };

  const handleRoleSelection = (roleId: string, type: 'access' | 'consolidate') => {
    setCurrentType(prev => {
        const key = type === 'access' ? 'roleIds' : 'consolidateToRoleIds';
        const newRoleIds = [...(prev[key] || [])];
        const index = newRoleIds.indexOf(roleId);
        if (index > -1) {
            newRoleIds.splice(index, 1);
        } else {
            newRoleIds.push(roleId);
        }
        return { ...prev, [key]: newRoleIds };
    });
  };
  
  const handleBranchSelection = (branchId: string) => {
    setCurrentType(prev => {
        const newBranchIds = [...(prev.branchIds || [])];
        const index = newBranchIds.indexOf(branchId);
        if (index > -1) {
            newBranchIds.splice(index, 1);
        } else {
            newBranchIds.push(branchId);
        }
        return { ...prev, branchIds: newBranchIds };
    });
  };

  const handleClearBranchSelection = () => {
      setCurrentType(prev => ({ ...prev, branchIds: [] }));
  };

  const handleSubmit = async () => {
    if (!currentType.name || currentType.name.trim() === "" || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const dataToSave: Partial<Omit<SaleType, 'id' | 'order'>> = {
        name: currentType.name.trim(),
        countsTowardsMercantilGoal: currentType.countsTowardsMercantilGoal === undefined ? true : currentType.countsTowardsMercantilGoal,
        countsTowardsFreightGoal: currentType.countsTowardsFreightGoal === undefined ? true : currentType.countsTowardsFreightGoal,
        countsTowardsServiceGoal: currentType.countsTowardsServiceGoal === undefined ? true : currentType.countsTowardsServiceGoal,
        roleIds: currentType.roleIds || [],
        branchIds: currentType.branchIds || [],
        consolidateToRoleIds: currentType.consolidateToRoleIds || [],
      };

      if (isEditing) {
        const docRef = doc(db, "saleTypes", currentType.id!);
        await updateDoc(docRef, dataToSave as any);
        toast({
          title: "Operação de Venda Atualizada!",
          description: "O tipo de venda foi atualizado com sucesso.",
        });
      } else {
        await addDoc(collection(db, "saleTypes"), { 
          ...dataToSave,
          order: saleTypes.length,
        });
        toast({
          title: "Operação de Venda Cadastrada!",
          description: "O novo tipo de venda foi adicionado com sucesso.",
        });
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      toast({
        title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar",
        description: `Não foi possível salvar o tipo de venda.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    try {
      await deleteDoc(doc(db, "saleTypes", typeToDelete.id));
      toast({
        title: "Tipo de Venda Deletado",
        description: "O registro foi removido com sucesso.",
        variant: "destructive",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover o registro.",
        variant: "destructive",
      });
    } finally {
      setTypeToDelete(null);
    }
  };

  const saveOrder = async (itemsToSave: SaleType[]) => {
      setIsSaving(true);
      try {
          const batch = writeBatch(db);
          itemsToSave.forEach((item, index) => {
              const docRef = doc(db, "saleTypes", item.id);
              batch.update(docRef, { order: index });
          });
          await batch.commit();
          toast({ title: "Ordem Salva!" });
          setSaleTypes(itemsToSave);
      } catch (error) {
          toast({ title: "Erro ao salvar ordem", variant: "destructive" });
          fetchData(); 
      } finally {
          setIsSaving(false);
      }
  }

  const handleMove = (itemId: string, direction: "up" | "down") => {
    const items = [...saleTypes];
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    [items[index], items[newIndex]] = [items[newIndex], items[index]];

    const updatedItems = items.map((item, idx) => ({ ...item, order: idx }));

    setSaleTypes(updatedItems);
    saveOrder(updatedItems);
  };
  
  const getRoleNames = (roleIds?: string[]) => {
    if (!roleIds || roleIds.length === 0) return "Todas";
    if (roleIds.length > 2) return `${roleIds.length} funções`;
    return roleIds.map(id => roles.find(r => r.id === id)?.name || 'N/A').join(', ');
  }

  const getBranchNames = (branchIds?: string[]) => {
    if (!branchIds || branchIds.length === 0) return "Nenhuma";
    if (branchIds.length > 2) return `${branchIds.length} filiais`;
    return branchIds.map(id => branches.find(b => b.id === id)?.name || 'N/A').join(', ');
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <ShoppingCart /> Operações de Venda
            </h1>
            <p className="text-muted-foreground">
              Gerencie os tipos de operações de venda disponíveis no sistema.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Novo Tipo</span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Operação de Venda' : 'Cadastrar Nova Operação de Venda'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={currentType.name || ""}
                    onChange={(e) => setCurrentType({...currentType, name: e.target.value})}
                    placeholder="Ex: Venda Presencial"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="branchId">Filial Vinculada (Opcional)</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal">
                              {getBranchNames(currentType.branchIds)}
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                         <DropdownMenuLabel>Filiais Vinculadas</DropdownMenuLabel>
                         <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={handleClearBranchSelection}>Nenhuma</DropdownMenuItem>
                         <DropdownMenuSeparator />
                          {branches.map(branch => (
                              <DropdownMenuCheckboxItem
                                  key={branch.id}
                                  checked={currentType.branchIds?.includes(branch.id)}
                                  onSelect={(e) => e.preventDefault()}
                                  onCheckedChange={() => handleBranchSelection(branch.id)}
                              >
                                  {branch.name}
                              </DropdownMenuCheckboxItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                     <p className="text-xs text-muted-foreground">Se nenhuma filial for selecionada, esta operação estará disponível para todas.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roleId">Funções com Acesso (Opcional)</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal">
                          {getRoleNames(currentType.roleIds)}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                       <DropdownMenuLabel>Funções com Acesso</DropdownMenuLabel>
                       <DropdownMenuSeparator />
                        {roles.map(role => (
                            <DropdownMenuCheckboxItem
                                key={role.id}
                                checked={currentType.roleIds?.includes(role.id)}
                                onSelect={(e) => e.preventDefault()}
                                onCheckedChange={() => handleRoleSelection(role.id, 'access')}
                            >
                                {role.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <p className="text-xs text-muted-foreground">Se nenhuma função for selecionada, esta operação estará disponível para todos.</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="consolidateToRoleId">Consolidar para Funções (Opcional)</Label>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal">
                              {getRoleNames(currentType.consolidateToRoleIds || undefined)}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                           <DropdownMenuLabel>Consolidar para</DropdownMenuLabel>
                           <DropdownMenuSeparator />
                            {roles.map(role => (
                                <DropdownMenuCheckboxItem
                                    key={role.id}
                                    checked={currentType.consolidateToRoleIds?.includes(role.id)}
                                    onSelect={(e) => e.preventDefault()}
                                    onCheckedChange={() => handleRoleSelection(role.id, 'consolidate')}
                                >
                                    {role.name}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                     <p className="text-xs text-muted-foreground">Se selecionado, o valor desta operação somará para a meta da(s) função(ões) escolhida(s).</p>
                </div>
                 <div className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="countsTowardsMercantilGoal" className="flex-1 pr-4">Contabiliza para a meta Mercantil</Label>
                        <Switch id="countsTowardsMercantilGoal" checked={currentType.countsTowardsMercantilGoal} onCheckedChange={(checked) => setCurrentType({...currentType, countsTowardsMercantilGoal: checked})} />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="countsTowardsFreightGoal" className="flex-1 pr-4">Contabiliza para a meta de Frete</Label>
                        <Switch id="countsTowardsFreightGoal" checked={currentType.countsTowardsFreightGoal} onCheckedChange={(checked) => setCurrentType({...currentType, countsTowardsFreightGoal: checked})} />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="countsTowardsServiceGoal" className="flex-1 pr-4">Contabiliza para a meta de Serviços</Label>
                        <Switch id="countsTowardsServiceGoal" checked={currentType.countsTowardsServiceGoal} onCheckedChange={(checked) => setCurrentType({...currentType, countsTowardsServiceGoal: checked})} />
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

        <Card>
          <CardHeader>
            <CardTitle>Lista de Tipos de Venda</CardTitle>
            <CardDescription>
              Total de {saleTypes.length} tipos cadastrados.
              {(isSaving) && <span className="ml-2 animate-pulse">Salvando...</span>}
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
                    <TableHead className="w-24">Ordem</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Filial Vinculada</TableHead>
                    <TableHead>Consolidar p/ Função</TableHead>
                    <TableHead>Meta Mercantil</TableHead>
                    <TableHead>Meta Frete</TableHead>
                    <TableHead>Meta Serviços</TableHead>
                    <TableHead>Funções com Acesso</TableHead>
                    <TableHead className="w-20 text-right">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saleTypes.map((type, index) => (
                    <TableRow key={type.id}>
                       <TableCell>
                         <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(type.id, 'up')} disabled={index === 0 || isSaving}>
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(type.id, 'down')} disabled={index === saleTypes.length - 1 || isSaving}>
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                         </div>
                      </TableCell>
                      <TableCell className="font-medium">{type.name}</TableCell>
                       <TableCell>
                         <div className="flex flex-wrap gap-1">
                            {getBranchNames(type.branchIds).split(', ').map(name => <Badge key={name} variant="outline" className="gap-1.5"><GitFork className="h-3 w-3"/>{name}</Badge>)}
                         </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {getRoleNames(type.consolidateToRoleIds || undefined).split(', ').map(roleName => (
                              <Badge key={roleName} variant="outline" className="gap-1.5">
                                <User className="h-3 w-3"/>{roleName}
                              </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={type.countsTowardsMercantilGoal ? "default" : "outline"} className="gap-1.5">
                            {type.countsTowardsMercantilGoal ? <Check className="h-3 w-3"/> : <X className="h-3 w-3"/>}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={type.countsTowardsFreightGoal ? "default" : "outline"} className="gap-1.5">
                            {type.countsTowardsFreightGoal ? <Check className="h-3 w-3"/> : <X className="h-3 w-3"/>}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={type.countsTowardsServiceGoal ? "default" : "outline"} className="gap-1.5">
                            {type.countsTowardsServiceGoal ? <Check className="h-3 w-3"/> : <X className="h-3 w-3"/>}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                            {(type.roleIds && type.roleIds.length > 0 ? getRoleNames(type.roleIds).split(', ') : ["Todas"]).map(roleName => (
                                <Badge key={roleName} variant="outline" className="gap-1.5">
                                    <BriefcaseBusiness className="h-3 w-3"/>
                                    {roleName}
                                </Badge>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-haspopup="true"
                              size="icon"
                              variant="ghost"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(type)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setTypeToDelete(type);
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
              {typeToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso irá deletar permanentemente o tipo de venda
                        <strong className="mx-1">{typeToDelete.name}</strong>.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setTypeToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>
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
