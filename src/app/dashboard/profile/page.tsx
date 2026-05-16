
"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { onAuthStateChanged, updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth"
import { auth, db, storage } from "@/lib/firebase"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { doc, updateDoc, getDoc, collection, getDocs, query, where } from "firebase/firestore"
import { Loader2 } from "lucide-react"
import type { User, Branch, CompanyBranch } from "@/lib/definitions"

export default function ProfilePage() {
  const { toast } = useToast()
  const [user, setUser] = React.useState<any>(null)
  const [userData, setUserData] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [isUploading, setIsUploading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);

  const [name, setName] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  
  const [branchName, setBranchName] = React.useState<string>('');
  const [companyBranchName, setCompanyBranchName] = React.useState<string>('');


  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        setName(currentUser.displayName || '');
        
        try {
            const userDocRef = doc(db, "users", currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const fetchedUserData = userDocSnap.data() as User;
                setUserData(fetchedUserData);

                // Fetch related data
                const [branchesSnap, companyBranchesSnap] = await Promise.all([
                    getDocs(collection(db, "branches")),
                    getDocs(query(collection(db, "companyBranches"), where("branchId", "==", fetchedUserData.branchId)))
                ]);

                const branch = branchesSnap.docs.find(d => d.id === fetchedUserData.branchId)?.data() as Branch;
                setBranchName(branch?.name || 'N/A');

                if (!companyBranchesSnap.empty) {
                    const companyBranch = companyBranchesSnap.docs[0].data() as CompanyBranch;
                    setCompanyBranchName(companyBranch.nome_fantasia || companyBranch.razao_social || 'N/A');
                } else {
                    setCompanyBranchName('Nenhuma empresa filial vinculada');
                }
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            toast({ title: "Erro ao carregar dados do perfil", variant: "destructive" });
        }

      }
      setLoading(false)
    });
    return () => unsubscribe()
  }, [toast])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && user) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "Arquivo muito grande",
          description: "Por favor, selecione uma imagem com menos de 10MB.",
          variant: "destructive",
        });
        return;
      }
      setIsUploading(true);
      try {
        const storageRef = ref(storage, `avatars/${user.uid}/${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Update auth profile
        await updateProfile(user, { photoURL: downloadURL });
        
        // Update firestore document
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { avatarUrl: downloadURL });

        // Update local state to re-render avatar
        setUser({ ...user, photoURL: downloadURL });

        toast({
          title: "Avatar Atualizado!",
          description: "Sua nova foto de perfil foi salva.",
        });

      } catch (error) {
        toast({
          title: "Erro no Upload",
          description: "Não foi possível salvar seu novo avatar.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    }
  }


  const handleSaveChanges = async () => {
    if (!user || !name.trim()) {
      toast({ title: "Nome inválido", description: "O nome não pode estar em branco.", variant: "destructive" });
      return;
    }
    
    setIsSaving(true);
    try {
      // Update auth profile
      if (user.displayName !== name) {
        await updateProfile(user, { displayName: name });
      }
      
      // Update firestore document
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { name: name });

      setUser({ ...user, displayName: name });
      
      toast({
        title: "Perfil Atualizado!",
        description: "Suas informações foram salvas com sucesso.",
      })
    } catch (error) {
       toast({
        title: "Erro ao Salvar",
        description: "Não foi possível atualizar suas informações.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false);
    }
  }
  
  const handlePasswordChange = async () => {
     if (!currentPassword || !newPassword || !confirmPassword) {
        toast({ title: "Campos Incompletos", description: "Por favor, preencha todos os campos de senha.", variant: "destructive" });
        return;
     }
     if (newPassword !== confirmPassword) {
        toast({ title: "Senhas não coincidem", description: "A nova senha e a confirmação devem ser iguais.", variant: "destructive" });
        return;
     }
     if (newPassword.length < 6) {
        toast({ title: "Senha muito curta", description: "A nova senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
        return;
     }

     setIsChangingPassword(true);
     try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        await updatePassword(user, newPassword);

        toast({
            title: "Senha Alterada!",
            description: "Sua senha foi atualizada com sucesso.",
        });
        
        // Clear password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

     } catch (error) {
        let errorMessage = "Ocorreu um erro ao alterar a senha.";
        if ((error as any).code === 'auth/wrong-password') {
            errorMessage = "A senha atual está incorreta.";
        }
        toast({
            title: "Erro ao Alterar Senha",
            description: errorMessage,
            variant: "destructive",
        });
     } finally {
        setIsChangingPassword(false);
     }
  }
  
  if (loading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
       <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground">Gerencie suas informações pessoais e de segurança.</p>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Informações Pessoais</CardTitle>
                    <CardDescription>Atualize seu nome, e-mail e avatar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`} />
                            <AvatarFallback>{name?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="picture">
                              {isUploading ? "Enviando..." : "Avatar"}
                            </Label>
                            <Input id="picture" type="file" className="text-sm" onChange={handleAvatarChange} disabled={isUploading || isSaving} accept="image/png, image/jpeg, image/gif"/>
                            <p className="text-xs text-muted-foreground">PNG, JPG, GIF até 10MB</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome Completo</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">E-mail</Label>
                        <Input id="email" type="email" defaultValue={user.email || ''} readOnly disabled/>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label htmlFor="branch">Filial</Label>
                          <Input id="branch" value={branchName} readOnly disabled/>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="companyBranch">Empresa Filial</Label>
                          <Input id="companyBranch" value={companyBranchName} readOnly disabled/>
                      </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Alterações
                    </Button>
                </CardFooter>
            </Card>
        </div>
        
        <div>
           <Card>
                <CardHeader>
                    <CardTitle>Segurança</CardTitle>
                    <CardDescription>Altere sua senha de acesso.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="current-password">Senha Atual</Label>
                        <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={isChangingPassword}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-password">Nova Senha</Label>
                        <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isChangingPassword}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                        <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isChangingPassword}/>
                    </div>
                </CardContent>
                 <CardFooter>
                    <Button onClick={handlePasswordChange} disabled={isChangingPassword}>
                       {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Alterar Senha
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>
    </div>
  )
}
