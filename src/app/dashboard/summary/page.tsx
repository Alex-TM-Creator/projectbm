
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Users,
  Shield,
  Target,
  DollarSign,
  BarChart2,
  Settings,
  Rocket,
  Megaphone,
  User,
  WandSparkles,
} from "lucide-react";

const FeatureCard = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-start gap-4">
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
      {icon}
    </div>
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  </div>
);

export default function SummaryPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-bold font-headline tracking-tight text-primary">
          Conheça o Sistema Conect
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Uma plataforma completa para gestão de metas, premiações e engajamento da equipe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Para que serve o Conect?</CardTitle>
          <CardDescription>
            O Conect foi desenhado para alinhar, motivar e recompensar. Ele centraliza a definição de metas, automatiza o cálculo de prêmios e mantém a equipe informada e engajada, transformando o ambiente de trabalho em um motor de resultados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={<Target className="h-6 w-6" />} title="Gestão de Metas Simplificada">
              Defina metas claras e diversificadas (por valor, níveis, etc.) para indivíduos, filiais ou funções, tudo em um só lugar.
            </FeatureCard>
            <FeatureCard icon={<WandSparkles className="h-6 w-6" />} title="Cálculo de Prêmios Automatizado">
              Diga adeus às planilhas complexas. O sistema calcula automaticamente as premiações com base nas regras que você define, garantindo transparência e precisão.
            </FeatureCard>
            <FeatureCard icon={<Megaphone className="h-6 w-6" />} title="Comunicação Direcionada">
              Publique campanhas e notificações para toda a equipe ou para grupos específicos, garantindo que a mensagem certa chegue às pessoas certas.
            </FeatureCard>
            <FeatureCard icon={<User className="h-6 w-6" />} title="Visão de Desempenho Pessoal">
              Capacite cada vendedor com uma visão clara de seu próprio desempenho, projeções e o quanto falta para atingir o próximo nível.
            </FeatureCard>
             <FeatureCard icon={<BarChart2 className="h-6 w-6" />} title="Relatórios Gerenciais">
              Acesse relatórios consolidados por vendedor, filial ou função para tomar decisões estratégicas baseadas em dados.
            </FeatureCard>
            <FeatureCard icon={<Settings className="h-6 w-6" />} title="Flexibilidade e Controle">
              Personalize desde os tipos de metas e premiações até o acesso de cada usuário no menu, adaptando o sistema à sua realidade.
            </FeatureCard>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-bold font-headline">O que o sistema oferece para cada perfil?</h2>
        <p className="text-muted-foreground">Veja os principais benefícios para você.</p>
      </div>

      <Accordion type="multiple" className="w-full space-y-4" defaultValue={['sellers', 'managers']}>
        <AccordionItem value="sellers" className="border rounded-lg">
          <AccordionTrigger className="p-4 text-lg font-medium hover:no-underline">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6" />
              Para Vendedores e Colaboradores
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-6 pt-0 space-y-4">
             <p className="text-muted-foreground">
                Seu portal para acompanhar o sucesso, entender suas metas e ver suas conquistas se transformarem em recompensas.
            </p>
            <ul className="list-disc space-y-3 pl-5">
              <li>
                <strong>Meu Desempenho:</strong> Uma tela dedicada para você ver seu progresso diário, quanto falta para a próxima meta e qual sua projeção de resultados.
              </li>
              <li>
                <strong>Cálculo de Prêmios Transparente:</strong> Veja exatamente como seus prêmios são calculados, sem surpresas.
              </li>
              <li>
                <strong>Campanhas e Notificações:</strong> Fique por dentro de todas as novidades, campanhas de incentivo e comunicados importantes da empresa.
              </li>
               <li>
                <strong>Pega Pix:</strong> Acompanhe seu ranking e o prêmio acumulado nas metas "Pega Pix".
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="managers" className="border rounded-lg">
          <AccordionTrigger className="p-4 text-lg font-medium hover:no-underline">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6" />
              Para Administradores e Gestores
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-6 pt-0 space-y-4">
             <p className="text-muted-foreground">
                A ferramenta completa para gerenciar sua equipe, definir estratégias e impulsionar os resultados de forma centralizada e eficiente.
            </p>
             <ul className="list-disc space-y-3 pl-5">
              <li>
                <strong>Criação de Metas Flexível:</strong> Crie metas para vendedores, filiais ou funções. Defina metas por valor ou por níveis (Bronze, Prata, Ouro, Diamante).
              </li>
               <li>
                <strong>Lançamento de Resultados:</strong> Insira os valores realizados de forma manual ou via importação de planilha (CSV) para agilizar o processo.
              </li>
               <li>
                <strong>Sistema de Premiação Customizável:</strong> Crie regras de premiação variadas, como bônus fixo, percentual sobre vendas, comissão por faixas e bônus por atingimento cumulativo de níveis.
              </li>
              <li>
                <strong>Relatórios Detalhados:</strong> Monitore o desempenho da equipe com relatórios consolidados por vendedor, filial e função, permitindo uma análise completa.
              </li>
               <li>
                <strong>Controle de Acesso:</strong> Defina exatamente quais seções do menu cada função pode acessar, garantindo que os usuários vejam apenas o que é relevante para eles.
              </li>
               <li>
                <strong>Gestão de Pagamentos:</strong> Gere ordens de pagamento com base nos prêmios calculados, adicione bônus ou descontos e mantenha um histórico de tudo o que foi pago.
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

