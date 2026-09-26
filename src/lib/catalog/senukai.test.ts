import assert from "node:assert/strict";
import test from "node:test";
import { parseSenukaiCatalog, shouldImportSenukaiProduct } from "./senukai";

const catalogue = `
[Klijuota plokštė Rettenmeier, eglė, 2000 x 600 mm x 18 mm](http://www.senukai.lt/p/klijuota-plokste-egle/abc123)

Lojalumo kaina

18,09€

/ vnt.

Įprasta kaina

21,90€

/ vnt.

*   Medienos rūšis:Eglė
*   Medienos tipas:Obliuota
*   Ilgis:200 cm
*   Plotis:60 cm
*   Storis:1.8 cm

[![Image 2: ignored product thumbnail](https://images.example.test/lumber.jpg)](https://www.senukai.lt/p/ignored/ignored)

[Medinė lenta, spygliuotis, neobliuota, 300 x 15 cm x 5 cm](https://www.senukai.lt/p/medine-lenta-spygliuotis/def456)

Išparduota

*   Medienos rūšis:Spygliuotis
*   Medienos tipas:Neobliuota
*   Ilgis:300 cm
*   Plotis:15 cm
*   Storis:5 cm
`;

test("parses Senukai product cards into normalized material records", () => {
  const products = parseSenukaiCatalog(catalogue);

  assert.equal(products.length, 2);
  assert.deepEqual(products[0], {
    externalId: "abc123",
    url: "https://www.senukai.lt/p/klijuota-plokste-egle/abc123",
    title: "Klijuota plokštė Rettenmeier, eglė, 2000 x 600 mm x 18 mm",
    species: "Eglė",
    material: "SPRUCE_PANEL",
    dimensionsMm: { lengthMm: 2000, widthMm: 600, thicknessMm: 18 },
    priceCents: 1809,
    conditionalCents: null,
    priceCondition: "Lojalumo kaina",
    availability: "PARDUODAMA",
    sourceData: {
      rawCard: `Lojalumo kaina

18,09€

/ vnt.

Įprasta kaina

21,90€

/ vnt.

*   Medienos rūšis:Eglė
*   Medienos tipas:Obliuota
*   Ilgis:200 cm
*   Plotis:60 cm
*   Storis:1.8 cm`,
      mediaType: "text/markdown",
    },
  });
  assert.equal(products[1].availability, "IŠPARDUOTA");
  assert.equal(products[1].material, "OTHER");
  assert.equal(products[1].priceCents, null);
  assert.equal(shouldImportSenukaiProduct(products[0]), true);
  assert.equal(shouldImportSenukaiProduct(products[1]), false);
});
