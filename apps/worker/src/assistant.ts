import { companies, findCompany, type AssistantAnswer, type Company } from "@invest-vitals/domain";

function companyAnswer(company: Company): AssistantAnswer {
  const weakest = [...company.healthComponents].sort((a, b) => a.score - b.score)[0];
  return {
    answer: `${company.name} is currently ${company.healthLabel.toLowerCase()} at ${company.health}/100. ${company.keyChange} ${company.aiSummary.at(-1) ?? ""}`,
    highlights: [
      { label: "Health", value: `${company.health}/100` },
      { label: "Momentum", value: company.momentum },
      { label: "Main watch item", value: weakest?.label ?? "No material issue" },
    ],
    followUps: [
      `What changed for ${company.symbol}?`,
      `Is ${company.symbol}'s thesis intact?`,
      `Compare ${company.symbol} and MSFT`,
    ],
  };
}

export function answerQuestion(question: string): AssistantAnswer {
  const normalized = question.toUpperCase();
  const mentioned = companies.filter(
    (company) => normalized.includes(company.symbol) || normalized.includes(company.name.toUpperCase()),
  );

  if (/WORR|CONCERN|ATTENTION|WEAK/.test(normalized)) {
    const concern = [...companies].sort((a, b) => a.health - b.health)[0];
    if (concern) {
      return {
        answer: `${concern.name} deserves the most attention. Its health score is ${concern.health}/100 and ${concern.momentum.toLowerCase()}. ${concern.keyChange} This is a review signal, not a prediction or a buy/sell recommendation.`,
        highlights: [
          { label: "Health", value: `${concern.health}/100` },
          { label: "Score change", value: `${concern.healthDelta} points` },
          { label: "Thesis", value: concern.thesisStatus },
        ],
        followUps: [`Why did ${concern.symbol} fall?`, `Show ${concern.symbol}'s risks`, "Which holding is strongest?"],
      };
    }
  }

  if (/STRONG|HEALTHIEST|BEST/.test(normalized)) {
    const strongest = [...companies].sort((a, b) => b.health - a.health)[0];
    if (strongest) return companyAnswer(strongest);
  }

  if (/COMPARE|VERSUS| VS /.test(normalized) && mentioned.length >= 2) {
    const [first, second] = mentioned;
    if (first && second) {
      const leader = first.health >= second.health ? first : second;
      const other = leader === first ? second : first;
      return {
        answer: `${leader.name} has the stronger current health profile (${leader.health} vs ${other.health}) and ${leader.momentum.toLowerCase()} momentum. ${other.name} is ${other.valuationLabel.toLowerCase()} on valuation. The better fit depends on which evidence matters to your thesis; neither result is a buy or sell signal.`,
        highlights: [
          { label: leader.symbol, value: `${leader.health} health · ${leader.momentum}` },
          { label: other.symbol, value: `${other.health} health · ${other.momentum}` },
          { label: "Valuation", value: `${leader.symbol}: ${leader.valuationLabel} · ${other.symbol}: ${other.valuationLabel}` },
        ],
        followUps: [`Explain ${leader.symbol}'s score`, `Show ${other.symbol}'s risks`, "Which has stronger cash flow?"],
      };
    }
  }

  const direct = mentioned[0] ?? (normalized.match(/[A-Z]{2,5}/)?.[0] ? findCompany(normalized.match(/[A-Z]{2,5}/)?.[0] ?? "") : undefined);
  if (direct) return companyAnswer(direct);

  return {
    answer: "Your portfolio is healthy overall, but the signal is mixed. Microsoft and Meta have the strongest combination of fundamentals and momentum. Apple and Amazon deserve attention because recent growth and momentum weakened. I explain current evidence only—I do not predict prices or issue buy/sell calls.",
    highlights: [
      { label: "Average health", value: "83/100" },
      { label: "Strongest", value: "MSFT · 92" },
      { label: "Needs attention", value: "AAPL · 69" },
    ],
    followUps: ["Which holding worries you?", "Why did AAPL health fall?", "Compare MSFT and GOOGL"],
  };
}
