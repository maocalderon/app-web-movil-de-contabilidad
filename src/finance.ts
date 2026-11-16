export type MovementKind = "income" | "expense" | "card" | "payment";

export type FinancialMovement = {
  amount: number;
  kind: MovementKind;
};

export function calculateSummary(
  movements: FinancialMovement[],
  openingCardDebt = 0,
) {
  const income = movements
    .filter((movement) => movement.kind === "income")
    .reduce((total, movement) => total + movement.amount, 0);
  const cashExpenses = movements
    .filter((movement) => movement.kind === "expense")
    .reduce((total, movement) => total + movement.amount, 0);
  const cardPurchases = movements
    .filter((movement) => movement.kind === "card")
    .reduce((total, movement) => total + movement.amount, 0);
  const cardPayments = movements
    .filter((movement) => movement.kind === "payment")
    .reduce((total, movement) => total + movement.amount, 0);

  return {
    income,
    expenses: cashExpenses + cardPurchases,
    balance: income - cashExpenses - cardPayments,
    cardDebt: Math.max(0, openingCardDebt + cardPurchases - cardPayments),
  };
}
