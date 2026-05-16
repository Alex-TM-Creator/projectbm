
'use server';
/**
 * @fileOverview Um agente de IA para sugerir distribuição de metas semanais.
 *
 * - suggestWeeklyDistribution - Uma função que sugere uma distribuição para N períodos.
 * - WeeklyDistributionInput - O tipo de entrada para a função.
 * - WeeklyDistributionOutput - O tipo de retorno para a função.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const WeeklyDistributionInputSchema = z.object({
  goalType: z.string().describe('O tipo de meta para a qual a distribuição está sendo sugerida. Ex: Vendas de Eletrônicos'),
  periods: z.array(z.object({ id: z.string(), name: z.string() })).describe('Uma lista de períodos a serem considerados para a distribuição.'),
});
export type WeeklyDistributionInput = z.infer<typeof WeeklyDistributionInputSchema>;

const PeriodWeightSchema = z.object({
    periodId: z.string().describe('O ID do período.'),
    weight: z.number().describe('O peso percentual para este período.'),
});

const WeeklyDistributionOutputSchema = z.object({
  distribution: z.array(PeriodWeightSchema).describe('A lista de pesos de distribuição para cada período.'),
});
export type WeeklyDistributionOutput = z.infer<typeof WeeklyDistributionOutputSchema>;


export async function suggestWeeklyDistribution(input: WeeklyDistributionInput): Promise<WeeklyDistributionOutput> {
  return suggestWeeklyDistributionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestWeeklyDistributionPrompt',
  input: { schema: WeeklyDistributionInputSchema },
  output: { schema: WeeklyDistributionOutputSchema },
  prompt: `
    Você é um especialista em planejamento estratégico e vendas. Sua tarefa é sugerir uma distribuição de peso percentual para uma meta ao longo de N períodos.
    A soma total dos pesos de todos os períodos deve ser exatamente 100.

    Analise o tipo de meta e os períodos fornecidos para criar uma sugestão realista.
    Considere fatores como:
    - Início vs. fim do mês/trimestre.
    - Sazonalidades (ex: "Dezembro" geralmente tem mais peso em vendas de varejo).
    - Feriados ou eventos que possam ocorrer nos períodos mencionados.
    - O tipo de meta (metas de vendas podem ter um padrão diferente de metas de prospecção).

    Tipo de Meta: {{{goalType}}}
    Períodos Cobertos:
    {{#each periods}}
    - ID: {{this.id}}, Nome: {{this.name}}
    {{/each}}

    Retorne a distribuição no formato JSON solicitado, garantindo que a soma dos pesos seja 100.
    Cada item no array de distribuição deve conter o periodId original e o peso (weight) correspondente.
    Por exemplo, para 3 períodos, você pode sugerir:
    [
        { "periodId": "p1", "weight": 30 },
        { "periodId": "p2", "weight": 30 },
        { "periodId": "p3", "weight": 40 }
    ]
  `,
});

const suggestWeeklyDistributionFlow = ai.defineFlow(
  {
    name: 'suggestWeeklyDistributionFlow',
    inputSchema: WeeklyDistributionInputSchema,
    outputSchema: WeeklyDistributionOutputSchema,
  },
  async (input) => {
    if (input.periods.length === 0) {
        return { distribution: [] };
    }
    
    const { output } = await prompt(input);
    if (!output || !output.distribution) {
      throw new Error("A IA não conseguiu gerar uma sugestão.");
    }
    
    // Normalize to ensure the sum is exactly 100
    const totalWeight = output.distribution.reduce((sum, item) => sum + item.weight, 0);
    
    if (totalWeight === 0) {
      // Avoid division by zero, return an equal distribution
      const equalWeight = 100 / input.periods.length;
      const normalizedDistribution = input.periods.map(p => ({ periodId: p.id, weight: equalWeight }));
      // Adjust last item to make sure sum is exactly 100
      let sum = normalizedDistribution.reduce((acc, p) => acc + p.weight, 0);
      let diff = 100 - sum;
      normalizedDistribution[normalizedDistribution.length-1].weight += diff;
      return { distribution: normalizedDistribution };
    }

    let accumulatedWeight = 0;
    const normalizedDistribution = output.distribution.map((item, index) => {
        if (index === output.distribution.length - 1) {
            // Last item gets the remainder to ensure sum is 100
            return { periodId: item.periodId, weight: 100 - accumulatedWeight };
        }
        const normalizedWeight = Math.round((item.weight / totalWeight) * 100);
        accumulatedWeight += normalizedWeight;
        return { periodId: item.periodId, weight: normalizedWeight };
    });

    return { distribution: normalizedDistribution };
  }
);
