import type { DrawingExtraction } from "@/lib/domain/drawing-extraction";

type DrawingExtractionResultProps = {
  extraction: DrawingExtraction;
};

function formatDimensions(dimensions: Array<number | null>) {
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

export function DrawingExtractionResult({
  extraction,
}: DrawingExtractionResultProps) {
  const panels = extraction.observedPieces.filter(
    (piece) => piece.category === "PANEL",
  );
  const timber = extraction.observedPieces.filter(
    (piece) => piece.category === "TIMBER",
  );
  const hardware = extraction.observedPieces.filter(
    (piece) => piece.category !== "PANEL" && piece.category !== "TIMBER",
  );

  return (
    <>
      <section className="extraction-list" aria-labelledby="observed-pieces">
        <p className="eyebrow" id="observed-pieces">
          Plokštės ir durelės
        </p>
        {panels.length ? (
          <ul>
            {panels.map((piece, index) => (
              <li key={`${piece.label}-${index}`}>
                <span>
                  {piece.label}
                  {piece.quantity > 1 ? ` × ${piece.quantity}` : ""}
                </span>
                <strong>
                  {formatDimensions([piece.widthMm, piece.heightMm])}
                </strong>
              </li>
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
            {timber.map((piece, index) => (
              <li key={`${piece.label}-${index}`}>
                <span>
                  {piece.label}
                  {piece.quantity > 1 ? ` × ${piece.quantity}` : ""}
                </span>
                <strong>
                  {formatDimensions([
                    piece.lengthMm,
                    piece.widthMm,
                    piece.heightMm,
                  ])}
                </strong>
              </li>
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
            {hardware.map((piece, index) => (
              <li key={`${piece.label}-${index}`}>
                <span>{piece.label}</span>
                <strong>{piece.quantity} vnt.</strong>
              </li>
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
