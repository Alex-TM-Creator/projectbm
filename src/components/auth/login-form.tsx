
"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import type { User } from "@/lib/definitions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type LoginFormProps = {
  logoUrl?: string | null;
};

export function LoginForm({ logoUrl }: LoginFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [resetEmail, setResetEmail] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isResetting, setIsResetting] = React.useState(false)
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const loginEmail = email
    const loginPassword = password

    if (!loginEmail || !loginPassword) {
      setError("Por favor, preencha o e-mail e a senha.")
      setIsLoading(false)
      return
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = userCredential.user;

      // Check if user is disabled in Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as User;
        if (userData.disabled) {
          await signOut(auth); // Sign out the user immediately
          setError("Sua conta está bloqueada. Entre em contato com o administrador.");
          setIsLoading(false);
          return;
        }
      } else {
         // Should not happen, but as a safeguard
         await signOut(auth);
         setError("Perfil de usuário não encontrado.");
         setIsLoading(false);
         return;
      }
      
      toast({
        title: "Login bem-sucedido!",
        description: "Redirecionando para o painel de controle.",
      })
      router.push("/dashboard")
    } catch (error: any) {
      let errorMessage = "Ocorreu um erro ao fazer login."
      switch (error.code) {
        case "auth/user-not-found":
          errorMessage = "Nenhum usuário encontrado com este e-mail."
          break
        case "auth/wrong-password":
          errorMessage = "Senha incorreta. Por favor, tente novamente."
          break
        case "auth/invalid-email":
          errorMessage = "O formato do e-mail é inválido."
          break
        case "auth/user-disabled":
          errorMessage = "Esta conta de usuário foi desabilitada."
          break;
        default:
          errorMessage = "Verifique suas credenciais e tente novamente."
          break
      }
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      toast({
        title: "E-mail necessário",
        description: "Por favor, insira seu e-mail.",
        variant: "destructive",
      });
      return;
    }
    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast({
        title: "E-mail de redefinição enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
      setIsForgotPasswordOpen(false);
    } catch (error: any) {
      let errorMessage = "Ocorreu um erro.";
      if (error.code === 'auth/user-not-found') {
        errorMessage = "Nenhum usuário encontrado com este e-mail.";
      }
      toast({
        title: "Erro ao enviar e-mail",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
    <Card className="w-full max-w-sm shadow-2xl">
      <form onSubmit={handleLogin}>
        <CardHeader className="text-center">
          {logoUrl && (
             <div className="mx-auto mb-4 h-20 flex items-center justify-center">
                <Image src={logoUrl} alt="Logo" width={200} height={80} className="object-contain" priority/>
             </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="seu.nome@empresa.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
             <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
               <a
                href="#"
                className="text-sm font-medium text-primary hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  setIsForgotPasswordOpen(true);
                  setResetEmail(email); // Pre-fill with login email
                }}
              >
                Esqueceu a senha?
              </a>
            </div>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isLoading}>
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
           <div className="text-center text-sm">
            Não tem uma conta?{" "}
            <Link href="/register" className="underline">
              Cadastre-se
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>

    <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
                Insira seu e-mail para receber um link de redefinição de senha.
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="reset-email">E-mail de Cadastro</Label>
                    <Input
                        id="reset-email"
                        type="email"
                        placeholder="seu.email@exemplo.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        disabled={isResetting}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsForgotPasswordOpen(false)} disabled={isResetting}>
                    Cancelar
                </Button>
                <Button onClick={handleForgotPassword} disabled={isResetting}>
                    {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Enviar Link
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  )
}
