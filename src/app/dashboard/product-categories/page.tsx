
"use client";

import * as React from "react";
import { PlusCircle, Loader2, ListTree, ArrowUp, ArrowDown, Pencil, Eye, EyeOff, Copy, Trash2, Grab, ChevronDown, ChevronRight, Folder, FolderOpen, Tag } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { ProductCategory } from "@/lib/definitions";
import { cn } from "@/lib/utils";

type CategoryWithChildren = ProductCategory & { children: CategoryWithChildren[] };

const CategoryItem = ({ item, level, handleOpenDialog, setItemToDelete }: { item: CategoryWithChildren, level: number, handleOpenDialog: (category?: Partial<ProductCategory>) => void, setItemToDelete: (item: ProductCategory | null) => void }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    
    const levelConfig = {
        'category': { icon: isOpen ? FolderOpen : Folder, color: "text-sky-600", label: "Categoria" },
        'group': { icon: Folder, color: "text-amber-600", label: "Grupo" },
        'subgroup': { icon: Tag, color: "text-teal-600", label: "Subgrupo" },
    };
    
    const currentConfig = levelConfig[item.level];
    const marginLeft = `${level * 24}px`;

    return (
        <div style={{ marginLeft }} className="flex flex-col">
            <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors group">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(!isOpen)} disabled={item.children.length === 0}>
                    {item.children.length > 0 && (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                </Button>
                <currentConfig.icon className={cn("h-5 w-5", currentConfig.color)} />
                <span className="font-medium flex-1">{item.name}</span>
                
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    {item.level !== 'subgroup' && (
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog({ name: "", level: item.level === 'category' ? 'group' : 'subgroup', parentId: item.id })}>
                            <PlusCircle className="h-4 w-4 mr-1" /> Adicionar
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(item)}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setItemToDelete(item)}><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                </div>
            </div>
            {isOpen && item.children.length > 0 && (
                <div className="flex flex-col">
                    {item.children.map(child => <CategoryItem key={child.id} item={child} level={level + 1} handleOpenDialog={handleOpenDialog} setItemToDelete={setItemToDelete} />)}
                </div>
            )}
        </div>
    );
};


export default function ProductCategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = React.useState<ProductCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentCategory, setCurrentCategory] = React.useState<Partial<ProductCategory>>({});
  const [itemToDelete, setItemToDelete] = React.useState<ProductCategory | null>(null);

  const isEditing = !!currentCategory.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const dataCollection = collection(db, "productCategories");
      const q = query(dataCollection, orderBy("order"));
      const dataSnapshot = await getDocs(q);
      const itemsList = dataSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ProductCategory));
      setCategories(itemsList);
    } catch (error) {
      toast({
        title: "Erro ao buscar categorias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (category?: Partial<ProductCategory>) => {
    setCurrentCategory(category || { name: "", level: "category", parentId: null });
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentCategory({});
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!currentCategory.name || !currentCategory.level) {
        toast({ title: "Nome e Nível são obrigatórios.", variant: "destructive" });
        return;
    }
    
    setIsSubmitting(true);
    try {
      const dataToSave = {
        name: currentCategory.name,
        level: currentCategory.level,
        parentId: currentCategory.parentId || null,
        order: currentCategory.order ?? categories.filter(c => c.parentId === currentCategory.parentId).length,
      };

      if (isEditing) {
        await updateDoc(doc(db, "productCategories", currentCategory.id!), dataToSave);
        toast({ title: "Item atualizado com sucesso!" });
      } else {
        await addDoc(collection(db, "productCategories"), dataToSave);
        toast({ title: "Item cadastrado com sucesso!" });
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
    if (!itemToDelete) return;

    const idsToDelete: string[] = [itemToDelete.id];
    
    const findChildrenRecursive = (parentId: string) => {
        const children = categories.filter(c => c.parentId === parentId);
        for (const child of children) {
            idsToDelete.push(child.id);
            findChildrenRecursive(child.id);
        }
    };
    findChildrenRecursive(itemToDelete.id);

    const batch = writeBatch(db);
    idsToDelete.forEach(id => {
        batch.delete(doc(db, "productCategories", id));
    });

    try {
        await batch.commit();
        toast({ title: "Itens excluídos com sucesso!", variant: "destructive" });
        fetchData();
    } catch (error) {
        toast({ title: "Erro ao excluir itens", variant: "destructive" });
    } finally {
        setItemToDelete(null);
    }
  };

  const categoryTree = React.useMemo(() => {
    const map: { [id: string]: CategoryWithChildren } = {};
    const roots: CategoryWithChildren[] = [];

    categories.forEach(item => {
      map[item.id] = { ...item, children: [] };
    });

    categories.forEach(item => {
      if (item.parentId && map[item.parentId]) {
        map[item.parentId].children.push(map[item.id]);
        map[item.parentId].children.sort((a,b) => a.order - b.order);
      } else {
        roots.push(map[item.id]);
      }
    });

    return roots.sort((a,b) => a.order - b.order);
  }, [categories]);

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Categorias de Produto</h1>
            <p className="text-muted-foreground">Gerencie a hierarquia de categorias, grupos e subgrupos.</p>
          </div>
          <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Nova Categoria</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Estrutura de Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
             <AlertDialog>
                 <div className="space-y-1">
                   {categoryTree.map(item => <CategoryItem key={item.id} item={item} level={0} handleOpenDialog={handleOpenDialog} setItemToDelete={setItemToDelete} />)}
                 </div>
                {itemToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso excluirá permanentemente o item <strong className="mx-1">{itemToDelete.name}</strong> e todos os seus sub-itens.
                    </AlertDialogDescription>
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
      </div>
      
       <Dialog open={open} onOpenChange={setOpen}>
         <DialogContent onCloseAutoFocus={handleCloseDialog}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Item' : 'Novo Item'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={currentCategory.name || ""} onChange={(e) => setCurrentCategory(p => ({ ...p, name: e.target.value }))} disabled={isSubmitting}/>
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
