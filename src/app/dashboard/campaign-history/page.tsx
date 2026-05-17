
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, PlusCircle, MoreHorizontal, Pencil, Trash2, Image as ImageIcon, X, CalendarIcon, BriefcaseBusiness, Download, Ban } from "lucide-react";
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Campaign, CampaignMedia, Role } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format, isBefore, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";


type CampaignStatus = "active" | "scheduled" | "finished";
type StatusVariant = "default" | "secondary" | "outline";

const getCampaignStatus = (campaign: Campaign): { text: string; variant: StatusVariant; status: CampaignStatus } => {
  const now = new Date();
  if (campaign.startDate) {
    const startDate = parseISO(campaign.startDate);
    if (isAfter(startDate, now)) {
      return { text: "Agendada", variant: "outline", status: "scheduled" };
    }
  }
  if (campaign.endDate) {
    const endDate = parseISO(campaign.endDate);
    if (isBefore(endDate, now)) {
      return { text: "Encerrada", variant: "secondary", status: "finished" };
    }
  }
  return { text: "Ativa", variant: "default", status: "active" };
};


export default function CampaignHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // State for editing
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editingCampaign, setEditingCampaign] = React.useState<Campaign | null>(null);
  const [newFiles, setNewFiles] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<{ url: string; type: string }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // State for deleting
  const [campaignToDelete, setCampaignToDelete] = React.useState<Campaign | null>(null);

  // State for filtering
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [yearFilter, setYearFilter] = React.useState<string>("all");
  const [monthFilter, setMonthFilter] = React.useState<string>("all");

  const fetchCampaigns = React.useCallback(async () => {
    try {
      setLoading(true);
      const [campaignsSnap, rolesSnap] = await Promise.all([
        getDocs(query(collection(db, "campaigns"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "roles"))
      ]);
      
      const fetchedCampaigns = campaignsSnap.docs.map(doc => {
          const data = doc.data();
          // Backward compatibility for old imageUrls
          if (data.imageUrls && !data.media) {
              data.media = data.imageUrls.map((url: string) => ({ url, type: 'image/jpeg' }));
          }
          return { id: doc.id, ...data } as Campaign;
      });

      setCampaigns(fetchedCampaigns);
      setRoles(rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role)));

    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast({
        title: "Erro ao buscar campanhas",
        description: "Não foi possível carregar o histórico de campanhas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const { years, months } = React.useMemo(() => {
    const years = new Set<string>();
    const months = new Set<string>();
    campaigns.forEach(c => {
      if (c.createdAt?.toDate) {
        const date = c.createdAt.toDate();
        years.add(date.getFullYear().toString());
        months.add((date.getMonth() + 1).toString().padStart(2, '0'));
      }
    });
    return {
      years: Array.from(years).sort((a, b) => b.localeCompare(a)),
      months: Array.from(months).sort()
    };
  }, [campaigns]);

  const filteredCampaigns = React.useMemo(() => {
    return campaigns.filter(campaign => {
      const status = getCampaignStatus(campaign).status;
      const createdAtDate = campaign.createdAt?.toDate();

      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }
      if (yearFilter !== "all" && createdAtDate?.getFullYear().toString() !== yearFilter) {
        return false;
      }
      if (monthFilter !== "all" && (createdAtDate?.getMonth() + 1).toString().padStart(2, '0') !== monthFilter) {
        return false;
      }
      return true;
    });
  }, [campaigns, statusFilter, yearFilter, monthFilter]);

  const formatDateOnly = (dateString?: string) => {
     if (!dateString) return "N/D";
     return format(parseISO(dateString), "dd/MM/yyyy");
  }

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "N/D";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : parseISO(timestamp);
      return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return "Data inválida";
    }
  };

  const handleOpenEditDialog = (campaign: Campaign) => {
    setEditingCampaign(JSON.parse(JSON.stringify(campaign))); // Deep copy
    setNewFiles([]);
    setPreviews([]);
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingCampaign(null);
    setNewFiles([]);
    setPreviews([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const validFiles = filesArray.filter(file => {
        if (file.size > 60 * 1024 * 1024) { // 60MB limit
          toast({
            title: "Arquivo muito grande",
            description: `O arquivo "${file.name}" excede o limite de 60MB.`,
            variant: "destructive"
          });
          return false;
        }
        return true;
      });

      setNewFiles(prev => [...prev, ...validFiles]);

      const newPreviewsArray = validFiles.map(file => ({
        url: URL.createObjectURL(file),
        type: file.type
      }));
      setPreviews(prev => [...prev, ...newPreviewsArray]);
    }
  };

  const removeExistingMedia = (index: number) => {
    if (!editingCampaign) return;
    setEditingCampaign({
      ...editingCampaign,
      media: editingCampaign.media.filter((_, i) => i !== index),
    });
  };

  const removeNewMedia = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      URL.revokeObjectURL(previews[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleRoleSelectionInEdit = (roleId: string) => {
    if (!editingCampaign) return;
    const currentRoles = editingCampaign.targetRoleIds || [];
    let newSelection: string[];

    if (roleId === 'all') {
      newSelection = currentRoles.length === roles.length ? [] : roles.map(r => r.id);
    } else {
      newSelection = [...currentRoles];
      const index = newSelection.indexOf(roleId);
      if (index > -1) {
        newSelection.splice(index, 1);
      } else {
        newSelection.push(roleId);
      }
    }
    setEditingCampaign({...editingCampaign, targetRoleIds: newSelection});
  }
  
  const handleUpdateCampaign = async () => {
    if (!editingCampaign || !editingCampaign.title.trim() || !editingCampaign.text.trim()) {
      toast({ title: "Campos obrigatórios", description: "Título e texto são necessários.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const newMedia: CampaignMedia[] = await Promise.all(
        newFiles.map(async (file) => {
          const storageRef = ref(storage, `campaigns/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);
          return { url: downloadURL, type: file.type };
        })
      );
      
      const finalMedia = [...(editingCampaign.media || []), ...newMedia];

      const campaignDocRef = doc(db, "campaigns", editingCampaign.id);
      await updateDoc(campaignDocRef, {
        title: editingCampaign.title,
        text: editingCampaign.text,
        media: finalMedia,
        startDate: editingCampaign.startDate || null,
        endDate: editingCampaign.endDate || null,
        targetRoleIds: editingCampaign.targetRoleIds || [],
        allowDownload: editingCampaign.allowDownload,
      });

      toast({ title: "Campanha Atualizada!", description: "As alterações foram salvas com sucesso." });
      handleCloseEditDialog();
      fetchCampaigns();
    } catch(error) {
      console.error("Error updating campaign:", error);
      toast({ title: "Erro ao atualizar", description: "Não foi possível salvar as alterações.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    try {
      if (campaignToDelete.media && campaignToDelete.media.length > 0) {
        await Promise.all(campaignToDelete.media.map(item => {
          try {
            const mediaRef = ref(storage, item.url);
            return deleteObject(mediaRef);
          } catch (storageError) {
             console.warn(`Could not delete media from storage: ${item.url}`, storageError);
             return Promise.resolve();
          }
        }));
      }
      
      await deleteDoc(doc(db, "campaigns", campaignToDelete.id));
      
      toast({ title: "Campanha Excluída", description: "A campanha foi removida com sucesso.", variant: "destructive" });
      fetchCampaigns();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast({ title: "Erro ao excluir", description: "Não foi possível remover a campanha.", variant: "destructive" });
    } finally {
      setCampaignToDelete(null);
    }
  }

  const getTargetRolesText = (targetRoleIds?: string[]) => {
    if (!targetRoleIds || targetRoleIds.length === 0 || targetRoleIds.length === roles.length) {
      return "Todos";
    }
    if (targetRoleIds.length > 2) {
      return `${targetRoleIds.length} funções`;
    }
    return targetRoleIds.map(id => roles.find(r => r.id === id)?.name).filter(Boolean).join(', ');
  }

  const selectedRolesText = React.useMemo(() => {
    if (!editingCampaign?.targetRoleIds || editingCampaign.targetRoleIds.length === 0) return "Para todos";
    if (editingCampaign.targetRoleIds.length === roles.length) return "Para todos";
    if (editingCampaign.targetRoleIds.length === 1) return roles.find(r => r.id === editingCampaign.targetRoleIds?.[0])?.name;
    return `${editingCampaign.targetRoleIds.length} funções selecionadas`;
  }, [editingCampaign, roles]);


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Histórico de Campanhas
          </h1>
          <p className="text-muted-foreground">
            Gerencie todas as campanhas já publicadas.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchCampaigns} disabled={loading}>
                <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
            </Button>
            <Button onClick={() => router.push('/dashboard/create-campaign')}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar Campanha
            </Button>
        </div>
      </div>

    <Card>
        <CardHeader>
            <CardTitle>Campanhas Publicadas</CardTitle>
            <CardDescription>
                Filtre e gerencie a lista de todas as campanhas criadas. 
                Mostrando {filteredCampaigns.length} de {campaigns.length} campanhas.
            </CardDescription>
             <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue placeholder="Filtrar por status..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="active">Ativa</SelectItem>
                        <SelectItem value="scheduled">Agendada</SelectItem>
                        <SelectItem value="finished">Encerrada</SelectItem>
                    </SelectContent>
                </Select>
                 <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger><SelectValue placeholder="Filtrar por ano..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Anos</SelectItem>
                        {years.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                </Select>
                 <Select value={monthFilter} onValueChange={setMonthFilter}>
                    <SelectTrigger><SelectValue placeholder="Filtrar por mês..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Meses</SelectItem>
                        {months.map(month => (
                          <SelectItem key={month} value={month}>
                            {format(new Date(2000, parseInt(month) - 1, 1), "MMMM", { locale: ptBR })}
                          </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent>
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
             <AlertDialog>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Criação</TableHead>
                            <TableHead>Vigência</TableHead>
                            <TableHead>Direcionamento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Download</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCampaigns.map((campaign) => {
                            const status = getCampaignStatus(campaign);
                            return (
                            <TableRow key={campaign.id}>
                                <TableCell className="font-medium">{campaign.title}</TableCell>
                                <TableCell>{formatDateTime(campaign.createdAt)}</TableCell>
                                <TableCell>
                                    {campaign.startDate || campaign.endDate ? (
                                        `${formatDateOnly(campaign.startDate)} - ${formatDateOnly(campaign.endDate)}`
                                    ): (
                                        <span className="text-muted-foreground">Sempre Ativa</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{getTargetRolesText(campaign.targetRoleIds)}</Badge>
                                </TableCell>
                                 <TableCell>
                                  <Badge variant={status.variant} className={status.status === 'active' ? 'bg-green-600 text-white' : ''}>
                                    {status.text}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={campaign.allowDownload ? "secondary" : "outline"} className="gap-1.5">
                                    {campaign.allowDownload ? <Download className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                                    {campaign.allowDownload ? "Permitido" : "Bloqueado"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleOpenEditDialog(campaign)}>
                                          <Pencil className="mr-2 h-4 w-4" /> Editar
                                        </DropdownMenuItem>
                                        <AlertDialogTrigger asChild>
                                          <DropdownMenuItem className="text-destructive" onSelect={e => {e.preventDefault(); setCampaignToDelete(campaign)}}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                          </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                </Table>
                {campaignToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso irá excluir permanentemente a campanha "{campaignToDelete.title}".
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setCampaignToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteCampaign}>Sim, excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
                )}
             </AlertDialog>
            )}
        </CardContent>
    </Card>

      {/* Edit Dialog */}
      {editingCampaign && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-3xl" onInteractOutside={(e) => e.preventDefault()} onCloseAutoFocus={handleCloseEditDialog}>
            <DialogHeader>
              <DialogTitle>Editar Campanha</DialogTitle>
              <DialogDescription>Faça as alterações na sua campanha e salve.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título</Label>
                <Input id="edit-title" value={editingCampaign.title} onChange={e => setEditingCampaign({...editingCampaign, title: e.target.value})} disabled={isSubmitting}/>
              </div>

               <div className="space-y-2">
                  <Label>Direcionamento</Label>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal">
                              <BriefcaseBusiness className="mr-2 h-4 w-4" />
                              {selectedRolesText}
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                          <DropdownMenuLabel>Direcionar para</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuCheckboxItem
                              checked={editingCampaign.targetRoleIds?.length === roles.length && roles.length > 0}
                              onCheckedChange={() => handleRoleSelectionInEdit('all')}
                          >
                              Todos
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuSeparator />
                          {roles.map(role => (
                              <DropdownMenuCheckboxItem
                                  key={role.id}
                                  checked={editingCampaign.targetRoleIds?.includes(role.id)}
                                  onCheckedChange={() => handleRoleSelectionInEdit(role.id)}
                              >
                                  {role.name}
                              </DropdownMenuCheckboxItem>
                          ))}
                      </DropdownMenuContent>
                  </DropdownMenu>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="startDate">Data de Início</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal", !editingCampaign.startDate && "text-muted-foreground")}
                            disabled={isSubmitting}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editingCampaign.startDate ? format(parseISO(editingCampaign.startDate), "dd 'de' MMMM, yyyy", { locale: ptBR }) : <span>Selecione uma data</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={editingCampaign.startDate ? parseISO(editingCampaign.startDate) : undefined}
                            onSelect={(date) => setEditingCampaign({...editingCampaign, startDate: date?.toISOString()})}
                            initialFocus
                            locale={ptBR}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="space-y-2">
                     <Label htmlFor="endDate">Data de Fim</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal", !editingCampaign.endDate && "text-muted-foreground")}
                            disabled={isSubmitting}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editingCampaign.endDate ? format(parseISO(editingCampaign.endDate), "dd 'de' MMMM, yyyy", { locale: ptBR }) : <span>Selecione uma data</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={editingCampaign.endDate ? parseISO(editingCampaign.endDate) : undefined}
                            onSelect={(date) => setEditingCampaign({...editingCampaign, endDate: date?.toISOString()})}
                            initialFocus
                            locale={ptBR}
                            disabled={editingCampaign.startDate ? { before: parseISO(editingCampaign.startDate) } : undefined}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

              <div className="space-y-2">
                <Label htmlFor="edit-text">Texto</Label>
                <Textarea id="edit-text" value={editingCampaign.text} onChange={e => setEditingCampaign({...editingCampaign, text: e.target.value})} rows={6} disabled={isSubmitting}/>
              </div>
              <div className="space-y-4">
                <Label>Mídia</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {editingCampaign.media && editingCampaign.media.map((media, index) => (
                    <div key={media.url} className="relative aspect-square">
                       {media.type.startsWith("image/") ? (
                        <Image src={media.url} alt={`Mídia existente ${index + 1}`} fill className="rounded-md object-cover"/>
                      ) : (
                        <video src={media.url} className="rounded-md object-cover w-full h-full" controls />
                      )}
                      <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => removeExistingMedia(index)} disabled={isSubmitting}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {previews.map((preview, index) => (
                     <div key={preview.url} className="relative aspect-square">
                      {preview.type.startsWith("image/") ? (
                        <Image src={preview.url} alt={`Nova mídia ${index + 1}`} fill className="rounded-md object-cover" />
                      ) : (
                        <video src={preview.url} className="rounded-md object-cover w-full h-full" controls />
                      )}
                       <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => removeNewMedia(index)} disabled={isSubmitting}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center w-full">
                  <label htmlFor="edit-dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <ImageIcon className="w-8 h-8 mb-4 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Adicionar mais mídias</span></p>
                    </div>
                    <Input id="edit-dropzone-file" type="file" className="hidden" multiple onChange={handleFileChange} accept="image/*,video/mp4" ref={fileInputRef} disabled={isSubmitting} />
                  </label>
                </div>
              </div>
                <div className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="allowDownload" className="text-base">Permitir Download</Label>
                            <p className="text-xs text-muted-foreground">
                                Se ativado, os usuários poderão baixar as mídias desta campanha.
                            </p>
                        </div>
                        <Switch
                            id="allowDownload"
                            checked={editingCampaign.allowDownload}
                            onCheckedChange={(checked) => setEditingCampaign({...editingCampaign!, allowDownload: checked})}
                            disabled={isSubmitting}
                        />
                    </div>
                </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseEditDialog} disabled={isSubmitting}>Cancelar</Button>
              <Button onClick={handleUpdateCampaign} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
