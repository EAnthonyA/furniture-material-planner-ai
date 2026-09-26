import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { savePrivateDrawing } from "@/lib/storage/local";

export const runtime = "nodejs";

const acceptedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const maxFiles = 10;
const maxBytes = 20 * 1024 * 1024;

function redirect(request: Request, projectId: string, status: string) {
  return NextResponse.redirect(
    new URL(`/projects/${projectId}/drawings?upload=${status}`, request.url),
    303,
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    return redirect(request, projectId, "missing-project");
  }

  const formData = await request.formData();
  const files = formData
    .getAll("drawings")
    .filter((value): value is File => value instanceof File && value.size > 0);

  const currentCount = await prisma.drawing.count({ where: { projectId } });

  if (files.length === 0) {
    return redirect(request, projectId, "missing-file");
  }

  if (currentCount + files.length > maxFiles) {
    return redirect(request, projectId, "too-many");
  }

  const hasInvalidFile = files.some(
    (file) => !acceptedTypes.has(file.type) || file.size > maxBytes,
  );

  if (hasInvalidFile) {
    return redirect(request, projectId, "invalid-file");
  }

  for (const file of files) {
    const extension = acceptedTypes.get(file.type)!;
    const contents = Buffer.from(await file.arrayBuffer());

    const objectKey = await savePrivateDrawing(
      projectId,
      `${randomUUID()}.${extension}`,
      contents,
    );

    await prisma.drawing.create({
      data: { projectId, objectKey, mediaType: file.type },
    });
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { state: "DRAFT" },
  });

  return redirect(request, projectId, "complete");
}
