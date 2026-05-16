
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  User,
  Target,
  Award,
  DollarSign,
  BarChart2,
  Megaphone,
  WandSparkles,
} from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { User as UserType } from "@/lib/definitions";
import { Loader2 } from "lucide-react";

const FeatureCard = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-start gap-4 rounded-lg border p-4">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
      {icon}
    </div>
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  </div>
);

const WelcomeSection = ({ userName }: { userName: string }) => {
  const [greeting, setGreeting] = React.useState('');

  React.useEffect(() => {
    const getGreeting = () => {
      const currentHour = new Date().getHours();
      if (currentHour < 12) {
        return "Bom dia";
      } else if (currentHour < 18) {
        return "Boa tarde";
      } else {
        return "Boa noite";
      }
    };
    setGreeting(getGreeting());
  }, []);
  
  if (!greeting) return null;

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <WandSparkles className="h-8 w-8" />
          </div>
          <div>
            <CardTitle className="text-2xl md:text-3xl font-bold text-primary">
              {greeting}, {userName.split(' ')[0]}!
            </CardTitle>
            <CardDescription>Seja bem-vindo(a) ao seu portal de sucesso.</CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};


export default function SellerSummaryPage() {
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<UserType | null>(null);

  React.useEffect(() => {
    const fetchUserData = async () => {
        if(user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                setUserData(userDocSnap.data() as UserType);
            }
        }
    };
    if(user) {
        fetchUserData();
    }
  }, [user]);

  if (authLoading || (user && !userData)) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      
      {userData && <WelcomeSection userName={userData.name} />}

      <Card>
        <CardHeader>
          <CardTitle>O que o sistema oferece para você?</CardTitle>
          <CardDescription>
            Este é o seu centro de controle para transformar esforço em recompensa. Acompanhe seu progresso, entenda suas metas e veja suas conquistas virarem realidade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FeatureCard icon={<BarChart2 className="h-6 w-6" />} title="Meu Desempenho diário">
              Acesse uma tela dedicada para ver seu progresso, quanto falta para a próxima meta e sua projeção de resultados.
            </FeatureCard>
            <FeatureCard icon={<Award className="h-6 w-6" />} title="Cálculo de Prêmios Transparente">
              Entenda exatamente como seus prêmios e bônus são calculados, com base nas regras definidas, sem surpresas.
            </FeatureCard>
            <FeatureCard icon={<DollarSign className="h-6 w-6" />} title="Pega Pix: Ranking e Prêmios">
              Acompanhe sua posição no ranking e o valor do prêmio acumulado nas metas "Pega Pix".
            </FeatureCard>
            <FeatureCard icon={<Megaphone className="h-6 w-6" />} title="Campanhas e Notificações">
              Fique por dentro de todas as novidades, campanhas de incentivo e comunicados importantes da empresa diretamente no seu painel.
            </FeatureCard>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
