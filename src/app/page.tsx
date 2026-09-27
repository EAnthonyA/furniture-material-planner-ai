import Link from "next/link";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { ProjectSetup } from "@/components/project-setup";
import { prisma } from "@/lib/db/prisma";
import { savedPurchasePlanSnapshotSchema } from "@/lib/domain/saved-purchase-plan";

export const dynamic = "force-dynamic";

const steps = ["Medžiagos", "Brėžinys", "Patikra", "Pjovimas"];

const bootstrapOwnerEmail =
  process.env.OWNER_EMAIL?.trim().toLowerCase() || "owner@local.invalid";

type SavedProject = {
  id: string;
  name: string;
  updatedAt: Date;
  _count: { drawings: number };
  analysisRuns: Array<{ id: string; status: string }>;
  currentRevision: { plans: Array<{ snapshot: unknown }> } | null;
};

function getResumeDetails(project: SavedProject) {
  const savedPlan = savedPurchasePlanSnapshotSchema.safeParse(
    project.currentRevision?.plans[0]?.snapshot,
  );

  if (savedPlan.success && savedPlan.data.result.ok) {
    return {
      href: `/projects/${project.id}/analysis/${savedPlan.data.runId}/plan`,
      step: "04 Pirkimas ir pjovimas",
      description: "Pirkinių sąrašas ir pjovimo planas išsaugoti.",
    };
  }

  const latestRun = project.analysisRuns[0];

  if (!project._count.drawings) {
    return {
      href: `/projects/${project.id}/drawings`,
      step: "02 Brėžinys",
      description: "Pridėkite brėžinį ir tęskite projektą.",
    };
  }

  if (!latestRun) {
    return {
      href: `/projects/${project.id}/drawings`,
      step: "02 Brėžinys",
      description: "Brėžiniai išsaugoti – pradėkite analizę.",
    };
  }

  if (latestRun.status === "PENDING" || latestRun.status === "RUNNING") {
    return {
      href: `/projects/${project.id}/analysis/${latestRun.id}`,
      step: "03 Patikra",
      description: "Analizė vykdoma.",
    };
  }

  return {
    href: `/projects/${project.id}/analysis/${latestRun.id}`,
    step: "03 Patikra",
    description:
      latestRun.status === "FAILED"
        ? "Analizę reikia pakartoti."
        : "Peržiūrėkite analizę ir atsakykite į klausimus.",
  };
}

export default async function HomePage() {
  const owner = await prisma.user.findUnique({
    where: { email: bootstrapOwnerEmail },
    select: {
      projects: {
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          name: true,
          updatedAt: true,
          _count: { select: { drawings: true } },
          analysisRuns: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true },
          },
          currentRevision: {
            select: {
              plans: {
                where: { complete: true },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { snapshot: true },
              },
            },
          },
        },
      },
    },
  });
  const projects = owner?.projects || [];
  const hasSavedProjects = projects.length > 0;

  return (
    <main id="main-content">
      <a className="skip-link" href="#workspace">
        Pereiti prie turinio
      </a>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Dirbtuvės, pradžia">
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <span>Dirbtuvės</span>
        </Link>
        <div className="topbar-links">
          <Link href="/catalog">Katalogas</Link>
          <p className="topbar-note">Medžiagų planas · v0.1</p>
        </div>
      </header>

      <section className="masthead" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">
            {hasSavedProjects ? "Jūsų projektai" : "Naujas baldas"}
          </p>
          <h1 id="page-title">
            {hasSavedProjects ? (
              <>
                Tęskite arba
                <br />
                <em>pradėkite naują.</em>
              </>
            ) : (
              <>
                Pradėkite nuo
                <br />
                <em>medžiagos.</em>
              </>
            )}
          </h1>
        </div>
        <p className="masthead-copy">
          {hasSavedProjects
            ? "Pasirinkite išsaugotą projektą tęsti nuo paskutinio žingsnio arba sukurkite naują."
            : "Sukurkite projekto juodraštį. Vėliau pridėsite brėžinius, patikslinsite konstrukciją ir gausite realų pirkinių sąrašą."}
        </p>
        {hasSavedProjects ? (
          <div className="masthead-actions">
            <a href="#saved-projects">Tęsti projektą</a>
            <a href="#new-project">Naujas projektas</a>
          </div>
        ) : null}
      </section>

      {hasSavedProjects ? (
        <section
          className="saved-projects"
          id="saved-projects"
          aria-labelledby="saved-projects-title"
        >
          <div>
            <p className="eyebrow">Išsaugoti projektai</p>
            <h2 id="saved-projects-title">Tęsti projektą</h2>
          </div>
          <ul>
            {projects.map((project) => {
              const resume = getResumeDetails(project);

              return (
                <li key={project.id}>
                  <div>
                    <p className="saved-project-step">{resume.step}</p>
                    <h3>{project.name}</h3>
                    <p>{resume.description}</p>
                  </div>
                  <div className="saved-project-actions">
                    <Link href={resume.href}>
                      Tęsti <span aria-hidden="true">→</span>
                    </Link>
                    <DeleteProjectButton
                      projectId={project.id}
                      projectName={project.name}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="new-project" id="new-project">
        {hasSavedProjects ? (
          <header className="new-project-heading">
            <p className="eyebrow">Naujas projektas</p>
            <h2>Pradėkite nuo medžiagos.</h2>
            <p>
              Šis kelias sukurs atskirą juodraštį – esami projektai liks
              nepakitę.
            </p>
          </header>
        ) : null}
        <nav className="journey" aria-label="Naujo projekto eiga">
          {steps.map((step, index) => (
            <div
              className={
                index === 0 ? "journey-step is-current" : "journey-step"
              }
              key={step}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </nav>
        <section
          className="workspace"
          id="workspace"
          aria-label="Naujo projekto nustatymai"
        >
          <ProjectSetup />
          <aside className="project-note" aria-label="Kas toliau">
            <p className="eyebrow">Kaip veikia</p>
            <ol>
              <li>
                <span>01</span> Nufotografuokite arba įkelkite brėžinį.
              </li>
              <li>
                <span>02</span> Patvirtinkite detales ir konstrukcijos
                sprendimus.
              </li>
              <li>
                <span>03</span> Palyginkite pjaustymo planus bei pirkinius.
              </li>
            </ol>
            <p className="note-foot">
              Matmenys įvedami milimetrais. Kainos vėliau bus rodomos eurais su
              jų stebėjimo data.
            </p>
          </aside>
        </section>
      </section>
    </main>
  );
}
