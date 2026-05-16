
"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { doc, setDoc, getDocs, collection } from "firebase/firestore"
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
import { Building, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"

export function RegisterForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!name || !email || !password) {
      setError("Por favor, preencha todos os campos.")
      setIsLoading(false)
      return
    }

    try {
      const usersCollection = collection(db, "users");
      const userSnapshot = await getDocs(usersCollection);
      const isFirstUser = userSnapshot.empty;

      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      await updateProfile(user, { displayName: name })
      
      let companyBranchId = "1";
      let branchId = "1";
      let roleId = "1";

      if (isFirstUser) {
        await setDoc(doc(db, "companyBranches", companyBranchId), { id: companyBranchId, nome_fantasia: 'InovaTech', razao_social: 'InovaTech Solucoes', branchId: '1' });
        await setDoc(doc(db, "branches", branchId), { id: branchId, name: 'Matriz - São Paulo' });
        await setDoc(doc(db, "roles", roleId), { id: roleId, name: 'Administrador' });
      }

      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        name: name,
        email: email,
        companyBranchId: companyBranchId,
        branchId: branchId,
        roleId: roleId,
        isAdmin: isFirstUser,
        avatarUrl: `https://picsum.photos/seed/${user.uid}/100/100`,
      });

      toast({
        title: "Cadastro realizado com sucesso!",
        description: "Você será redirecionado para a tela de login.",
      })
      router.push("/login")
    } catch (error: any) {
      let errorMessage = "Ocorreu um erro ao se cadastrar."
      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage = "Este e-mail já está em uso."
          break
        case "auth/weak-password":
          errorMessage = "A senha deve ter pelo menos 6 caracteres."
          break
        case "auth/invalid-email":
          errorMessage = "O formato do e-mail é inválido."
          break
        default:
          errorMessage = "Verifique seus dados e tente novamente."
          break
      }
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-2xl">
      <form onSubmit={handleRegister}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Building className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-headline text-2xl">Criar Conta</CardTitle>
          <CardDescription>Insira seus dados para se cadastrar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input 
              id="name" 
              type="text" 
              placeholder="Seu nome" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
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
            <Label htmlFor="password">Senha</Label>
            <Input 
              id="password" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isLoading}>
            {isLoading ? "Cadastrando..." : "Cadastrar"}
          </Button>
          <div className="text-center text-sm">
            Já tem uma conta?{" "}
            <Link href="/login" className="underline">
              Faça login
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
