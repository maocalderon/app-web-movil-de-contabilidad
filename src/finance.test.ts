import { describe, expect, it } from "vitest";
import { calculateSummary } from "./finance";

describe("calculateSummary", () => {
  it("empieza en cero cuando no hay datos registrados", () => {
    expect(calculateSummary([])).toEqual({
      income: 0,
      expenses: 0,
      balance: 0,
      cardDebt: 0,
    });
  });

  it("suma ingresos y gastos en pesos enteros", () => {
    expect(
      calculateSummary([
        { kind: "income", amount: 2_000_000 },
        { kind: "expense", amount: 200_000 },
        { kind: "card", amount: 100_000 },
      ]),
    ).toEqual({
      income: 2_000_000,
      expenses: 300_000,
      balance: 1_800_000,
      cardDebt: 100_000,
    });
  });

  it("un pago de tarjeta reduce efectivo disponible y saldo de la tarjeta", () => {
    expect(
      calculateSummary(
        [
          { kind: "income", amount: 1_000_000 },
          { kind: "payment", amount: 250_000 },
        ],
        800_000,
      ),
    ).toEqual({
      income: 1_000_000,
      expenses: 0,
      balance: 750_000,
      cardDebt: 550_000,
    });
  });

  it("no muestra deuda negativa cuando se paga más del saldo", () => {
    expect(
      calculateSummary([{ kind: "payment", amount: 1_000_000 }]).cardDebt,
    ).toBe(0);
  });
});
