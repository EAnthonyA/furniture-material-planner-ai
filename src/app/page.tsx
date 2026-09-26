import Link from "next/link";

import { ProjectSetup } from "@/components/project-setup";

const steps = ["Medžiagos", "Brėžinys", "Patikra", "Pjovimas"];

export default function HomePage() {
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
        <p className="topbar-note">Medžiagų planas · v0.1</p>
      </header>

      <section className="masthead" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Naujas baldas</p>
          <h1 id="page-title">
            Pradėkite nuo
            <br />
            <em>medžiagos.</em>
          </h1>
        </div>
        <p className="masthead-copy">
          Sukurkite projekto juodraštį. Vėliau pridėsite brėžinius,
          patikslinsite konstrukciją ir gausite realų pirkinių sąrašą.
        </p>
      </section>

      <nav className="journey" aria-label="Projekto eiga">
        {steps.map((step, index) => (
          <div
            className={index === 0 ? "journey-step is-current" : "journey-step"}
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
        aria-label="Projekto nustatymai"
      >
        <ProjectSetup />
        <aside className="project-note" aria-label="Kas toliau">
          <p className="eyebrow">Kaip veikia</p>
          <ol>
            <li>
              <span>01</span> Nufotografuokite arba įkelkite brėžinį.
            </li>
            <li>
              <span>02</span> Patvirtinkite detales ir konstrukcijos sprendimus.
            </li>
            <li>
              <span>03</span> Palyginkite pjaustymo planus bei pirkinius.
            </li>
          </ol>
          <p className="note-foot">
            Matmenys įvedami milimetrais. Kainos vėliau bus rodomos eurais su jų
            stebėjimo data.
          </p>
        </aside>
      </section>
    </main>
  );
}
