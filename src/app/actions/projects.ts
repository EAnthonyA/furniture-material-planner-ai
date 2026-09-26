"use server";

import { prisma } from "@/lib/db/prisma";
import { createProjectInputSchema } from "@/lib/domain/project";

const materialKinds = {
  LMDP: "LMDP",
  SPRUCE: "SPRUCE_PANEL",
  BIRCH: "BIRCH_PANEL",
} as const;

type CreateProjectRequest = {
  name: string;
  material: keyof typeof materialKinds;
  thicknessMm: number;
  decor?: string;
};

type CreateProjectResult =
  { ok: true; projectId: string } | { ok: false; error: string };

/** Temporary single-owner bootstrap until session authentication is introduced. */
const bootstrapOwnerEmail =
  process.env.OWNER_EMAIL?.trim().toLowerCase() || "owner@local.invalid";

export async function createProject(
  input: CreateProjectRequest,
): Promise<CreateProjectResult> {
  const parsed = createProjectInputSchema.safeParse({
    name: input.name,
    materialGroup: {
      name: "Pagrindinė medžiaga",
      kind: materialKinds[input.material],
      thicknessMm: input.thicknessMm,
      decor: input.decor?.trim() || undefined,
    },
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Patikrinkite projekto pavadinimą ir medžiagos storį.",
    };
  }

  try {
    const owner = await prisma.user.upsert({
      where: { email: bootstrapOwnerEmail },
      update: {},
      create: { email: bootstrapOwnerEmail },
    });

    const project = await prisma.project.create({
      data: {
        ownerId: owner.id,
        name: parsed.data.name,
        materialGroups: { create: parsed.data.materialGroup },
      },
      select: { id: true },
    });

    return { ok: true, projectId: project.id };
  } catch {
    return {
      ok: false,
      error:
        "Nepavyko išsaugoti projekto. Patikrinkite duomenų bazės ryšį ir bandykite dar kartą.",
    };
  }
}
