
"use client";

import * as React from "react";
import { Loader2, Image as ImageIcon, X, Send, CalendarIcon, BriefcaseBusiness, Download } from "lucide-react";
import { collection, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Role } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";


export default function CreateCampaignPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [mediaFiles, setMediaFiles] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<{ url: string; type: string }[]>([]);
  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [endDate, setEndDate] = React.useState<Date | undefined>();
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [targetRoleIds, setTargetRoleIds] = React.useState<string[]>([]);
  const [allowDownload, setAllowDownload] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const fetchRoles = async () => {
      try {
        const rolesSnap = await getDocs(collection(db, "roles"));
        setRoles(rolesSnap.docs.map(d => ({id: d.id, ...d.data()} as Role)));
      } catch (error) {
        toast({ title: "Erro ao buscar funções", variant: "destructive" });
      }
    };
    fetchRoles();
  }, [toast]);

  const resetForm = () => {
    setTitle("");
    setText("");
    setMediaFiles([]);
    setPreviews([]);
    setStartDate(undefined);
    setEndDate(undefined);
    setTargetRoleIds([]);
    setAllowDownload(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

      setMediaFiles(prev => [...prev, ...validFiles]);

      const newPreviews = validFiles.map(file => ({
        url: URL.createObjectURL(file),
        type: file.type,
      }));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      URL.revokeObjectURL(previews[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleRoleSelection = (roleId: string) => {
    setTargetRoleIds(prev => {
      if (roleId === 'all') {
        return prev.length === roles.length ? [] : roles.map(r => r.id);
      }
      const newSelection = [...prev];
      const index = newSelection.indexOf(roleId);
      if (index > -1) {
        newSelection.splice(index, 1);
      } else {
        newSelection.push(roleId);
      }
      return newSelection;
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !text.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Título e texto da campanha são necessários.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const mediaUrls: { url: string; type: string }[] = await Promise.all(
        mediaFiles.map(async (file) => {
          const storageRef = ref(storage, `campaigns/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);
          return { url: downloadURL, type: file.type };
        })
      );

      const campaignsCollection = collection(db, "campaigns");
      await addDoc(campaignsCollection, {
        title,
        text,
        media: mediaUrls,
        createdAt: serverTimestamp(),
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        targetRoleIds: targetRoleIds,
        allowDownload: allowDownload,
      });

      toast({
        title: "Campanha Criada!",
        description: "Sua nova campanha foi salva e está pronta para ser visualizada.",
      });

      resetForm();
    } catch (error) {
      console.error("Error creating campaign: ", error);
      toast({
        title: "Erro ao criar campanha",
        description: "Não foi possível salvar a campanha.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const selectedRolesText = React.useMemo(() => {
    if (targetRoleIds.length === 0) return "Para todos";
    if (targetRoleIds.length === roles.length) return "Para todos";
    if (targetRoleIds.length === 1) return roles.find(r => r.id === targetRoleIds[0])?.name;
    return `${targetRoleIds.length} funções selecionadas`;
  }, [targetRoleIds, roles]);

  return (
    <div className="flex flex-col gap-6">
       <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Criar Campanha</h1>
        <p className="text-muted-foreground">Anexe imagens ou vídeos e escreva o texto para sua próxima campanha.</p>
      </div>
      <form onSubmit={handleSubmit}>
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle>Nova Campanha</CardTitle>
            <CardDescription>
              Preencha os detalhes abaixo para publicar uma nova campanha no feed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base">Título da Campanha</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Lançamento de Verão" disabled={isSubmitting} />
            </div>

            <div className="space-y-2">
                <Label className="text-base">Direcionamento</Label>
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
                            checked={targetRoleIds.length === roles.length && roles.length > 0}
                            onCheckedChange={() => handleRoleSelection('all')}
                        >
                            Todos
                        </DropdownMenuCheckboxItem>
                         <DropdownMenuSeparator />
                        {roles.map(role => (
                            <DropdownMenuCheckboxItem
                                key={role.id}
                                checked={targetRoleIds.includes(role.id)}
                                onCheckedChange={() => handleRoleSelection(role.id)}
                            >
                                {role.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="startDate">Data de Início (Opcional)</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                            )}
                            disabled={isSubmitting}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "dd 'de' MMMM, yyyy", { locale: ptBR }) : <span>Selecione uma data</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                            locale={ptBR}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="space-y-2">
                     <Label htmlFor="endDate">Data de Fim (Opcional)</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                            )}
                            disabled={isSubmitting}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "dd 'de' MMMM, yyyy", { locale: ptBR }) : <span>Selecione uma data</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                            locale={ptBR}
                            disabled={{ before: startDate }}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="text" className="text-base">Texto da Campanha</Label>
              <Textarea id="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Descreva sua campanha aqui..." rows={8} disabled={isSubmitting} />
            </div>
            <div className="space-y-4">
              <Label htmlFor="media" className="text-base">Mídia da Campanha</Label>
              <div className="flex items-center justify-center w-full">
                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ImageIcon className="w-8 h-8 mb-4 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Clique para enviar</span> ou arraste e solte</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, MP4 (MAX. 60MB por arquivo)</p>
                  </div>
                  <Input id="dropzone-file" type="file" className="hidden" multiple onChange={handleFileChange} accept="image/*,video/mp4" ref={fileInputRef} disabled={isSubmitting} />
                </label>
              </div>
              {previews.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {previews.map((preview, index) => (
                    <div key={index} className="relative aspect-square">
                      {preview.type.startsWith("image/") ? (
                        <Image src={preview.url} alt={`Preview ${index + 1}`} fill className="rounded-md object-cover" />
                      ) : (
                        <video src={preview.url} className="rounded-md object-cover w-full h-full" controls />
                      )}
                      <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => handleRemoveMedia(index)} disabled={isSubmitting}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
                        checked={allowDownload}
                        onCheckedChange={setAllowDownload}
                        disabled={isSubmitting}
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSubmitting} size="lg">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Publicar Campanha
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
