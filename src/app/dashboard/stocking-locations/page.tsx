

"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Package, Check, X, GitFork, ArrowUp, ArrowDown, Power, PowerOff } from "lucide-react";
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
import type { StockingLocation, Branch, Role } from "@/lib/definitions";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function StockingLocationsPage() {
  const { toast } = useToast();
  const [locations, setLocations] = React.useState<StockingLocation[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [currentLocation, setCurrentLocation] = React.useState<Partial<StockingLocation>>({ isVisibleInOrigin: true, isVisibleToOtherBranches: true, visibleToRoleIds: [], isActive: true, allowNegativeStock: false });
  const [locationToDelete, setLocationToDelete] = React.useState<StockingLocation | null>(null);

  const isEditing = !!currentLocation.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [locationsSnap, branchesSnap, rolesSnap] = await Promise.all([
        getDocs(query(collection(db, "stockingLocations"))),
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(query(collection(db, "roles"), orderBy("name"))),
      ]);
      
      let itemsList = locationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockingLocation));

      const needsMigration = itemsList.some(item => typeof item.order !== 'number' || typeof item.isVisibleInOrigin !== 'boolean' || typeof item.isActive !== 'boolean' || typeof item.allowNegativeStock !== 'boolean');
      if (needsMigration) {
          const batch = writeBatch(db);
          itemsList.forEach((item, index) => {
              const updateData: Partial<StockingLocation> = {};
              if (typeof item.order !== 'number') {
                  updateData.order = index;
                  item.order = index;
              }
              if (typeof item.isVisibleInOrigin !== 'boolean') {
                  updateData.isVisibleInOrigin = true;
                  item.isVisibleInOrigin = true;
              }
              if (typeof item.isActive !== 'boolean') {
                  updateData.isActive = true;
                  item.isActive = true;
              }
              if (typeof item.allowNegativeStock !== 'boolean') {
                updateData.allowNegativeStock = false;
                item.allowNegativeStock = false;
              }
              if (Object.keys(updateData).length > 0) {
                  const docRef = doc(db, "stockingLocations", item.id);
                  batch.update(docRef, updateData);
              }
          });
          await batch.commit();
      }
      
      itemsList.sort((a, b) => a.order - b.order);
      setLocations(itemsList);
      setBranches(branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
      setRoles(rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role)));

    } catch (error) {
      toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar os locais de estocagem.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (location?: StockingLocation) => {
    setCurrentLocation(location || { name: "", branchId: "", isVisibleInOrigin: true, isVisibleToOtherBranches: true, visibleToRoleIds: [], isActive: true, allowNegativeStock: false });
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentLocation({ name: "", branchId: "", isVisibleInOrigin: true, isVisibleToOtherBranches: true, visibleToRoleIds: [], isActive: true, allowNegativeStock: false });
    setOpen(false);
  };

  const handleRoleSelection = (roleId: string) => {
    setCurrentLocation(prev => {
        const newRoleIds = [...(prev?.visibleToRoleIds || [])];
        const index = newRoleIds.indexOf(roleId);
        if(index > -1) {
            newRoleIds.splice(index, 1);
        } else {
            newRoleIds.push(roleId);
        }
        return {...prev, visibleToRoleIds: newRoleIds};
    });
  }

  const handleSubmit = async () => {
    if (!currentLocation.name || !currentLocation.branchId) {
      toast({ title: "Campos obrigatórios", description: "Nome e filial são obrigatórios.", variant: "destructive" });
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const dataToSave: Partial<Omit<StockingLocation, 'id' | 'order'>> = {
        name: currentLocation.name.trim(),
        branchId: currentLocation.branchId,
        isVisibleInOrigin: currentLocation.isVisibleInOrigin === undefined ? true : currentLocation.isVisibleInOrigin,
        isVisibleToOtherBranches: currentLocation.isVisibleToOtherBranches === undefined ? true : currentLocation.isVisibleToOtherBranches,
        visibleToRoleIds: currentLocation.visibleToRoleIds || [],
        isActive: currentLocation.isActive === undefined ? true : currentLocation.isActive,
        allowNegativeStock: currentLocation.allowNegativeStock === undefined ? false : currentLocation.allowNegativeStock,
      };

      if (isEditing) {
        const docRef = doc(db, "stockingLocations", currentLocation.id!);
        await updateDoc(docRef, dataToSave as any);
        toast({ title: "Local Atualizado!", description: "O local de estocagem foi atualizado." });
      } else {
        await addDoc(collection(db, "stockingLocations"), { ...dataToSave, order: locations.length });
        toast({ title: "Local Cadastrado!", description: "O novo local de estocagem foi adicionado." });
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
    if (!locationToDelete) return;
    try {
      await deleteDoc(doc(db, "stockingLocations", locationToDelete.id));
      toast({ title: "Local Deletado", description: "O registro foi removido.", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
      setLocationToDelete(null);
    }
  };
  
  const handleToggleActive = async (location: StockingLocation) => {
    try {
        const docRef = doc(db, "stockingLocations", location.id);
        await updateDoc(docRef, { isActive: !location.isActive });
        toast({ title: `Local ${!location.isActive ? 'Ativado' : 'Desativado'}`});
        fetchData();
    } catch(error) {
        toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
  }

  const saveOrder = async (itemsToSave: StockingLocation[]) => {
      setIsSaving(true);
      try {
          const batch = writeBatch(db);
          itemsToSave.forEach((item, index) => {
              const docRef = doc(db, "stockingLocations", item.id);
              batch.update(docRef, { order: index });
          });
          await batch.commit();
          toast({ title: "Ordem Salva!" });
          setLocations(itemsToSave);
      } catch (error) {
          toast({ title: "Erro ao salvar ordem", variant: "destructive" });
          fetchData(); 
      } finally {
          setIsSaving(false);
      }
  }

  const handleMove = (itemId: string, direction: "up" | "down") => {
    const items = [...locations];
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    [items[index], items[newIndex]] = [items[newIndex], items[index]];

    const updatedItems = items.map((item, idx) => ({ ...item, order: idx }));

    setLocations(updatedItems);
    saveOrder(updatedItems);
  };

  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || 'N/A';
  const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'N/A';

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <Package /> Locais de Estocagem
            </h1>
            <p className="text-muted-foreground">
              Gerencie os locais de estoque e sua visibilidade entre filiais.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Novo Local</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]" onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Local' : 'Novo Local de Estocagem'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Local</Label>
                  <Input
                    id="name"
                    value={currentLocation.name || ""}
                    onChange={(e) => setCurrentLocation(p => ({...p, name: e.target.value}))}
                    placeholder="Ex: Depósito Principal"
                    disabled={isSubmitting}
                  />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="branchId">Filial de Origem</Label>
                  <Select value={currentLocation.branchId} onValueChange={(v) => setCurrentLocation(p => ({...p, branchId: v}))}>
                     <SelectTrigger id="branchId">
                        <SelectValue placeholder="Selecione uma filial" />
                     </SelectTrigger>
                     <SelectContent>
                        {branches.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                     </SelectContent>
                  </Select>
                </div>
                 <div className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="allowNegativeStock" className="flex-1 pr-4">Permitir Estoque Negativo?</Label>
                        <Switch id="allowNegativeStock" checked={currentLocation.allowNegativeStock} onCheckedChange={(c) => setCurrentLocation(p => ({...p, allowNegativeStock: c}))} />
                    </div>
                     <p className="text-xs text-muted-foreground">Se ativado, será possível vender produtos deste local mesmo sem estoque físico registrado.</p>
                 </div>
                 <div className="flex items-center space-x-2 pt-2">
                    <Switch id="isVisibleInOrigin" checked={currentLocation.isVisibleInOrigin} onCheckedChange={(c) => setCurrentLocation(p => ({...p, isVisibleInOrigin: c}))} />
                    <Label htmlFor="isVisibleInOrigin">Visível para venda na filial de origem</Label>
                </div>
                 <div className="flex items-center space-x-2 pt-2">
                    <Switch id="isVisibleToOtherBranches" checked={currentLocation.isVisibleToOtherBranches} onCheckedChange={(c) => setCurrentLocation(p => ({...p, isVisibleToOtherBranches: c}))} />
                    <Label htmlFor="isVisibleToOtherBranches">Visível para venda em outras filiais</Label>
                </div>
                 <div className="space-y-2">
                    <Label>Visível para as Funções (Opcional)</Label>
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal">
                              {currentLocation.visibleToRoleIds && currentLocation.visibleToRoleIds.length > 0 
                               ? `${currentLocation.visibleToRoleIds.length} função(ões) selecionada(s)`
                               : "Todas as funções"
                              }
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                         <DropdownMenuLabel>Funções com Visibilidade</DropdownMenuLabel>
                         {roles.map(role => (
                            <DropdownMenuCheckboxItem
                                key={role.id}
                                checked={currentLocation.visibleToRoleIds?.includes(role.id)}
                                onSelect={(e) => e.preventDefault()}
                                onCheckedChange={() => handleRoleSelection(role.id)}
                            >
                                {role.name}
                            </DropdownMenuCheckboxItem>
                         ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <p className="text-xs text-muted-foreground">Se nenhuma função for selecionada, o local será visível para todos (respeitando a regra de visibilidade entre filiais).</p>
                 </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Locais</CardTitle>
            <CardDescription>
              Total de {locations.length} locais cadastrados.
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
                    <TableHead>Status</TableHead>
                    <TableHead>Nome do Local</TableHead>
                    <TableHead>Filial de Origem</TableHead>
                    <TableHead>Visibilidade</TableHead>
                    <TableHead>Funções com Acesso</TableHead>
                    <TableHead>Estoque Negativo</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((location, index) => (
                    <TableRow key={location.id} className={!location.isActive ? 'bg-muted/30 text-muted-foreground' : ''}>
                      <TableCell>
                         <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(location.id, 'up')} disabled={index === 0 || isSaving}>
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(location.id, 'down')} disabled={index === locations.length - 1 || isSaving}>
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                         </div>
                      </TableCell>
                       <TableCell>
                        <Badge variant={location.isActive ? "default" : "secondary"}>
                            {location.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                       </TableCell>
                      <TableCell className="font-medium">{location.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1.5">
                            <GitFork className="h-3 w-3" />
                            {getBranchName(location.branchId)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                           <Badge variant={location.isVisibleInOrigin ? "default" : "secondary"} className="gap-1.5">
                              {location.isVisibleInOrigin ? <Check className="h-3 w-3"/> : <X className="h-3 w-3"/>}
                              Na Origem
                           </Badge>
                           <Badge variant={location.isVisibleToOtherBranches ? "default" : "secondary"} className="gap-1.5">
                              {location.isVisibleToOtherBranches ? <Check className="h-3 w-3"/> : <X className="h-3 w-3"/>}
                              Outras Filiais
                           </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                            {location.visibleToRoleIds && location.visibleToRoleIds.length > 0 ? (
                                location.visibleToRoleIds.map(roleId => (
                                    <Badge key={roleId} variant="outline">{getRoleName(roleId)}</Badge>
                                ))
                            ) : (
                                <span className="text-xs">Todos</span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={location.allowNegativeStock ? "default" : "secondary"} className={location.allowNegativeStock ? "bg-green-600" : ""}>
                            {location.allowNegativeStock ? 'Sim' : 'Não'}
                        </Badge>
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
                            <DropdownMenuItem onClick={() => handleOpenDialog(location)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                             <DropdownMenuItem onClick={() => handleToggleActive(location)}>
                                {location.isActive ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                                {location.isActive ? "Desativar" : "Ativar"}
                             </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setLocationToDelete(location);
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
              {locationToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso irá deletar permanentemente o local
                        <strong className="mx-1">{locationToDelete.name}</strong>.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setLocationToDelete(null)}>Cancelar</AlertDialogCancel>
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

    