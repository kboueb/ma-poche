export interface SimDebt {
  id: string;
  name: string;
  balance: number;
  rate: number; // % annuel
  minPayment: number;
}

export interface SimResult {
  months: number;
  totalPaid: number;
  totalInterest: number;
  curve: Array<{ month: number; remaining: number }>;
}

export function simulatePayoff(debts: SimDebt[], extraMonthly: number, strategy: "snowball" | "avalanche"): SimResult {
  // Copie de travail
  let balances = debts.map((d) => ({ ...d }));
  let month = 0;
  let totalPaid = 0;
  let totalInterest = 0;
  const startTotal = balances.reduce((s, d) => s + d.balance, 0);
  const curve: SimResult["curve"] = [{ month: 0, remaining: startTotal }];

  const order = () => {
    const active = balances.filter((b) => b.balance > 0.01);
    active.sort((a, b) =>
      strategy === "snowball" ? a.balance - b.balance : b.rate - a.rate
    );
    return active;
  };

  while (balances.some((b) => b.balance > 0.01) && month < 600) {
    month++;
    let extra = extraMonthly;

    // 1. Intérêts mensuels
    for (const b of balances) {
      if (b.balance <= 0.01) continue;
      const interest = (b.balance * (b.rate / 100)) / 12;
      b.balance += interest;
      totalInterest += interest;
    }

    // 2. Paiements minimums
    for (const b of balances) {
      if (b.balance <= 0.01) continue;
      const pay = Math.min(b.minPayment, b.balance);
      b.balance -= pay;
      totalPaid += pay;
    }

    // 3. Extra vers la cible prioritaire (+ mensualités libérées = effet boule de neige)
    let ordered = order();
    while (extra > 0.01 && ordered.length > 0) {
      const target = ordered[0];
      const pay = Math.min(extra, target.balance);
      target.balance -= pay;
      totalPaid += pay;
      extra -= pay;
      ordered = order();
    }

    // 4. Mensualités des dettes soldées redirigées vers la cible suivante
    const freed = balances
      .filter((b) => b.balance <= 0.01)
      .reduce((s, b) => s + b.minPayment, 0);
    if (freed > 0.01) {
      let remaining = freed;
      let ord = order();
      while (remaining > 0.01 && ord.length > 0) {
        const target = ord[0];
        const pay = Math.min(remaining, target.balance);
        target.balance -= pay;
        totalPaid += pay;
        remaining -= pay;
        ord = order();
      }
    }

    const remaining = balances.reduce((s, b) => s + Math.max(b.balance, 0), 0);
    curve.push({ month, remaining: Math.round(remaining * 100) / 100 });
  }

  return { months: month, totalPaid, totalInterest, curve };
}
