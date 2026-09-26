import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const localStorageRoot =
  process.env.STORAGE_ROOT || path.join(process.cwd(), "uploads");

export async function savePrivateDrawing(
  projectId: string,
  filename: string,
  contents: Buffer,
) {
  const objectKey = path.posix.join(
    "projects",
    projectId,
    "drawings",
    filename,
  );
  // Storage is intentionally outside the deployment bundle and comes from server-only config.
  const destination = path.join(
    /* turbopackIgnore: true */ localStorageRoot,
    "projects",
    projectId,
    "drawings",
    filename,
  );
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, contents, { flag: "wx" });
  return objectKey;
}

export async function readPrivateObject(objectKey: string) {
  return readFile(
    path.join(
      /* turbopackIgnore: true */ localStorageRoot,
      ...objectKey.split("/"),
    ),
  );
}
