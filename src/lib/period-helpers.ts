
import type { Period, PeriodGroup } from './definitions';
import { isBefore, isAfter, parseISO } from 'date-fns';

type StatusVariant = "default" | "secondary" | "outline" | "destructive";

export const getPeriodStatus = (period: Period): { text: string; variant: StatusVariant } => {
  if (!period.startDate || !period.endDate) {
    return { text: "Inválido", variant: "destructive" };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to the start of the day
  try {
    const startDate = parseISO(period.startDate);
    const endDate = parseISO(period.endDate);

    if (isBefore(endDate, today)) {
      return { text: "Encerrado", variant: "secondary" };
    }
    if (isAfter(startDate, today)) {
      return { text: "Agendado", variant: "outline" };
    }
    return { text: "Ativo", variant: "default" };
  } catch {
    return { text: "Inválido", variant: "destructive" };
  }
};

export const getGroupStatus = (group: PeriodGroup): { text: string; variant: StatusVariant } => {
  if (!group.periods || group.periods.length === 0) {
    return { text: "Vazio", variant: "secondary" };
  }
  const statuses = group.periods.map(p => getPeriodStatus(p).text);
  if (statuses.includes("Ativo")) {
    return { text: "Ativo", variant: "default" };
  }
  if (statuses.includes("Agendado")) {
    return { text: "Agendado", variant: "outline" };
  }
  return { text: "Encerrado", variant: "secondary" };
};
