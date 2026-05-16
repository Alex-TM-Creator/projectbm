
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, User, FileText, BarChart2, DollarSign, Database } from "lucide-react";

const InfoCard = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-start gap-4 rounded-lg border bg-card p-4">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
      {icon}
    </div>
    <div>
      <h3 className="font-semibold text-card-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  </div>
);

export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-3">
          <Shield /> Privacidade e Proteção de Dados (GDPR)
        </h1>
        <p className="text-lg text-muted-foreground">
          Análise sobre a necessidade de um Oficial de Proteção de Dados (DPO).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Análise do Sistema e Dados Coletados</CardTitle>
          <CardDescription>
            Com base na estrutura e funcionalidades atuais, o sistema coleta e processa diversos tipos de dados que são considerados Dados Pessoais Identificáveis (PII) sob o Regulamento Geral de Proteção de Dados (GDPR).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InfoCard icon={<User className="h-6 w-6" />} title="Dados Cadastrais Detalhados">
              O sistema armazena informações de Clientes, Fornecedores e Usuários, incluindo nome, e-mail, telefone, endereços e identificadores nacionais como CPF e CNPJ.
            </InfoCard>
            <InfoCard icon={<DollarSign className="h-6 w-6" />} title="Dados Financeiros e de Desempenho">
              São processadas informações de vendas, metas, premiações e transações de caixa, que estão diretamente ligadas ao desempenho e remuneração dos colaboradores e às transações com clientes.
            </InfoCard>
            <InfoCard icon={<BarChart2 className="h-6 w-6" />} title="Monitoramento de Atividade">
              O sistema registra um log de acesso (`AccessLog`), monitorando quais páginas cada usuário acessa e quando, o que caracteriza um acompanhamento regular de suas atividades na plataforma.
            </InfoCard>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-amber-700 dark:text-amber-400">Conclusão: É necessário contratar um DPO?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
           <p>
            De acordo com o Artigo 37 do GDPR, a nomeação de um Oficial de Proteção de Dados (DPO) é obrigatória quando as atividades principais do controlador ou do processador consistem em operações de tratamento que exijam um **monitoramento regular e sistemático dos titulares de dados em grande escala**.
          </p>
          <p>
            Considerando que o sistema:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Coleta e processa dados detalhados de um número potencialmente grande de clientes e funcionários.</li>
            <li>Realiza o monitoramento sistemático do desempenho e atividade dos usuários para fins de cálculo de remuneração variável e auditoria.</li>
            <li>Processa identificadores nacionais (CPF/CNPJ), que aumentam o risco associado ao tratamento de dados.</li>
          </ul>
           <p className="font-semibold text-lg">
            A recomendação é fortemente afirmativa: Sim, com base na natureza e escala do tratamento de dados realizado por este sistema, é obrigatória a nomeação de um DPO para garantir a conformidade com o GDPR.
          </p>
           <p className="text-sm text-muted-foreground">
            <strong>Próximos Passos:</strong> É crucial que sua organização contrate ou designe um profissional qualificado para a função de DPO, que será responsável por supervisionar a estratégia de proteção de dados, gerenciar riscos e atuar como ponto de contato com titulares de dados e autoridades reguladoras.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
