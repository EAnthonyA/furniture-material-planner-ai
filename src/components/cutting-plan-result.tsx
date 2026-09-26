import type {
  CutRequirement,
  CuttingPlanResult as CuttingPlan,
  PurchasePlan,
} from "@/lib/domain/cutting-plan";

type CuttingPlanResultProps = {
  result: CuttingPlan;
  requirements: CutRequirement[];
};

function formatPrice(cents: number | null) {
  if (cents === null) {
    return "Kaina nenurodyta";
  }

  return new Intl.NumberFormat("lt-LT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function dimensions(lengthMm: number, widthMm: number) {
  return `${formatNumber(lengthMm)} × ${formatNumber(widthMm)} mm`;
}

function PurchasePlanDetails({ plan }: { plan: PurchasePlan }) {
  return (
    <>
      <section
        className="purchase-recommendation"
        aria-labelledby="buy-list-title"
      >
        <p className="eyebrow" id="buy-list-title">
          Pirkti
        </p>
        <p className="purchase-count">
          <strong>{plan.boards.length}</strong> ×
        </p>
        <div>
          <a href={plan.stock.url} rel="noreferrer" target="_blank">
            {plan.stock.label}
          </a>
          <p>
            {dimensions(plan.stock.lengthMm, plan.stock.widthMm)} ·{" "}
            {formatPrice(plan.totalCents)}
          </p>
        </div>
      </section>

      <p className="cutting-proof-lead">
        Kiekviena detalė patalpinta konkrečioje plokštėje be persidengimų.
        Skaičiavime prie kiekvienos detalės pridėtas{" "}
        {formatNumber(plan.sawKerfMm)} mm pjūklo tarpas.
      </p>

      <section
        className="cutting-sheets"
        aria-labelledby="cutting-sheets-title"
      >
        <p className="eyebrow" id="cutting-sheets-title">
          Pjovimo įrodymas
        </p>
        {plan.boards.map((board) => (
          <article className="cutting-sheet" key={board.boardNumber}>
            <header>
              <h2>Plokštė {board.boardNumber}</h2>
              <p>
                Likutis: {Math.round(board.remainingAreaMm2 / 10_000) / 100} m²
              </p>
            </header>
            <ol>
              {board.placements.map((placement) => (
                <li key={placement.requirementId}>
                  <span>{placement.label}</span>
                  <strong>
                    {dimensions(placement.lengthMm, placement.widthMm)}
                  </strong>
                  <small>
                    Vieta: {formatNumber(placement.xMm)} ×{" "}
                    {formatNumber(placement.yMm)} mm
                    {placement.rotated ? " · pasukta 90°" : ""}
                  </small>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </section>
    </>
  );
}

export function CuttingPlanResult({
  result,
  requirements,
}: CuttingPlanResultProps) {
  if (!result.ok) {
    return (
      <section className="cutting-empty" aria-labelledby="cutting-empty-title">
        <p className="eyebrow">Pirkimo planas</p>
        <h2 id="cutting-empty-title">
          {result.reason === "NO_REQUIREMENTS"
            ? "Nėra pjaunamų detalių."
            : "Nėra tinkamos perkamos plokštės."}
        </h2>
        {result.oversizedRequirements.length ? (
          <p>
            Netelpa:{" "}
            {result.oversizedRequirements
              .map(
                (piece) =>
                  `${piece.label} (${dimensions(piece.lengthMm, piece.widthMm)})`,
              )
              .join(", ")}
            .
          </p>
        ) : (
          <p>
            Kataloge nėra parduodamų, pasirinktos medžiagos ir storio plokščių,
            iš kurių būtų galima išpjauti patvirtintą sąrašą.
          </p>
        )}
      </section>
    );
  }

  return (
    <>
      <PurchasePlanDetails plan={result.plan} />
      {result.alternatives.length ? (
        <section
          className="cutting-alternatives"
          aria-labelledby="alternatives-title"
        >
          <p className="eyebrow" id="alternatives-title">
            Kiti patikrinti variantai
          </p>
          <ul>
            {result.alternatives.map((plan) => (
              <li key={plan.stock.id}>
                <a href={plan.stock.url} rel="noreferrer" target="_blank">
                  {plan.stock.label}
                </a>
                <span>
                  {plan.boards.length} vnt. · {formatPrice(plan.totalCents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="cutting-input" aria-labelledby="cutting-input-title">
        <p className="eyebrow" id="cutting-input-title">
          Siųstas tekstinis sąrašas
        </p>
        <ul>
          {requirements.map((requirement) => (
            <li key={requirement.id}>
              <span>
                {requirement.label}
                {requirement.quantity > 1 ? ` × ${requirement.quantity}` : ""}
              </span>
              <strong>
                {dimensions(requirement.lengthMm, requirement.widthMm)}
              </strong>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
