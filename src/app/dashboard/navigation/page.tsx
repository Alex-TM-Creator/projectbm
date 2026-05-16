"use client";

import * as React from "react";
import { PlusCircle, Loader2, ListTree, ArrowUp, ArrowDown, Pencil, Eye, EyeOff, Copy, Trash2, Search, GripVertical } from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  writeBatch,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { db } from "@/lib/firebase";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { NavigationItem } from "@/lib/definitions";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import { IconPicker, iconTranslations } from "./IconPicker";

const Icon = ({ name, ...props }: { name: string } & React.ComponentProps<typeof ListTree>) => {
  const LucideIcon = (Icons as any)[name] as React.ComponentType<any>;
  if (!LucideIcon) return <ListTree {...props} />;
  return <LucideIcon {...props} />;
};

export default function NavigationPage() {
  const { toast } = useToast();
  const [navItems, setNavItems] = React.useState<NavigationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  
  const [newItem, setNewItem] = React.useState<Partial<Omit<NavigationItem, 'id' | 'order'>>>({
    title: "",
    path: "",
    icon: "Circle",
    parentId: null,
    visible: true,
  });
  
  const [editingItem, setEditingItem] = React.useState<Partial<NavigationItem> | null>(null);
  const [itemToDelete, setItemToDelete] = React.useState<NavigationItem | null>(null);

  const fetchNavItems = React.useCallback(async () => {
    try {
      setLoading(true);
      const navCollection = collection(db, "navigation");
      const q = query(navCollection, orderBy("order"));
      const navSnapshot = await getDocs(q);
      const itemsList = navSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as NavigationItem)
      );
      setNavItems(itemsList);
    } catch (error) {
      toast({
        title: "Erro ao buscar itens de navegação",
        description: "Não foi possível carregar a estrutura do menu.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchNavItems();
  }, [fetchNavItems]);
  
  const saveOrder = async (itemsToSave: NavigationItem[]) => {
      setIsSaving(true);
      try {
          const batch = writeBatch(db);
          itemsToSave.forEach((item) => {
              const docRef = doc(db, "navigation", item.id);
              batch.update(docRef, { 
                  order: item.order,
                  parentId: item.parentId
              });
          });
          await batch.commit();
          toast({
              title: "Estrutura do Menu Salva!",
              description: "A nova ordem do menu foi salva com sucesso.",
          });
          setNavItems(itemsToSave.sort((a,b) => a.order - b.order));
      } catch (error) {
          console.error("Error saving order: ", error);
          toast({
              title: "Erro ao salvar",
              description: "Não foi possível salvar a nova ordem do menu.",
              variant: "destructive",
          });
          fetchNavItems();
      } finally {
          setIsSaving(false);
      }
  }

  const handleMove = (itemId: string, direction: "up" | "down") => {
    const items = [...navItems];
    const itemIndex = items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;

    const item = items[itemIndex];
    const parentId = item.parentId;

    const siblingItems = items.filter(i => i.parentId === parentId).sort((a, b) => a.order - b.order);
    const siblingIndex = siblingItems.findIndex(i => i.id === itemId);
    
    let targetIndex = -1;
    if (direction === "up" && siblingIndex > 0) {
      targetIndex = items.findIndex(i => i.id === siblingItems[siblingIndex - 1].id);
    } else if (direction === "down" && siblingIndex < siblingItems.length - 1) {
      targetIndex = items.findIndex(i => i.id === siblingItems[siblingIndex + 1].id);
    }

    if (targetIndex === -1) return;

    const tempOrder = items[itemIndex].order;
    items[itemIndex].order = items[targetIndex].order;
    items[targetIndex].order = tempOrder;

    const updatedItems = [...items].sort((a, b) => a.order - b.order);
    setNavItems(updatedItems);
    saveOrder(updatedItems);
  };
  
  const handleAddItem = async () => {
    if(!newItem.title || newItem.title.trim() === "") {
        toast({ title: "Título é obrigatório", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    try {
        const navCollection = collection(db, "navigation");
        const newDocRef = doc(navCollection);

        const itemData: NavigationItem = {
            id: newDocRef.id,
            title: newItem.title!,
            path: newItem.path || "",
            icon: newItem.icon || "Circle",
            parentId: newItem.parentId || null,
            visible: newItem.visible !== false,
            order: navItems.length,
        };
        
        await setDoc(newDocRef, itemData);

        toast({
            title: "Item Adicionado!",
            description: "O novo item foi adicionado ao menu."
        });

        fetchNavItems();
        setIsAddDialogOpen(false);
        setNewItem({ title: "", path: "", icon: "Circle", parentId: null, visible: true });
    } catch(error) {
        toast({ title: "Erro ao adicionar item", variant: "destructive" });
        console.error("Error adding item:", error)
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleOpenEditDialog = (item: NavigationItem) => {
    setEditingItem({...item});
    setIsEditDialogOpen(true);
  }
  
  const handleDuplicate = (itemToDuplicate: NavigationItem) => {
    const newItemData: Partial<Omit<NavigationItem, 'id' | 'order'>> = {
      title: `${itemToDuplicate.title} (Cópia)`,
      path: itemToDuplicate.path,
      icon: itemToDuplicate.icon,
      parentId: itemToDuplicate.parentId,
      visible: itemToDuplicate.visible,
    };
    setNewItem(newItemData);
    setIsAddDialogOpen(true);
  };

  const handleUpdateItem = async () => {
    if(!editingItem || !editingItem.title || editingItem.title.trim() === "") {
        toast({ title: "Título é obrigatório", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    try {
        const docRef = doc(db, "navigation", editingItem.id!);
        await updateDoc(docRef, {
            title: editingItem.title,
            path: editingItem.path || "",
            icon: editingItem.icon,
            parentId: editingItem.parentId || null
        });
        toast({
            title: "Item Atualizado!",
            description: "O item foi atualizado com sucesso."
        });
        fetchNavItems();
        setIsEditDialogOpen(false);
        setEditingItem(null);
    } catch (error) {
        toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const handleToggleVisibility = async (item: NavigationItem) => {
      const docRef = doc(db, "navigation", item.id);
      try {
          await updateDoc(docRef, { visible: !item.visible });
          toast({
              title: "Visibilidade alterada",
              description: `O item '${item.title}' agora está ${!item.visible ? 'visível' : 'oculto'}.`
          });
          fetchNavItems();
      } catch (error) {
          toast({ title: "Erro ao alterar visibilidade", variant: "destructive" });
      }
  }

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    const itemsToDelete = [itemToDelete.id];
    const findChildren = (parentId: string) => {
        const children = navItems.filter(item => item.parentId === parentId);
        children.forEach(child => {
            itemsToDelete.push(child.id);
            findChildren(child.id);
        });
    };
    findChildren(itemToDelete.id);

    const batch = writeBatch(db);
    itemsToDelete.forEach(id => {
        const docRef = doc(db, "navigation", id);
        batch.delete(docRef);
    });

    try {
        await batch.commit();
        toast({
            title: "Item Excluído!",
            description: `O item '${itemToDelete.title}' e seus sub-itens foram removidos.`,
            variant: "destructive",
        });
        fetchNavItems();
    } catch (error) {
        toast({ title: "Erro ao excluir", variant: "destructive" });
    } finally {
        setItemToDelete(null);
    }
  };

  const getFilteredItems = () => {
      if (!searchTerm) return navItems;
      const lowerSearch = searchTerm.toLowerCase();
      const filtered = new Set<string>();

      // Function to add an item and its ancestors
      const addItemAndParents = (itemId: string) => {
          filtered.add(itemId);
          const item = navItems.find(i => i.id === itemId);
          if (item && item.parentId) {
              addItemAndParents(item.parentId);
          }
      }
      
      // Function to add an item and its descendants
      const addItemAndDescendants = (parentId: string) => {
          navItems.filter(i => i.parentId === parentId).forEach(child => {
             filtered.add(child.id);
             addItemAndDescendants(child.id);
          });
      }

      navItems.forEach(item => {
          if (item.title.toLowerCase().includes(lowerSearch) || (item.path && item.path.toLowerCase().includes(lowerSearch))) {
              addItemAndParents(item.id);
              addItemAndDescendants(item.id);
          }
      });

      return navItems.filter(i => filtered.has(i.id));
  };

  const visibleProcessedItems = getFilteredItems();
  const getSubItems = (parentId: string | null) => visibleProcessedItems.filter(item => item.parentId === parentId).sort((a, b) => a.order - b.order);
  const topLevelItems = getSubItems(null);

  const renderItemControls = (item: NavigationItem, index: number, siblings: NavigationItem[]) => (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleVisibility(item)}>
          {item.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEditDialog(item)}>
          <Pencil className="h-4 w-4" />
      </Button>
       <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDuplicate(item)}>
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setItemToDelete(item)}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <div className="flex items-center ml-2 border-l pl-2 gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(item.id, 'up')} disabled={index === 0 || isSaving}>
            <ArrowUp className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(item.id, 'down')} disabled={index === siblings.length - 1 || isSaving}>
            <ArrowDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const SortableItem = ({ item, index, siblings, level }: { item: NavigationItem, index: number, siblings: NavigationItem[], level: number }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      marginLeft: level > 0 ? (level * 2 + 'rem') : undefined,
    };

    const subItems = getSubItems(item.id);

    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className={cn(
            "group relative",
            isDragging && "z-50 opacity-50"
        )}
      >
        <div className={cn(
            "flex items-center gap-2 p-3 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all mb-2",
            !item.visible && 'bg-muted/50 opacity-80',
            isDragging && "border-primary ring-2 ring-primary/20 shadow-xl"
        )}>
            <div 
                {...attributes} 
                {...listeners} 
                className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded-md text-muted-foreground/50 hover:text-primary transition-colors"
            >
                <GripVertical className="h-5 w-5" />
            </div>
            <div className="p-2 rounded-lg bg-primary/5 text-primary">
                <Icon name={item.icon} className="h-5 w-5" />
            </div>
            <span className="font-bold text-sm tracking-tight flex-grow">{item.title}</span>
            {renderItemControls(item, index, siblings)}
        </div>
        
        {subItems.length > 0 && !isDragging && (
          <div className="flex flex-col">
            <SortableContext items={subItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {subItems.map((subItem, idx) => (
                    <SortableItem key={subItem.id} item={subItem} index={idx} siblings={subItems} level={level + 1} />
                ))}
            </SortableContext>
          </div>
        )}
      </div>
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeItem = navItems.find(i => i.id === active.id);
    const overItem = navItems.find(i => i.id === over.id);

    if (!activeItem || !overItem) return;

    // Prevents circular dependencies (dragging a parent into its own child)
    const isDescendant = (parentId: string | null, targetId: string): boolean => {
        if (!parentId) return false;
        if (parentId === targetId) return true;
        const parent = navItems.find(i => i.id === parentId);
        return isDescendant(parent?.parentId || null, targetId);
    };

    if (isDescendant(overItem.parentId, activeItem.id)) {
        toast({ title: "Ação Inválida", description: "Você não pode mover uma pasta para dentro de si mesma.", variant: "destructive" });
        return;
    }

    const sourceParentId = activeItem.parentId;
    const targetParentId = overItem.parentId;

    let updatedNavItems = [...navItems];

    if (sourceParentId === targetParentId) {
        // Same list reordering
        const siblings = updatedNavItems.filter(i => i.parentId === sourceParentId).sort((a,b) => a.order - b.order);
        const oldIndex = siblings.findIndex(i => i.id === active.id);
        const newIndex = siblings.findIndex(i => i.id === over.id);
        const reordered = arrayMove(siblings, oldIndex, newIndex);
        
        updatedNavItems = updatedNavItems.map(item => {
            if (item.parentId === sourceParentId) {
                const siblingIdx = reordered.findIndex(s => s.id === item.id);
                if (siblingIdx !== -1) return { ...item, order: siblingIdx };
            }
            return item;
        });
    } else {
        // Move across lists fully flexible
        let sourceSiblings = updatedNavItems.filter(i => i.parentId === sourceParentId).sort((a,b) => a.order - b.order);
        sourceSiblings = sourceSiblings.filter(i => i.id !== active.id);
        
        let targetSiblings = updatedNavItems.filter(i => i.parentId === targetParentId).sort((a,b) => a.order - b.order);
        let targetIndex = targetSiblings.findIndex(i => i.id === over.id);
        if (targetIndex === -1) targetIndex = targetSiblings.length;
        
        const modifiedActiveItem = { ...activeItem, parentId: targetParentId };
        targetSiblings.splice(targetIndex, 0, modifiedActiveItem);

        updatedNavItems = updatedNavItems.map(item => {
            if (item.id === active.id) {
                return { ...modifiedActiveItem, order: targetIndex };
            }
            if (item.parentId === sourceParentId) {
                const idx = sourceSiblings.findIndex(s => s.id === item.id);
                if (idx !== -1) return { ...item, order: idx };
            }
            if (item.parentId === targetParentId && item.id !== active.id) {
                const idx = targetSiblings.findIndex(s => s.id === item.id);
                if (idx !== -1) return { ...item, order: idx };
            }
            return item;
        });
    }

    updatedNavItems.sort((a,b) => a.order - b.order);
    setNavItems(updatedNavItems);
    saveOrder(updatedNavItems);
  };

  const renderItems = (items: NavigationItem[]) => {
    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col">
                    {items.map((item, index) => (
                        <SortableItem key={item.id} item={item} index={index} siblings={items} level={0} />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight text-zinc-900 dark:text-zinc-50">
            Navegação
          </h1>
          <p className="text-muted-foreground">
            Gerencie a estrutura do menu lateral do sistema.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
              <Button size="sm" className="gap-1 shadow-md hover:shadow-lg transition-all">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Adicionar Item
                  </span>
              </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
              <DialogHeader>
                  <DialogTitle>Adicionar Novo Item ao Menu</DialogTitle>
                  <DialogDescription>
                      Preencha os detalhes para o novo item de navegação.
                  </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="title" className="text-right">Título</Label>
                      <Input id="title" value={newItem.title} onChange={(e) => setNewItem({...newItem, title: e.target.value})} className="col-span-3" placeholder="Ex: Vendas" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="path" className="text-right">Caminho</Label>
                      <Input id="path" value={newItem.path || ""} onChange={(e) => setNewItem({...newItem, path: e.target.value})} className="col-span-3" placeholder="/dashboard/vendas" />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="icon" className="text-right">Ícone</Label>
                      <IconPicker value={newItem.icon} onChange={(val) => setNewItem({...newItem, icon: val})} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="parent" className="text-right">Item Pai</Label>
                      <Select value={newItem.parentId || "null"} onValueChange={(value) => setNewItem({...newItem, parentId: value === "null" ? null : value})}>
                           <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Selecione um item pai (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="null">Nenhum (Item Principal)</SelectItem>
                              {topLevelItems.map(item => (
                                 <SelectGroup key={item.id}>
                                   <SelectItem value={item.id}>{item.title}</SelectItem>
                                   {getSubItems(item.id).map(subItem => (
                                      <SelectItem key={subItem.id} value={subItem.id} className="pl-8">
                                          - {subItem.title}
                                      </SelectItem>
                                   ))}
                                 </SelectGroup>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleAddItem} disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="animate-spin" /> : "Adicionar"}
                  </Button>
              </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-premium bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <ListTree className="text-primary w-5 h-5" />
              Estrutura do Menu
            </CardTitle>
            <CardDescription className="mt-1">
              Use os botões para reordenar, editar e ocultar os itens do menu.
              {(isSaving) && <span className="ml-2 animate-pulse text-primary font-bold">Salvando...</span>}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72 mt-2 sm:mt-0">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input 
                placeholder="Buscar menu..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl bg-background shadow-sm"
             />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : topLevelItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Search className="h-8 w-8 mb-2 opacity-50" />
                <p>Nenhum menu encontrado para sua busca.</p>
            </div>
          ) : (
              <div className="flex flex-col gap-2">
                  {renderItems(topLevelItems)}
              </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso excluirá permanentemente o item de menu <strong className="mx-1 text-zinc-900 dark:text-zinc-100">{itemToDelete?.title}</strong> e todos os seus sub-itens.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sim, excluir</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Editar Item do Menu</DialogTitle>
                    <DialogDescription>
                       Modifique os detalhes do item de navegação.
                    </DialogDescription>
                </DialogHeader>
                 {editingItem && (
                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-title" className="text-right">Título</Label>
                        <Input id="edit-title" value={editingItem.title} onChange={(e) => setEditingItem({...editingItem, title: e.target.value})} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-path" className="text-right">Caminho</Label>
                        <Input id="edit-path" value={editingItem.path || ""} onChange={(e) => setEditingItem({...editingItem, path: e.target.value})} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-icon" className="text-right">Ícone</Label>
                        <IconPicker value={editingItem.icon} onChange={(val) => setEditingItem({...editingItem, icon: val})} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-parent" className="text-right">Item Pai</Label>
                        <Select value={editingItem.parentId || "null"} onValueChange={(value) => setEditingItem({...editingItem, parentId: value === "null" ? null : value})}>
                             <SelectTrigger className="col-span-3">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="null">Nenhum (Item Principal)</SelectItem>
                                {topLevelItems.map(item => (
                                   <SelectGroup key={item.id}>
                                     <SelectItem value={item.id} disabled={item.id === editingItem.id}>{item.title}</SelectItem>
                                     {getSubItems(item.id).map(subItem => (
                                        <SelectItem key={subItem.id} value={subItem.id} className="pl-8" disabled={subItem.id === editingItem.id}>
                                            - {subItem.title}
                                        </SelectItem>
                                     ))}
                                   </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                 )}
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleUpdateItem} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar Alterações"}
                    </Button>
                </DialogFooter>
            </DialogContent>
      </Dialog>
    </div>
  );
}
