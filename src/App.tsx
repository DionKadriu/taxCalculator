import { useMemo, useState } from 'react';
import { calculate, pensionSuggestions, type Region } from './tax';

const ANNUAL_ALLOWANCE = 60_000;

const gbp = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(Math.round(n));

const gbp2 = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 2,
  }).format(n);

export default function App() {
  const [salary, setSalary] = useState(60_000);
  const [region, setRegion] = useState<Region>('england');
  const [pension, setPension] = useState(0);
  const [employerPct, setEmployerPct] = useState(5);

  const employerPension = useMemo(
    () => Math.round((salary * employerPct) / 100),
    [salary, employerPct]
  );

  const pensionMax = useMemo(
    () => Math.max(1000, Math.min(Math.round(salary * 0.6), ANNUAL_ALLOWANCE)),
    [salary]
  );

  // Keep the slider value within the new cap whenever salary changes.
  const clampedPension = Math.min(pension, pensionMax);

  const result = useMemo(
    () => calculate(salary, region, clampedPension, employerPension),
    [salary, region, clampedPension, employerPension]
  );

  const suggestions = useMemo(
    () => pensionSuggestions(salary, region),
    [salary, region]
  );

  const effectiveRate =
    result.gross > 0
      ? ((result.incomeTax + result.nationalInsurance) / result.gross) * 100
      : 0;

  const allowanceUsedPct = Math.min(
    100,
    (result.totalPensionPot / ANNUAL_ALLOWANCE) * 100
  );

  return (
    <div className="page">
      <header>
        <div className="brand">UK Tax Calculator</div>
        <h1>Estimate your take-home pay</h1>
        <p className="subtitle">2025/26 tax year &middot; England &amp; Scotland</p>
      </header>

      <section className="card input-card">
        <div className="field">
          <label htmlFor="salary">Gross annual salary</label>
          <div className="input-wrap">
            <span className="prefix">£</span>
            <input
              id="salary"
              type="number"
              min={0}
              step={1000}
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="field">
          <label>Region</label>
          <div className="toggle">
            <button
              className={region === 'england' ? 'active' : ''}
              onClick={() => setRegion('england')}
            >
              England
            </button>
            <button
              className={region === 'scotland' ? 'active' : ''}
              onClick={() => setRegion('scotland')}
            >
              Scotland
            </button>
          </div>
        </div>

        <div className="field full">
          <div className="field-head">
            <label htmlFor="pension">Your pension contribution (pre-tax)</label>
            <span className="field-value">
              {gbp(clampedPension)}
              <span className="muted">
                {' '}
                · {salary > 0 ? ((clampedPension / salary) * 100).toFixed(1) : 0}
                %
              </span>
            </span>
          </div>
          <input
            id="pension"
            type="range"
            min={0}
            max={pensionMax}
            step={100}
            value={clampedPension}
            onChange={(e) => setPension(Number(e.target.value))}
          />
          <div className="range-scale">
            <span>£0</span>
            <span>Capped at {gbp(pensionMax)}</span>
          </div>
        </div>

        <div className="field full">
          <div className="field-head">
            <label htmlFor="employer">Employer pension contribution</label>
            <span className="field-value">
              {gbp(employerPension)}
              <span className="muted"> · {employerPct}% of salary</span>
            </span>
          </div>
          <input
            id="employer"
            type="range"
            min={0}
            max={15}
            step={0.5}
            value={employerPct}
            onChange={(e) => setEmployerPct(Number(e.target.value))}
          />
          <div className="range-scale">
            <span>0%</span>
            <span>15%</span>
          </div>
        </div>
      </section>

      <section className="grid">
        <div className="card stat">
          <div className="stat-label">Take-home per year</div>
          <div className="stat-value big">{gbp(result.takeHome)}</div>
          <div className="stat-sub">
            {gbp(result.takeHome / 12)} / month ·{' '}
            {gbp2(result.takeHome / 52 / 5)} / day
          </div>
        </div>
        <div className="card stat">
          <div className="stat-label">Income tax</div>
          <div className="stat-value">{gbp(result.incomeTax)}</div>
          <div className="stat-sub">{gbp(result.incomeTax / 12)} / month</div>
        </div>
        <div className="card stat">
          <div className="stat-label">National Insurance</div>
          <div className="stat-value">{gbp(result.nationalInsurance)}</div>
          <div className="stat-sub">
            {gbp(result.nationalInsurance / 12)} / month
          </div>
        </div>
        <div className="card stat">
          <div className="stat-label">Effective rate</div>
          <div className="stat-value">{effectiveRate.toFixed(1)}%</div>
          <div className="stat-sub">
            Personal allowance: {gbp(result.personalAllowance)}
          </div>
        </div>
      </section>

      {(result.pension > 0 || result.employerPension > 0) && (
        <section className="card pot-card">
          <div className="pot-head">
            <h2>Your pension pot this year</h2>
            <div className="pot-total">{gbp(result.totalPensionPot)}</div>
          </div>
          <div className="pot-grid">
            <div>
              <div className="stat-label">You contribute</div>
              <div className="pot-value">{gbp(result.pension)}</div>
              <div className="stat-sub">
                {gbp(result.pension / 12)} / month
              </div>
            </div>
            <div>
              <div className="stat-label">Employer contributes</div>
              <div className="pot-value accent">
                {gbp(result.employerPension)}
              </div>
              <div className="stat-sub">
                {gbp(result.employerPension / 12)} / month
              </div>
            </div>
            <div>
              <div className="stat-label">Annual allowance used</div>
              <div className="pot-value">{allowanceUsedPct.toFixed(0)}%</div>
              <div className="band-bar">
                <div
                  className="band-fill"
                  style={{ width: `${allowanceUsedPct}%` }}
                />
              </div>
              <div className="stat-sub">
                Limit: {gbp(ANNUAL_ALLOWANCE)} / year
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Annual breakdown</h2>
        <table className="breakdown">
          <thead>
            <tr>
              <th></th>
              <th>Per year</th>
              <th>Per month</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Gross salary</td>
              <td>{gbp(result.gross)}</td>
              <td>{gbp(result.gross / 12)}</td>
            </tr>
            {result.pension > 0 && (
              <tr className="muted">
                <td>Your pension contribution</td>
                <td>−{gbp(result.pension)}</td>
                <td>−{gbp(result.pension / 12)}</td>
              </tr>
            )}
            <tr className="muted">
              <td>Income tax</td>
              <td>−{gbp(result.incomeTax)}</td>
              <td>−{gbp(result.incomeTax / 12)}</td>
            </tr>
            <tr className="muted">
              <td>National Insurance</td>
              <td>−{gbp(result.nationalInsurance)}</td>
              <td>−{gbp(result.nationalInsurance / 12)}</td>
            </tr>
            <tr className="total">
              <td>Take-home</td>
              <td>{gbp(result.takeHome)}</td>
              <td>{gbp(result.takeHome / 12)}</td>
            </tr>
            {result.employerPension > 0 && (
              <tr className="addon">
                <td>Employer pension (on top)</td>
                <td>+{gbp(result.employerPension)}</td>
                <td>+{gbp(result.employerPension / 12)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Tax bands hit</h2>
        <div className="bands">
          {result.incomeTaxBands
            .filter((b) => b.taxed > 0)
            .map((b) => (
              <div className="band" key={b.name}>
                <div className="band-head">
                  <span>{b.name}</span>
                  <span className="rate">{(b.rate * 100).toFixed(0)}%</span>
                </div>
                <div className="band-bar">
                  <div
                    className="band-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        (b.taxed /
                          Math.max(
                            1,
                            ...result.incomeTaxBands.map((x) => x.taxed)
                          )) *
                          100
                      )}%`,
                    }}
                  />
                </div>
                <div className="band-sub">
                  {gbp(b.taxed)} taxed · {gbp(b.tax)} owed
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className="card pension-card">
        <h2>Optimise your pension contribution</h2>
        <p className="muted">
          Salary-sacrifice contributions come out of your gross pay before tax
          and NI, so £1 into your pension typically costs you well under £1 in
          take-home. The thresholds below highlight where the marginal rates
          step down.
        </p>
        {suggestions.length === 0 ? (
          <p className="muted">
            Your salary is below the higher-rate threshold — a flat 20%
            contribution is the main lever here.
          </p>
        ) : (
          <table className="breakdown">
            <thead>
              <tr>
                <th>Contribute</th>
                <th>Take-home cost</th>
                <th>£ lost per £ saved</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => (
                <tr key={s.pension}>
                  <td>
                    <strong>{gbp(s.pension)}</strong>
                    <div className="muted small">
                      {gbp(s.pension / 12)} / month
                    </div>
                  </td>
                  <td>{gbp(s.takeHomeLoss)}</td>
                  <td>{s.effectiveCost.toFixed(2)}</td>
                  <td className="reason">{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted small">
          A cost-per-£-saved below 0.60 means every £1 in your pension only
          costs about 60p in take-home — the sweet spot created by the 60%
          PA-taper between £100,000 and £125,140.
        </p>
      </section>

      <footer>
        <p className="muted small">
          Figures use 2025/26 bands. Excludes student loans, benefits in kind,
          dividend income, and Scottish NI differences (NI is reserved to
          Westminster, so rates are UK-wide). For guidance only — not financial
          advice.
        </p>
      </footer>
    </div>
  );
}
