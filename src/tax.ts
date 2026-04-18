export type Region = 'england' | 'scotland';

export interface Band {
  name: string;
  rate: number;
  upTo: number; // inclusive upper bound of the band in absolute salary terms; Infinity for the top band
}

export interface Breakdown {
  gross: number;
  pension: number;
  employerPension: number;
  totalPensionPot: number;
  taxable: number;
  personalAllowance: number;
  incomeTax: number;
  nationalInsurance: number;
  takeHome: number;
  incomeTaxBands: { name: string; rate: number; taxed: number; tax: number }[];
  niBands: { name: string; rate: number; taxed: number; tax: number }[];
}

// 2025/26 tax year
const BASE_PERSONAL_ALLOWANCE = 12_570;
const PA_TAPER_START = 100_000;

// Income tax bands are expressed as thresholds relative to the *personal
// allowance*. The amount taxed in a band depends on the taxable income above
// the personal allowance but the absolute salary thresholds reported to users
// are easier to reason about — these are 2025/26 figures.
const englandBands = (pa: number): Band[] => [
  { name: 'Basic rate', rate: 0.2, upTo: pa + 37_700 }, // up to £50,270 when PA = £12,570
  { name: 'Higher rate', rate: 0.4, upTo: 125_140 },
  { name: 'Additional rate', rate: 0.45, upTo: Infinity },
];

const scotlandBands = (pa: number): Band[] => [
  { name: 'Starter rate', rate: 0.19, upTo: pa + 2_827 },
  { name: 'Basic rate', rate: 0.2, upTo: pa + 14_921 },
  { name: 'Intermediate rate', rate: 0.21, upTo: pa + 31_092 },
  { name: 'Higher rate', rate: 0.42, upTo: 75_000 },
  { name: 'Advanced rate', rate: 0.45, upTo: 125_140 },
  { name: 'Top rate', rate: 0.48, upTo: Infinity },
];

// Employee Class 1 NI 2025/26
const niBands: Band[] = [
  { name: 'NI (0%)', rate: 0, upTo: 12_570 },
  { name: 'NI (8%)', rate: 0.08, upTo: 50_270 },
  { name: 'NI (2%)', rate: 0.02, upTo: Infinity },
];

function computePersonalAllowance(adjustedIncome: number): number {
  if (adjustedIncome <= PA_TAPER_START) return BASE_PERSONAL_ALLOWANCE;
  const reduction = Math.min(
    BASE_PERSONAL_ALLOWANCE,
    Math.floor((adjustedIncome - PA_TAPER_START) / 2)
  );
  return BASE_PERSONAL_ALLOWANCE - reduction;
}

function taxBands(income: number, pa: number, bands: Band[]) {
  let previous = pa; // income below pa is tax-free
  const taxable = Math.max(0, income - pa);
  let remaining = taxable;
  const rows = bands.map((b) => {
    const bandWidth = Math.max(0, b.upTo - previous);
    const taxed = Math.max(0, Math.min(remaining, bandWidth));
    const tax = taxed * b.rate;
    remaining -= taxed;
    previous = b.upTo;
    return { name: b.name, rate: b.rate, taxed, tax };
  });
  return rows;
}

function niBreakdown(income: number) {
  let previous = 0;
  let remaining = income;
  return niBands.map((b) => {
    const bandWidth = Math.max(0, b.upTo - previous);
    const taxed = Math.max(0, Math.min(remaining, bandWidth));
    const tax = taxed * b.rate;
    remaining -= taxed;
    previous = b.upTo;
    return { name: b.name, rate: b.rate, taxed, tax };
  });
}

export function calculate(
  gross: number,
  region: Region,
  pension: number,
  employerPension: number = 0
): Breakdown {
  const safeGross = Math.max(0, gross || 0);
  const safePension = Math.max(0, Math.min(pension || 0, safeGross));
  const safeEmployer = Math.max(0, employerPension || 0);

  // Salary-sacrifice style: pension comes off gross before tax & NI.
  const adjusted = safeGross - safePension;
  const pa = computePersonalAllowance(adjusted);
  const bands = region === 'scotland' ? scotlandBands(pa) : englandBands(pa);

  const incomeTaxRows = taxBands(adjusted, pa, bands);
  const incomeTax = incomeTaxRows.reduce((s, r) => s + r.tax, 0);

  const niRows = niBreakdown(adjusted);
  const ni = niRows.reduce((s, r) => s + r.tax, 0);

  return {
    gross: safeGross,
    pension: safePension,
    employerPension: safeEmployer,
    totalPensionPot: safePension + safeEmployer,
    taxable: Math.max(0, adjusted - pa),
    personalAllowance: pa,
    incomeTax,
    nationalInsurance: ni,
    takeHome: adjusted - incomeTax - ni,
    incomeTaxBands: incomeTaxRows,
    niBands: niRows,
  };
}

export interface PensionSuggestion {
  pension: number;
  takeHomeLoss: number; // reduction in take-home vs. no pension
  pensionGained: number; // money in pension pot
  effectiveCost: number; // takeHomeLoss / pensionGained — £ lost per £ saved
  reason: string;
}

export function pensionSuggestions(
  gross: number,
  region: Region
): PensionSuggestion[] {
  const base = calculate(gross, region, 0);
  const suggestions: { pension: number; reason: string }[] = [];

  // Bring income down to the £100k PA taper cliff — the highest marginal band
  // for most people (60%+ effective thanks to PA withdrawal).
  if (gross > PA_TAPER_START) {
    suggestions.push({
      pension: gross - PA_TAPER_START,
      reason: 'Escape the 60% personal-allowance taper above £100,000',
    });
  }

  // Bring income down to the higher-rate threshold.
  const higherThreshold = region === 'scotland' ? 43_662 : 50_270;
  if (gross > higherThreshold) {
    suggestions.push({
      pension: gross - higherThreshold,
      reason:
        region === 'scotland'
          ? 'Drop below the 42% Scottish higher-rate band'
          : 'Drop below the 40% higher-rate band',
    });
  }

  // Scotland-specific advanced-rate cliff.
  if (region === 'scotland' && gross > 75_000) {
    suggestions.push({
      pension: gross - 75_000,
      reason: 'Drop below the 45% Scottish advanced-rate band',
    });
  }

  // A "sensible" 10% contribution for context.
  suggestions.push({
    pension: Math.round(gross * 0.1),
    reason: 'A typical 10% of gross salary contribution',
  });

  return suggestions
    .filter((s) => s.pension > 0 && s.pension < gross)
    .map((s) => {
      const after = calculate(gross, region, s.pension);
      const loss = base.takeHome - after.takeHome;
      return {
        pension: s.pension,
        takeHomeLoss: loss,
        pensionGained: s.pension,
        effectiveCost: loss / s.pension,
        reason: s.reason,
      };
    })
    .sort((a, b) => a.effectiveCost - b.effectiveCost)
    .filter(
      (s, i, arr) => arr.findIndex((x) => x.pension === s.pension) === i
    );
}
