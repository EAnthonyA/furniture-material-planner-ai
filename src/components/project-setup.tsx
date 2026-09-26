"use client";

import { FormEvent, useState } from "react";

const materials = [
  { id: "LMDP", name: "LMDP", note: "Laminuota medienos drožlių plokštė", swatch: "charcoal" },
  { id: "SPRUCE", name: "Eglė", note: "Klijuota medienos plokštė", swatch: "spruce" },
  { id: "BIRCH", name: "Beržas", note: "Klijuota medienos plokštė", swatch: "birch" },
] as const;

type MaterialId = (typeof materials)[number]["id"];

export function ProjectSetup() {
  const [material, setMaterial] = useState<MaterialId>("LMDP");
  const [projectName, setProjectName] = useState("");
  const [created, setCreated] = useState(false);

  function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreated(true);
  }

  return (
    <form className="setup-form" onSubmit={createDraft}>
      <div className="form-heading">
        <p className="eyebrow">01 / Pagrindas</p>
        <h2>Ko šiandien imsitės?</h2>
      </div>

      <label className="field-label" htmlFor="project-name">Projekto pavadinimas</label>
      <input
        id="project-name"
        className="name-input"
        value={projectName}
        onChange={(event) => { setProjectName(event.target.value); setCreated(false); }}
        placeholder="Pvz., prieškambario spintelė"
        required
      />

      <fieldset>
        <legend>Rinkitės pagrindinę medžiagą</legend>
        <div className="material-options">
          {materials.map((item) => (
            <label className={material === item.id ? "material-option is-selected" : "material-option"} key={item.id}>
              <input type="radio" name="material" value={item.id} checked={material === item.id} onChange={() => { setMaterial(item.id); setCreated(false); }} />
              <span className={`wood-swatch ${item.swatch}`} aria-hidden="true" />
              <span className="material-copy"><strong>{item.name}</strong><small>{item.note}</small></span>
              <span className="selection-dot" aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="measure-row">
        <label className="measure-field" htmlFor="thickness"><span>Storis</span><span className="input-wrap"><input id="thickness" type="number" min="1" step="0.1" defaultValue="18" required /><i>mm</i></span></label>
        <label className="measure-field" htmlFor="decor"><span>Dekoras <em>(jei LMDP)</em></span><input id="decor" type="text" placeholder="Pvz., ąžuolas sonoma" /></label>
      </div>

      <button className="submit-button" type="submit">Sukurti juodraštį <span aria-hidden="true">→</span></button>
      <p className={created ? "form-status is-visible" : "form-status"} role="status">Juodraštis „{projectName || "be pavadinimo"}“ paruoštas. Kitame etape pridėsite brėžinį.</p>
    </form>
  );
}
