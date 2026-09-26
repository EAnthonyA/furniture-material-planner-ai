"use client";

import { useState } from "react";
import type {
  DrawingExtraction,
  ObservedPiece,
} from "@/lib/domain/drawing-extraction";

type DrawingExtractionResultProps = {
  action: string;
  extraction: DrawingExtraction;
};

type PieceCategory = ObservedPiece["category"];

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

function formatDimensions(dimensions: Array<number | null>) {
  if (dimensions.length === 0) {
    return "Be matmenų";
  }

  const knownDimensions = dimensions.filter(
    (dimension): dimension is number => dimension !== null,
  );

  if (knownDimensions.length === dimensions.length) {
    return `${knownDimensions.join(" × ")} mm`;
  }

  if (knownDimensions.length === 0) {
    return "Trūksta matmenų";
  }

  return `${knownDimensions.join(" × ")} mm · trūksta ${dimensions.length - knownDimensions.length} matmens`;
}

function PieceEditor({
  action,
  index,
  piece,
}: {
  action: string;
  index: number;
  piece: ObservedPiece;
}) {
  const [category, setCategory] = useState<PieceCategory>(piece.category);

  return (
    <form action={action} className="piece-editor" method="post">
      <input name="operation" type="hidden" value="update" />
      <input name="pieceIndex" type="hidden" value={index} />
      <div className="piece-editor-primary-fields">
        <label>
          <span>Tipas</span>
          <select
            name="category"
            onChange={(event) =>
              setCategory(event.target.value as PieceCategory)
            }
            value={category}
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
            defaultValue={piece.label}
            maxLength={120}
            name="label"
            required
          />
        </label>
        <label>
          <span>Kiekis</span>
          <input
            defaultValue={piece.quantity}
            max="99"
            min="1"
            name="quantity"
            required
            step="1"
            type="number"
          />
        </label>
      </div>
      {dimensionFields[category].length ? (
        <div className="piece-editor-dimensions">
          {dimensionFields[category].map((field) => (
            <label key={field.name}>
              <span>{field.label}</span>
              <input
                defaultValue={piece[field.name] ?? ""}
                min="0.1"
                name={field.name}
                required
                step="0.1"
                type="number"
              />
            </label>
          ))}
        </div>
      ) : (
        <p className="piece-editor-note">
          Šiam furnitūros elementui matmenų nereikia.
        </p>
      )}
      <button className="piece-save-button" type="submit">
        Išsaugoti pakeitimą
      </button>
    </form>
  );
}

function EditablePieceRow({
  action,
  dimensions,
  index,
  piece,
}: {
  action: string;
  dimensions: Array<number | null>;
  index: number;
  piece: ObservedPiece;
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <li className={isEditing ? "piece-row is-editing" : "piece-row"}>
      <div className="piece-row-summary">
        <span>
          {piece.label}
          {piece.quantity > 1 ? ` × ${piece.quantity}` : ""}
        </span>
        <strong>{formatDimensions(dimensions)}</strong>
        <button
          aria-expanded={isEditing}
          className="piece-edit-toggle"
          onClick={() => setIsEditing((open) => !open)}
          type="button"
        >
          {isEditing ? "Uždaryti" : "Redaguoti"}
        </button>
      </div>
      {isEditing ? (
        <PieceEditor action={action} index={index} piece={piece} />
      ) : null}
    </li>
  );
}

export function DrawingExtractionResult({
  action,
  extraction,
}: DrawingExtractionResultProps) {
  const indexedPieces = extraction.observedPieces.map((piece, index) => ({
    piece,
    index,
  }));
  const panels = indexedPieces.filter(
    ({ piece }) => piece.category === "PANEL",
  );
  const timber = indexedPieces.filter(
    ({ piece }) => piece.category === "TIMBER",
  );
  const hardware = indexedPieces.filter(
    ({ piece }) => piece.category !== "PANEL" && piece.category !== "TIMBER",
  );

  return (
    <>
      <section className="extraction-list" aria-labelledby="observed-pieces">
        <p className="eyebrow" id="observed-pieces">
          Plokštės ir durelės
        </p>
        {panels.length ? (
          <ul>
            {panels.map(({ piece, index }) => (
              <EditablePieceRow
                action={action}
                dimensions={[piece.widthMm, piece.heightMm]}
                index={index}
                key={index}
                piece={piece}
              />
            ))}
          </ul>
        ) : (
          <p className="drawing-lead">
            Neradome stačiakampio su dviem aiškiai priskirtais matmenimis.
          </p>
        )}
      </section>
      {timber.length ? (
        <section className="extraction-list" aria-labelledby="timber">
          <p className="eyebrow" id="timber">
            Tašai ir lentos
          </p>
          <ul>
            {timber.map(({ piece, index }) => (
              <EditablePieceRow
                action={action}
                dimensions={[piece.lengthMm, piece.widthMm, piece.heightMm]}
                index={index}
                key={index}
                piece={piece}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {hardware.length ? (
        <section
          className="extraction-list hardware-list"
          aria-labelledby="hardware"
        >
          <p className="eyebrow" id="hardware">
            Būtina furnitūra
          </p>
          <ul>
            {hardware.map(({ piece, index }) => (
              <EditablePieceRow
                action={action}
                dimensions={[]}
                index={index}
                key={index}
                piece={piece}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {extraction.unreadableItems.length ? (
        <section
          className="unreadable-items"
          aria-labelledby="unreadable-items"
        >
          <p className="eyebrow" id="unreadable-items">
            Reikia patikslinti
          </p>
          <ul>
            {extraction.unreadableItems.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
