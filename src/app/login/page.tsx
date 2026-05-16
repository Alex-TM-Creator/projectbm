

"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { LoginForm } from '@/components/auth/login-form'
import { Loader2 } from 'lucide-react'
import type { RoleAccess, User as UserType, LoginConfiguration } from "@/lib/definitions"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as UserType;
            
            if (userData.roleId) {
                const roleAccessDocRef = doc(db, "roleAccess", userData.roleId);
                const roleAccessDocSnap = await getDoc(roleAccessDocRef);

                if (roleAccessDocSnap.exists()) {
                    const roleAccess = roleAccessDocSnap.data() as RoleAccess;
                    if (roleAccess.homePagePath) {
                        router.push(roleAccess.homePagePath);
                        return;
                    }
                }
            }
          }
          
          // Fallback for any other case (no role, no access config, etc.): go to the main dashboard page.
          router.push('/dashboard');

        } catch (error) {
          console.error("Error determining redirect path:", error);
          router.push('/dashboard'); // Safe fallback on error
        }
      } else {
        const fetchLoginConfig = async () => {
          try {
            const configDocRef = doc(db, "settings", "loginConfiguration");
            const docSnap = await getDoc(configDocRef);
            if (docSnap.exists()) {
              setLogoUrl((docSnap.data() as LoginConfiguration).logoUrl);
            }
          } catch(err) {
            console.error("Could not fetch login configuration", err);
          } finally {
            setLoading(false)
          }
        }
        fetchLoginConfig();
      }
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem] opacity-20 dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)]"></div>
      <LoginForm logoUrl={logoUrl} />
    </div>
  )
}
