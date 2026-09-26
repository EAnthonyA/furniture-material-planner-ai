import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";

type DrawingPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ upload?: string }>;
};

const uploadMessages: Record<string, string> = {
  complete: "Brėžiniai išsaugoti. Juos galėsite peržiūrėti prieš analizę.",
  "missing-file": "Pasirinkite bent vieną brėžinio failą.",
  "invalid-file": "Priimami JPEG, PNG ir WebP failai iki 20 MB.",
  "too-many": "Viename projekte galima laikyti iki 10 brėžinių.",
};

export default async function DrawingsPage({
  params,
  searchParams,
}: DrawingPageProps) {
  const { projectId } = await params;
  const { upload } = await searchParams;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      materialGroups: true,
      drawings: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) {
    notFound();
  }

  const material = project.materialGroups[0];
  let materialName = "beržo plokštė";

  if (material?.kind === "LMDP") {
    materialName = "LMDP";
  } else if (material?.kind === "SPRUCE_PANEL") {
    materialName = "eglės plokštė";
  }

  return (
    <main id="main-content">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Dirbtuvės, pradžia">
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <span>Dirbtuvės</span>
        </Link>
        <p className="topbar-note">Juodraštis išsaugotas</p>
      </header>
      <section className="drawing-page">
        <nav className="drawing-crumb" aria-label="Projekto eiga">
          <span>01 Medžiagos</span>
          <strong>02 Brėžinys</strong>
          <span>03 Patikra</span>
          <span>04 Pjovimas</span>
        </nav>
        <p className="eyebrow">{project.name}</p>
        <h1>
          Įkelkite
          <br />
          <em>brėžinį.</em>
        </h1>
        <p className="drawing-lead">
          Pagrindas išsaugotas: {materialName},{" "}
          {material?.thicknessMm.toString()} mm. Pridėkite bendrą vaizdą ir, jei
          reikia, papildomas detales.
        </p>

        <form
          className="upload-form"
          action={`/api/projects/${project.id}/drawings`}
          method="post"
          encType="multipart/form-data"
        >
          <label className="upload-well" htmlFor="drawings">
            <span className="upload-mark" aria-hidden="true">
              +
            </span>
            <span>
              <strong>Pasirinkite brėžinius</strong>
              <small>JPEG, PNG arba WebP · iki 10 failų · po 20 MB</small>
            </span>
            <input
              id="drawings"
              name="drawings"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              required
              capture="environment"
            />
          </label>
          <button className="submit-button" type="submit">
            Išsaugoti brėžinius <span aria-hidden="true">→</span>
          </button>
        </form>

        {upload ? (
          <p
            className={
              upload === "complete"
                ? "upload-status is-success"
                : "upload-status"
            }
            role="status"
          >
            {uploadMessages[upload] ||
              "Nepavyko apdoroti brėžinių. Bandykite dar kartą."}
          </p>
        ) : null}
        {project.drawings.length ? (
          <form
            className="analysis-start"
            action={`/api/projects/${project.id}/analysis`}
            method="post"
          >
            <button className="submit-button" type="submit">
              Analizuoti brėžinius <span aria-hidden="true">→</span>
            </button>
            <p>
              Gemini pasiūlys konstrukciją ir klausimus; niekas nebus
              patvirtinta automatiškai.
            </p>
          </form>
        ) : null}
        <section className="drawing-list" aria-labelledby="saved-drawings">
          <p className="eyebrow" id="saved-drawings">
            Išsaugoti brėžiniai · {project.drawings.length}
          </p>
          {project.drawings.length ? (
            <ul>
              {project.drawings.map((drawing) => (
                <li key={drawing.id}>
                  <span>Brėžinys</span>
                  <small>
                    {drawing.mediaType.replace("image/", "").toUpperCase()}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Dar nepridėjote brėžinių. Aiškiai nufotografuokite visus užrašytus
              matmenis.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
