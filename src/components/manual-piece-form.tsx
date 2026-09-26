"use client";

import { useState } from "react";

type ManualPieceFormProps = {
  action: string;
};

type PieceCategory = "PANEL" | "TIMBER" | "HINGE" | "ADJUSTABLE_LEG";

const dimensionFields: Record<
  PieceCategory,
  Array<{ name: "lengthMm" | "widthMm" | "heightMm"; label: string }>
> = {
  PANEL: [
    { name: "widthMm", label: "Plotis, mm" },
    { name: "heightMm", label: "Aukštis, mm" },
  ],
  TIMBER: [
    { name: "lengthMm", label: "Ilgis, mm" },
    { name: "widthMm", label: "Plotis, mm" },
    { name: "heightMm", label: "Storis, mm" },
  ],
  HINGE: [],
  ADJUSTABLE_LEG: [],
};

export function ManualPieceForm({ action }: ManualPieceFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<PieceCategory>("PANEL");

  return (
    <section className="manual-piece" aria-labelledby="manual-piece-title">
      <div className="manual-piece-heading">
        <div>
          <p className="eyebrow" id="manual-piece-title">
            Rankinis papildymas
          </p>
          <p>
            Mažą ar neįskaitomą detalę pridėkite patys — ji keliaus kartu su
            šiuo sąrašu į kitą žingsnį.
          </p>
        </div>
        <button
          className="manual-piece-toggle"
          type="button"
          aria-expanded={isOpen}
          aria-controls="manual-piece-fields"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? "Uždaryti" : "Pridėti detalę"}
        </button>
      </div>
      {isOpen ? (
        <form action={action} className="manual-piece-form" method="post">
          <div className="manual-piece-primary-fields">
            <label>
              <span>Tipas</span>
              <select
                name="category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as PieceCategory)
                }
              >
                <option value="PANEL">Plokštė arba durelės</option>
                <option value="TIMBER">Tašas arba lenta</option>
                <option value="HINGE">Lankstai</option>
                <option value="ADJUSTABLE_LEG">Reguliuojama kojelė</option>
              </select>
            </label>
            <label>
              <span>Pavadinimas</span>
              <input
                name="label"
                placeholder="Pvz., kairė viršutinė juosta"
                required
                maxLength={120}
              />
            </label>
            <label>
              <span>Kiekis</span>
              <input
                name="quantity"
                type="number"
                min="1"
                max="99"
                step="1"
                defaultValue="1"
                required
              />
            </label>
          </div>
          {dimensionFields[category].length ? (
            <div className="manual-piece-dimensions" id="manual-piece-fields">
              {dimensionFields[category].map((field) => (
                <label key={field.name}>
                  <span>{field.label}</span>
                  <input
                    name={field.name}
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                  />
                </label>
              ))}
            </div>
          ) : (
            <p className="manual-piece-note" id="manual-piece-fields">
              Šiam furnitūros elementui matmenų nereikia.
            </p>
          )}
          <button className="submit-button" type="submit">
            Įtraukti į sąrašą
          </button>
        </form>
      ) : null}
    </section>
  );
}
