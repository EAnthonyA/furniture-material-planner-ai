import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type CataloguePageProps = {
  searchParams: Promise<{ q?: string; availability?: string }>;
};

type Dimensions = {
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
};

function hasDimensions(value: unknown): value is Dimensions {
  if (!value || typeof value !== "object") {
    return false;
  }

  const dimensions = value as Record<string, unknown>;
  return ["lengthMm", "widthMm", "thicknessMm"].every(
    (key) => typeof dimensions[key] === "number",
  );
}

function formatDimensions(value: unknown) {
  if (!hasDimensions(value)) {
    return "Matmenys nenurodyti";
  }

  return `${value.lengthMm} × ${value.widthMm} × ${value.thicknessMm} mm`;
}

function formatPrice(cents: number | null) {
  if (cents === null) {
    return "—";
  }

  return new Intl.NumberFormat("lt-LT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDate(date: Date | undefined) {
  if (!date) {
    return "Dar nestebėta";
  }

  return new Intl.DateTimeFormat("lt-LT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function CataloguePage({
  searchParams,
}: CataloguePageProps) {
  const { q = "", availability = "all" } = await searchParams;
  const products = await prisma.storeProduct.findMany({
    where: { store: "SENUKAI" },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      url: true,
      species: true,
      dimensionsMm: true,
      observations: {
        orderBy: { observedAt: "desc" },
        take: 1,
        select: {
          priceCents: true,
          conditionalCents: true,
          availability: true,
          observedAt: true,
        },
      },
    },
  });

  const normalizedQuery = q.trim().toLocaleLowerCase("lt-LT");
  const filteredProducts = products.filter((product) => {
    const observation = product.observations[0];
    const matchesQuery =
      !normalizedQuery ||
      [product.title, product.species, formatDimensions(product.dimensionsMm)]
        .filter(Boolean)
        .some((value) =>
          value?.toLocaleLowerCase("lt-LT").includes(normalizedQuery),
        );
    const matchesAvailability =
      availability === "all" || observation?.availability === availability;

    return matchesQuery && matchesAvailability;
  });
  const availableCount = products.filter(
    (product) => product.observations[0]?.availability === "PARDUODAMA",
  ).length;
  const soldOutCount = products.filter(
    (product) => product.observations[0]?.availability === "IŠPARDUOTA",
  ).length;
  const lastImportedAt = products
    .map((product) => product.observations[0]?.observedAt)
    .filter((date): date is Date => Boolean(date))
    .sort((first, second) => second.getTime() - first.getTime())[0];

  return (
    <main className="catalogue-page" id="main-content">
      <a className="skip-link" href="#catalogue-results">
        Pereiti prie katalogo
      </a>
      <header className="topbar catalogue-topbar">
        <Link className="brand" href="/" aria-label="Dirbtuvės, pradžia">
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <span>Dirbtuvės</span>
        </Link>
        <Link className="catalogue-back-link" href="/">
          ← Projektai
        </Link>
      </header>

      <section className="catalogue-intro" aria-labelledby="catalogue-title">
        <div>
          <p className="eyebrow">Senukai · katalogo patikra</p>
          <h1 id="catalogue-title">
            Įvežtos
            <br />
            <em>medžiagos.</em>
          </h1>
        </div>
        <div className="catalogue-intro-note">
          <p>
            Šis sąrašas rodo paskutinį kiekvienos prekės kainos ir prieinamumo
            stebėjimą. Kainos saugomos atskirai nuo produkto, todėl vėliau bus
            galima palyginti jų istoriją.
          </p>
          <p className="catalogue-imported-at">
            Atnaujinta {formatDate(lastImportedAt)}
          </p>
        </div>
      </section>

      <section className="catalogue-ledger" aria-labelledby="catalogue-results">
        <header className="catalogue-summary">
          <p>
            <strong>{products.length}</strong> įvežtos prekės
          </p>
          <p>
            <span
              className="availability-dot is-available"
              aria-hidden="true"
            />
            {availableCount} parduodamos
          </p>
          <p>
            <span className="availability-dot is-sold-out" aria-hidden="true" />
            {soldOutCount} išparduotos
          </p>
        </header>

        <form className="catalogue-filters" role="search">
          <label htmlFor="catalogue-search">
            Ieškoti medžiagos
            <input
              defaultValue={q}
              id="catalogue-search"
              name="q"
              placeholder="Pvz., eglė, 18 mm, 3000"
              type="search"
            />
          </label>
          <label htmlFor="catalogue-availability">
            Prieinamumas
            <select
              defaultValue={availability}
              id="catalogue-availability"
              name="availability"
            >
              <option value="all">Visos prekės</option>
              <option value="PARDUODAMA">Parduodamos</option>
              <option value="IŠPARDUOTA">Išparduotos</option>
            </select>
          </label>
          <button type="submit">Filtruoti</button>
        </form>

        <p className="catalogue-result-count" id="catalogue-results">
          Rodomos {filteredProducts.length} iš {products.length} prekių
        </p>

        {filteredProducts.length ? (
          <div className="catalogue-table-wrap">
            <table className="catalogue-table">
              <thead>
                <tr>
                  <th scope="col">Prekė</th>
                  <th scope="col">Medžiaga</th>
                  <th scope="col">Matmenys</th>
                  <th scope="col">Kaina</th>
                  <th scope="col">Būsena</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const observation = product.observations[0];
                  const isSoldOut = observation?.availability === "IŠPARDUOTA";

                  return (
                    <tr key={product.id}>
                      <td data-label="Prekė">
                        <a href={product.url} rel="noreferrer" target="_blank">
                          {product.title}
                          <span aria-hidden="true"> ↗</span>
                        </a>
                      </td>
                      <td data-label="Medžiaga">
                        {product.species || "Nenurodyta"}
                      </td>
                      <td data-label="Matmenys">
                        {formatDimensions(product.dimensionsMm)}
                      </td>
                      <td className="catalogue-price" data-label="Kaina">
                        <strong>
                          {formatPrice(observation?.priceCents ?? null)}
                        </strong>
                        {observation?.conditionalCents !== null &&
                        observation?.conditionalCents !== undefined ? (
                          <small>
                            Lojalumo:{" "}
                            {formatPrice(observation.conditionalCents)}
                          </small>
                        ) : null}
                      </td>
                      <td data-label="Būsena">
                        <span
                          className={
                            isSoldOut
                              ? "availability-tag is-sold-out"
                              : "availability-tag"
                          }
                        >
                          {isSoldOut ? "Išparduota" : "Parduodama"}
                        </span>
                        <small className="catalogue-observed-at">
                          {formatDate(observation?.observedAt)}
                        </small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="catalogue-empty" role="status">
            <p className="eyebrow">Nerasta</p>
            <h2>Nė viena prekė neatitinka šio filtro.</h2>
            <Link href="/catalog">Rodyti visas prekes</Link>
          </div>
        )}
      </section>
    </main>
  );
}
