"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import Image from "next/image"
import { Loader2, Upload } from "lucide-react"
import type { LoginConfiguration } from "@/lib/definitions"

export default function CustomizationPage() {
  const { toast } = useToast()
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null)
  const [newLogoFile, setNewLogoFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [loadingLogo, setLoadingLogo] = React.useState(true)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const fetchLogo = async () => {
      try {
        setLoadingLogo(true)
        const configDocRef = doc(db, "settings", "loginConfiguration");
        const docSnap = await getDoc(configDocRef);
        if (docSnap.exists()) {
          const config = docSnap.data() as LoginConfiguration;
          setLogoUrl(config.logoUrl);
        }
      } catch (error) {
        console.error("Error fetching logo:", error);
      } finally {
        setLoadingLogo(false);
      }
    };
    fetchLogo();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "Arquivo muito grande", description: "Por favor, selecione uma imagem com menos de 5MB.", variant: "destructive" });
        return;
      }
      setNewLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadLogo = async () => {
    if (!newLogoFile) {
      toast({ title: "Nenhum arquivo selecionado", description: "Por favor, escolha uma imagem para enviar.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      // Use a fixed path and name for the logo
      const fileRef = ref(storage, `config/login-logo.png`);
      await uploadBytes(fileRef, newLogoFile);
      const downloadURL = await getDownloadURL(fileRef);

      const configDocRef = doc(db, "settings", "loginConfiguration");
      await setDoc(configDocRef, { id: 'loginConfiguration', logoUrl: downloadURL }, { merge: true });

      setLogoUrl(downloadURL);
      setNewLogoFile(null);
      setPreviewUrl(null);

      toast({ title: "Logo atualizada!", description: "A nova logo da tela de login foi salva." });

    } catch (error) {
      console.error("Error uploading logo:", error);
      toast({ title: "Erro no upload", description: "Não foi possível salvar a nova logo. Verifique as regras de segurança do Firebase.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Personalização</h1>
        <p className="text-muted-foreground">Customize a aparência da aplicação.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Personalização do Login</CardTitle>
          <CardDescription>
            Faça o upload de uma logo para a tela de login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Logo Atual</Label>
            <div className="mt-2 flex h-32 w-full items-center justify-center rounded-md border border-dashed">
              {loadingLogo ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : logoUrl ? (
                <Image src={previewUrl || logoUrl} alt="Logo" width={200} height={80} className="object-contain" />
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma logo definida</p>
              )}
            </div>
          </div>
           <div className="space-y-2">
              <Label htmlFor="logo-upload">Nova Logo</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="logo-upload"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/webp"
                  className="flex-1"
                  disabled={isUploading}
                />
                 <Button onClick={handleUploadLogo} disabled={!newLogoFile || isUploading}>
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Salvar
                </Button>
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  )
}
