
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { RegisterForm } from '@/components/auth/register-form'
import { Loader2 } from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [allowRegister, setAllowRegister] = React.useState(false)

  React.useEffect(() => {
    const checkUsers = async () => {
      try {
        const usersCollection = collection(db, "users");
        const userSnapshot = await getDocs(usersCollection);
        if (userSnapshot.empty) {
          setAllowRegister(true);
        } else {
          router.push("/login");
        }
      } catch (error) {
        console.error("Error checking for existing users:", error);
        // Fallback: redirect to login to be safe
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkUsers();
  }, [router]);


  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (!allowRegister) {
    // This state is briefly hit before the redirect in useEffect completes.
    // You can show a message or just the loader again.
    return (
       <div className="flex min-h-screen w-full items-center justify-center bg-background">
         <p className="text-muted-foreground">O registro está desabilitado.</p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem] opacity-20 dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)]"></div>
      <RegisterForm />
    </div>
  )
}
