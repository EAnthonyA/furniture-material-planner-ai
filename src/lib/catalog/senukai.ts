const SENUKAI_ORIGIN = "https://www.senukai.lt";

export const senukaiCatalogUrls = [
  `${SENUKAI_ORIGIN}/c/statyba-ir-remontas/statybines-plokstes/klijuotos-medienos-plokstes/b9n?f=1bho6`,
  `${SENUKAI_ORIGIN}/c/statyba-ir-remontas/statybine-mediena/statybines-lentos/neapdirbtos-pjautines-lentos/10hi`,
] as const;

export type SenukaiCatalogProduct = {
  externalId: string;
  url: string;
  title: string;
  species: string | null;
  material: "SPRUCE_PANEL" | "BIRCH_PANEL" | "OTHER";
  dimensionsMm: {
    lengthMm: number;
    widthMm: number;
    thicknessMm: number;
  } | null;
  priceCents: number | null;
  conditionalCents: number | null;
  priceCondition: string | null;
  availability: "PARDUODAMA" | "IŠPARDUOTA";
  sourceData: Record<string, unknown>;
};

type DimensionName = "Ilgis" | "Plotis" | "Storis";

const productLinkPattern =
  /^\[([^\]]+)\]\((https?:\/\/(?:www\.)?senukai\.lt\/p\/[^)]+)\)\s*$/gm;

/**
 * Reads text-only product-card information from the catalogue's server-rendered
 * Markdown representation. It deliberately ignores thumbnails and image URLs.
 */
export function parseSenukaiCatalog(markdown: string): SenukaiCatalogProduct[] {
  const cards = [...markdown.matchAll(productLinkPattern)].filter((card) =>
    isMaterialProductTitle(card[1]),
  );

  return cards.map((card, index) => {
    const blockStart = (card.index ?? 0) + card[0].length;
    const blockEnd = cards[index + 1]?.index ?? markdown.length;
    const block = markdown.slice(blockStart, blockEnd);
    const url = canonicalSenukaiUrl(card[2]);
    const sourceCard = removeImageReferences(block).trim();

    return {
      externalId: externalIdFromUrl(url),
      url,
      title: card[1].trim(),
      species: extractAttribute(sourceCard, "Medienos rūšis"),
      material: materialFromSpecies(
        extractAttribute(sourceCard, "Medienos rūšis"),
      ),
      dimensionsMm: extractDimensions(sourceCard),
      priceCents: extractPriceCents(sourceCard, "Lojalumo kaina"),
      conditionalCents: null,
      priceCondition: sourceCard.includes("Lojalumo kaina")
        ? "Lojalumo kaina"
        : null,
      availability: sourceCard.includes("Išparduota")
        ? "IŠPARDUOTA"
        : "PARDUODAMA",
      sourceData: {
        rawCard: sourceCard,
        mediaType: "text/markdown",
      },
    };
  });
}

export function shouldImportSenukaiProduct(product: SenukaiCatalogProduct) {
  return product.availability === "PARDUODAMA" && product.priceCents !== null;
}

function isMaterialProductTitle(title: string) {
  return /(klijuot\p{L}*\s+plokšt\p{L}*|medin\p{L}*\s+(?:lenta|taš\p{L}*)|palang\p{L}*|sienin\p{L}*\s+lentyn\p{L}*)/iu.test(
    title,
  );
}

function removeImageReferences(card: string) {
  return card.replace(/^\[!\[Image [^\n]+\n?/gm, "");
}

export function createSenukaiReaderUrl(catalogUrl: string) {
  const source = new URL(catalogUrl);
  return `https://r.jina.ai/http://${source.host}${source.pathname}${source.search}`;
}

function canonicalSenukaiUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  url.protocol = "https:";
  url.host = "www.senukai.lt";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function externalIdFromUrl(url: string) {
  const externalId = new URL(url).pathname.split("/").at(-1);
  if (!externalId) {
    throw new Error(`Could not determine a Senukai product ID from ${url}.`);
  }
  return externalId;
}

function extractAttribute(block: string, name: string) {
  const value = block
    .match(new RegExp(`^\\*\\s+${name}:\\s*(.+)$`, "m"))?.[1]
    ?.trim();
  return value || null;
}

function extractDimensions(block: string) {
  const lengthMm = extractCentimetres(block, "Ilgis");
  const widthMm = extractCentimetres(block, "Plotis");
  const thicknessMm = extractCentimetres(block, "Storis");

  if (lengthMm === null || widthMm === null || thicknessMm === null) {
    return null;
  }

  return { lengthMm, widthMm, thicknessMm };
}

function extractCentimetres(block: string, name: DimensionName) {
  const value = extractAttribute(block, name)?.match(/^([\d.,]+)\s*cm$/i)?.[1];
  if (!value) {
    return null;
  }

  const centimetres = Number(value.replace(",", "."));
  return Number.isFinite(centimetres) ? centimetres * 10 : null;
}

function extractPriceCents(block: string, label: string) {
  const value = block.match(
    new RegExp(`${label}\\s*\\n\\s*([\\d.,]+)\\s*€`),
  )?.[1];
  if (!value) {
    return null;
  }

  const euros = Number(value.replace(",", "."));
  return Number.isFinite(euros) ? Math.round(euros * 100) : null;
}

function materialFromSpecies(
  species: string | null,
): SenukaiCatalogProduct["material"] {
  switch (species?.toLocaleLowerCase("lt-LT")) {
    case "eglė":
      return "SPRUCE_PANEL";
    case "beržas":
      return "BIRCH_PANEL";
    default:
      return "OTHER";
  }
}
