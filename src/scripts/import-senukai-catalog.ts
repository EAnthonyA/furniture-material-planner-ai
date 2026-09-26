import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  createSenukaiReaderUrl,
  parseSenukaiCatalog,
  senukaiCatalogUrls,
  shouldImportSenukaiProduct,
} from "@/lib/catalog/senukai";

async function fetchCatalogue(url: string) {
  const response = await fetch(createSenukaiReaderUrl(url), {
    headers: {
      "User-Agent": "FurnitureMaterialPlanner/0.1 catalog importer",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Could not fetch ${url}: ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
}

async function importCatalogue(url: string) {
  const markdown = await fetchCatalogue(url);
  const products = parseSenukaiCatalog(markdown).filter(
    shouldImportSenukaiProduct,
  );

  if (products.length === 0) {
    throw new Error(
      `No priced, available product cards were found in ${url}; the source format may have changed.`,
    );
  }

  let observations = 0;
  for (const product of products) {
    const existingProduct = await prisma.storeProduct.findFirst({
      where: {
        store: "SENUKAI",
        externalId: product.externalId,
        variantId: null,
      },
      select: { id: true },
    });

    const productData = {
      url: product.url,
      title: product.title,
      dimensionsMm: product.dimensionsMm ?? Prisma.DbNull,
      material: product.material,
      species: product.species,
    };
    const storedProduct = existingProduct
      ? await prisma.storeProduct.update({
          where: { id: existingProduct.id },
          data: productData,
          select: { id: true },
        })
      : await prisma.storeProduct.create({
          data: {
            store: "SENUKAI",
            externalId: product.externalId,
            variantId: null,
            kind: "PANEL",
            sellingUnit: "PIECE",
            ...productData,
          },
          select: { id: true },
        });

    await prisma.productObservation.create({
      data: {
        productId: storedProduct.id,
        priceCents: product.priceCents,
        conditionalCents: product.conditionalCents,
        priceCondition: product.priceCondition,
        availability: product.availability,
        sourceData: {
          catalogueUrl: url,
          ...product.sourceData,
        },
      },
    });
    observations += 1;
  }

  return { products: products.length, observations };
}

async function main() {
  const results = await Promise.all(senukaiCatalogUrls.map(importCatalogue));
  const products = results.reduce(
    (total, result) => total + result.products,
    0,
  );
  const observations = results.reduce(
    (total, result) => total + result.observations,
    0,
  );

  console.info(
    `Imported ${products} Senukai materials and recorded ${observations} price observations.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
