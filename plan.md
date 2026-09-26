# Furniture Material Planner — Implementation Plan

## 1. Purpose

Build a personal web application for a hobby furniture maker who draws furniture by hand and wants to avoid manually calculating materials and purchases.

The core workflow is:

**Choose materials → upload a drawing → review and correct the proposed construction and parts → approve the requirements → calculate a cutting layout and shopping list.**

The application must answer two different questions:

1. What parts and other materials are needed to build this piece of furniture?
2. Which actual products, in which quantities, must be purchased to obtain those parts?

The second answer must use a previously populated store catalog containing real product dimensions, selling units, and prices. Comparing total required area with total purchased area is insufficient: every part must fit into an executable cutting layout.

## 2. Confirmed Requirements and Implementation Defaults

### Confirmed with the owner

- A browser application usable on both a phone and a computer.
- Initially intended for one owner, rather than a public multi-user product.
- Input is typically a hand-drawn view of the complete furniture item with overall dimensions, not an already prepared cutting list.
- The owner chooses the main material at the start of each project:
  - Laminated particleboard (LMDP).
  - Edge-glued spruce panel.
  - Edge-glued birch panel.
- Start with cabinets and shelving, including doors and drawers.
- Include panels, edge banding, hardware, fasteners, and other explicitly specified consumables.
- AI proposes missing construction choices and asks for clarification; the owner reviews and approves them.
- Human review and correction are mandatory before purchase planning.
- Support both cutting at home and cutting by a store or workshop.
- Initially populate the product database by scraping **Senukai** and **Ermitažas**.
- Plan purchases from one selected store per project calculation.
- Use an external paid AI API. The owner already has Gemini and DeepSeek API keys.
- Start with **Google Gemini**; isolate the provider integration so DeepSeek can be added later.
- Use **Next.js with TypeScript**, PostgreSQL, and a background Node.js worker in the same repository.

### Defaults introduced by this plan

These are implementation defaults, not additional user commitments:

- Product interface language: Lithuanian. Source code and technical documentation: English.
- Project dimensions: millimeters. Currency: EUR. Prices include the tax basis shown by the store; do not infer or add tax silently.
- Initial geometry: rectangular parts and straight cuts only.
- One furniture item per project, with multiple drawing images allowed.
- Material exceptions are allowed for backs, drawer bottoms, fronts, or other part groups.
- No stock thickness, saw kerf, hardware clearance, or construction arrangement becomes authoritative without a value being supplied or confirmed.
- Initial catalog refreshes are manually triggered; scheduled scraping is deferred.
- Default price selection uses a publicly available, non-membership price. Conditional discounts remain separate.
- No automatic checkout, live cart synchronization, mixed-store optimization, CAD editor, 3D reconstruction, or reusable offcut inventory in v1.
- Display reusable-looking offcuts in the result, but do not treat them as inventory for later projects.
- Delivery, cutting, and workshop fees are explicit manual additions in v1. They are not included in the material optimizer's objective.

## 3. User Experience

### 3.1 Project setup

The owner creates a named project and selects the principal material: LMDP, spruce, or birch. They specify thickness and, for LMDP, the desired decor. Where available, catalog values can assist this selection, but a specific stock-panel size is not chosen yet: the optimizer must be able to compare sizes later.

The owner can define separate material groups, such as an LMDP carcass and a thin back panel. Species, thickness, and decor are compatibility constraints, not price-based substitutions.

### 3.2 Drawing upload and analysis

Accept JPEG, PNG, and WebP images, with HEIC converted on the server when supported by the chosen image-processing deployment. Use a default limit of 10 images and 20 MB per original image per project. Unsupported uploads receive an actionable error.

Allow phone camera capture, multiple views, and a short optional text description. Preserve readable dimension labels when preparing images for the model. Keep the uploaded original private; produce oriented previews and provider-compatible copies separately.

Analysis runs as a background job. The project shows pending, running, completed, or failed status and remains accessible if the browser is closed.

The analysis result contains:

- Recognized furniture type and overall dimensions.
- Proposed construction arrangement and material assignments.
- Proposed panel parts, hardware, fasteners, and consumables.
- Questions about missing or contradictory information.
- The source of each relevant value: drawing, owner input, derived calculation, or AI proposal.

Do not estimate exact dimensions from image proportions. An unreadable dimension stays unresolved.

### 3.3 Construction clarification

Ask only questions that affect the result. Examples include whether the bottom fits between side panels, whether a back is attached on the outside or inserted into a groove, whether shelves are fixed, and whether doors are inset or overlay.

Use a small set of reviewed, parameterized construction templates for cabinet carcasses, shelves, doors, and drawers. AI can recommend a template, but the owner approves its parameters.

Drawer and hinge dimensions can depend on a particular hardware system. If manufacturer requirements are missing, require the owner to provide or confirm them. Do not invent installation clearances or load capacities.

An unsupported construction can be entered manually. Mark it as manually specified rather than implying the application has validated its design.

### 3.4 Parts and materials review

Show the drawing and editable requirements together on desktop; use a usable stacked layout on mobile.

The panel table includes a stable part label, role, quantity, length, width, thickness, material group, grain direction, allowed rotation, and edge-banding selection. Repeated parts can share a row but must expand into uniquely identified instances for cutting.

The additional-materials table includes purpose, required quantity, unit, compatibility requirements, and the basis for the quantity. The owner can add, remove, or edit any item.

Distinguish finished dimensions from raw cutting dimensions when edge banding changes the result. Show the deduction explicitly and make the dimension basis editable.

Warnings and unresolved questions must be visible at the affected row. Approval is disabled while required dimensions, material specifications, or construction decisions remain unresolved.

### 3.5 Purchase preparation

After approving the requirements, the owner selects Senukai or Ermitažas and a cutting profile: home or workshop.

Show suitable products from that store. The owner confirms material/decor matches and any hardware substitutions. The application can consider multiple stock-panel dimensions within a confirmed material group.

If a chosen product changes thickness or a hardware-dependent dimension, return to requirements review and require renewed approval.

Both cutting profiles require kerf and edge-trimming settings. Workshop profiles additionally allow restrictions supplied by the workshop, such as minimum part size. Do not invent a store's cutting capabilities or fees.

### 3.6 Results and exports

Present:

- A shopping list with product names, links, stock dimensions, purchase quantities, selling units, unit prices, and line totals.
- Required quantities separately from purchased quantities and surplus.
- A numbered layout for every purchased panel, with a cut sequence and part labels.
- Purchased area, finished-part area, cutting loss, and remaining offcut area.
- Material subtotal, manually supplied service costs, and total estimate.
- Price timestamps, conditional-price labels, and unresolved purchase requirements.

Offer a PDF containing the parts list, cutting layouts, and shopping list, plus separate CSV exports of parts and purchases. Exports must reference the same approved requirements revision and calculation snapshot shown on screen.

## 4. Architecture

### 4.1 Application structure

Use a single TypeScript repository with two runtime processes:

1. **Next.js App Router application:** interface, authentication, project editing, uploads, job submission, job status, catalog administration, and exports.
2. **Node.js worker:** Gemini analysis, store imports, cutting optimization, and heavier export generation.

Use Server Components for initial project and catalog reads, Client Components for editable tables and interactive layouts, Server Actions for form mutations, and Route Handlers for uploads, job status, and downloads.

Keep business logic in shared server-side modules outside React components and request handlers. Both the web process and worker use the same domain types and validation rules. There is no separate general-purpose Express API in v1.

### 4.2 Persistence and background work

- PostgreSQL is the source of truth for projects, revisions, catalog records, and jobs.
- Use Prisma for application schema and migrations, Zod for boundary validation, and a PostgreSQL-backed queue such as pg-boss for durable jobs. Initial implementation uses pg-boss; no Redis service is required.
- Store private images and generated exports through a storage adapter. Use a persistent filesystem volume for local development and the initial single-server deployment; an S3-compatible adapter can be added when needed.
- Pass record identifiers into jobs rather than embedding images or complete catalogs in queue payloads.
- Use idempotency keys for submissions. A retry must not duplicate imports, approvals, or completed plans.
- Record job progress and errors. Retry transient network or rate-limit failures up to three times with backoff; require explicit intervention for invalid credentials or invalid inputs.
- Allow one import at a time per store and one active analysis or calculation for the same project revision.

### 4.3 Authentication and deployment

Use a maintained session-authentication library with public registration disabled and one provisioned owner account. Authorize every project, upload, job, and download operation on the server.

Start with Docker Compose services for the web application, worker, and PostgreSQL, plus a private storage volume. Local development can run these services on the owner's computer. Internet deployment uses the same processes behind HTTPS on a persistent server.

Back up the database and private file storage together. Secrets are injected as server environment variables and never use a client-exposed `NEXT_PUBLIC_` prefix.

## 5. Domain Model and Interfaces

### Main records

| Record | Purpose and essential data |
| --- | --- |
| Project | Owner, name, selected material groups, current requirements revision, workflow state. |
| Drawing | Project, private object reference, media type, image dimensions, upload timestamp. |
| AnalysisRun | Drawing references, provider/model, prompt/schema versions, status, output, usage, errors. |
| ConstructionDecision | Selected template, parameter values, source, unresolved questions, confirmation state. |
| Part | Stable label, role, quantity, finished and cutting dimensions, material group, grain, rotation, edge treatment, provenance. |
| MaterialRequirement | Hardware, fastener, banding, or consumable need; quantity, unit, compatibility constraints, calculation basis. |
| RequirementsRevision | Immutable snapshot of construction, parts, and material requirements; approval timestamp when approved. |
| StoreProduct | Store, external ID, variant ID, URL, product kind, dimensions, material/species/decor, selling unit, pack contents. |
| ProductObservation | Observed price, price conditions, availability, source timestamp, import run, relevant source fields. |
| CatalogOverride | Owner correction to a product field, kept separately from scraped values. |
| CuttingProfile | Home/workshop label, kerf, edge trims, optional minimum part dimensions. |
| PurchasePlan | Approved revision, chosen store, selected observations, settings, completeness, totals, algorithm version. |
| PanelLayout | Stock product, panel instance, part placements, rotation, cut tree, waste and offcuts. |
| Job / ImportRun | Work type, progress, timestamps, result reference, diagnostic errors. |

Use fixed-point millimeter values for geometry, supporting 0.1 mm precision. Use integer euro cents for charged prices and decimal quantities for lengths, areas, or volumes. Convert geometry to integer tenths of a millimeter inside the solver to avoid floating-point fitting errors.

Maintain the relationship between source dimensions and derived dimensions. Changing a construction parameter recomputes dependent parts; an explicit manual override is flagged rather than silently overwritten.

### Service boundaries

- `analyzeDrawing(input) → AnalysisDraft`: private image references, material choices, existing decisions, and owner answers produce proposed requirements and questions.
- `deriveRequirements(input) → RequirementsDraft`: validated construction parameters produce deterministic part sizes and material quantities.
- `approveRequirements(revisionId) → ApprovedRevision`: validates completeness and freezes the requirements snapshot.
- `importCatalog(store, categorySelection) → ImportRun`: discovers products and saves normalized observations without altering project snapshots.
- `calculatePurchasePlan(input) → PurchasePlan`: approved requirements, store observations, confirmed matches, and cutting settings produce layouts, purchases, totals, and unmet requirements.

These are internal TypeScript contracts. Request handlers return a job ID for asynchronous work, and an authenticated status endpoint returns its state and result reference. Do not pass arbitrary AI output directly into persistence or the optimizer.

### Revision behavior

The project progresses through draft, analysis/review, approved, and planned states. Background execution status is tracked separately so a failed job does not destroy the last valid revision.

Changing construction, dimensions, quantities, or materials creates a new draft revision and makes previous plans historical. Changing only store, price selection, or cutting settings creates a new purchase calculation; renewed requirements approval is needed only if the actual requirements change.

Catalog updates never silently change saved plan prices. Recalculation explicitly selects a new catalog snapshot.

## 6. AI Integration

### Provider choice

Use Gemini as the initial production provider for image interpretation, construction suggestions, and clarification questions. Use its structured-output capability and validate the result against the application's schema.

Keep the provider behind an adapter. A future DeepSeek adapter must implement the same output contract; it must not require changes to the parts editor or optimizer. Do not call both providers for every project by default.

The exact Gemini model ID is server configuration, selected during the evaluation milestone from models accessible to the owner's key. Record the resolved model for each run. Do not hardcode an unverified model name or assume that a model available in a chat application is available through the API.

### Responsibilities and restrictions

AI may read labels, infer likely furniture components, suggest construction templates, explain assumptions, and ask questions. Deterministic code calculates final dimensions, quantities, purchase rounding, fitting, and prices.

The output schema must support missing values explicitly. Model confidence is advisory and cannot substitute for approval. Preserve extracted values separately from calculated and proposed ones.

Schema validation is necessary but does not prove correctness. Reject negative dimensions, impossible quantities, unknown part references, and incompatible material assignments. Allow one controlled repair attempt for malformed structured output; otherwise preserve the failure and offer retry or manual entry.

Send only the images and project information needed for the analysis. Keep keys and full request payloads out of ordinary logs. Store model usage and latency so actual analysis cost can be evaluated.

### Evaluation before model selection

Prepare 5–10 owner-provided drawings with manually checked expected results, including readable, blurry, incomplete, and multi-view examples. Measure dimension accuracy, missing/extra parts, invented measurements, useful clarification questions, latency, and actual API cost.

Prefer the evaluated Gemini model that satisfies the correctness checks at acceptable cost. A serious silent invention of a missing dimension is a failed case. If Gemini results are insufficient, evaluate DeepSeek through a separate adapter before changing the default; do not claim either provider is more accurate without this comparison.

## 7. Store Catalog Import

### Scope and feasibility milestone

Build separate Senukai and Ermitažas adapters for the relevant panel, edge-banding, furniture-hardware, and fastener categories. Support imports initiated from category selections and individual product URLs.

Before building a broad crawler, inspect representative product pages from each store and verify that dimensions, variants, pack sizes, prices, and availability can be extracted consistently. Include LMDP, spruce, birch, a hardware pack, and a fastener pack wherever each store actually lists them.

Public pages have been found, but reliable mass import has not yet been demonstrated. Do not promise either store carries every required material or compatible hardware system.

### Extraction strategy

1. Prefer publicly delivered structured product data where it contains the required fields.
2. Parse rendered HTML attributes where structured fields are incomplete.
3. Use Playwright rendering when required for publicly accessible content.
4. Normalize into the shared catalog model and send incomplete or contradictory entries to review.

Check each site's published crawling guidance before implementation. Use bounded concurrency, caching, and backoff. Stop on persistent access blocks; do not build an access-control bypass.

### Normalization and review

- Identify products by store and external product/variant identity, not by title alone.
- Normalize lengths to millimeters while preserving original labels for auditing.
- Distinguish stock-sheet price from price per square meter, per piece, per linear meter, or per pack.
- Represent purchasable increments explicitly. Do not assume that an advertised area unit means an arbitrary fraction of a panel can be purchased.
- Store regular and conditional prices separately, with observed dates and conditions.
- Track availability as an observation, including an unknown state; do not interpret missing data as in stock or out of stock.
- Exclude entries with missing required dimensions, price, or selling-unit information from automatic purchase selection.
- Preserve owner corrections in an override layer. Subsequent imports may flag a conflict but must not silently erase the correction.
- A failed or partial import must not mark the entire previously imported catalog unavailable.

Catalog administration supports search, material filters, manual products, corrections, review status, and refresh actions. CSV import is not required for v1; manual entry is the fallback when a source cannot be imported.

## 8. Deterministic Requirements and Purchase Calculation

### 8.1 Construction arithmetic

Templates encode confirmed assembly relationships. For example, a bottom mounted between two full-height side panels has width `externalWidth - leftThickness - rightThickness`. A top mounted over the sides follows a different rule.

All such decisions must be explicit. Validate the resulting geometry against overall dimensions and reject zero or negative results. Unsupported geometry remains manual.

For banded parts, store which edges are treated and whether supplied dimensions describe the finished part or the cut blank. Where finished dimensions are specified, calculate and display the appropriate band-thickness deductions.

### 8.2 Compatible stock candidates

Partition demand by confirmed material, species, thickness, and decor. Grain direction belongs to the part relative to the stock grain axis. Do not infer LMDP decor equivalence from similar product names.

Use confirmed compatible products from the chosen store, retaining different stock sizes as candidates. Hardware must meet confirmed function, dimensions, and mounting requirements. Unknown compatibility requires owner confirmation.

### 8.3 Cutting solver

Implement a deterministic, multi-start rectangular guillotine-packing heuristic. A guillotine cut runs across the current rectangular offcut, allowing the output to be represented as an executable cut tree.

For each material group:

1. Expand row quantities into labeled part instances.
2. Compute usable stock rectangles after edge trimming.
3. Reject individually impossible parts before search, considering allowed rotation.
4. Try multiple fixed part orders, including descending area, longest side, and width.
5. Explore compatible stock sizes and horizontal/vertical split alternatives, accounting for kerf at every actual cut.
6. Compare completed feasible layouts by purchased material cost, then waste, panel count, and cut count.
7. Stop within a configurable time budget, initially 30 seconds per project, and retain the best verified solution found.

Permit mixed stock sizes within a material group. Use fixed tie-breaking and seeds so the same inputs and solver version produce reproducible results.

Maintain a separate geometric validator that checks every produced layout for bounds, overlaps, kerf, trim, rotation, grain, and exact part-instance coverage. Only validated layouts may be published.

Report whether a valid result was found, an individual part is impossible, or the search ended without finding a complete layout. Search failure is not proof of mathematical infeasibility. Never label a heuristic result globally optimal.

### 8.4 Additional materials

- Edge banding: sum selected edge lengths, add an explicit owner-controlled allowance, then round to the actual selling increment.
- Hardware and fasteners: derive quantities from approved construction rules or explicit owner input; retain the calculation explanation.
- Pack products: calculate complete packs using ceiling division and show unused units.
- Consumables such as glue or finish: require an entered amount or a confirmed coverage rate and allowance. Do not estimate an exact requirement from the drawing alone.
- Optional spare quantities are explicit inputs; no hidden blanket waste percentage is added to the entire bill.

### 8.5 Completeness and pricing

A complete plan covers every approved part and material requirement with valid quantities and prices. Missing hardware, unknown prices, or incompatible stock produce an incomplete plan with priced subtotals and a clear unresolved list.

Calculate totals from the saved product observations, not the current mutable catalog. Show membership conditions when the owner explicitly selects a conditional price. Do not automatically mix price conditions that cannot apply together.

An unknown or stale availability observation can be included only with explicit owner confirmation and remains visibly unverified. Mark observations older than seven days as stale by default and offer a targeted refresh before recalculation.

## 9. Verification Strategy

### Domain and solver tests

- Changing carcass thickness recomputes the correct dependent parts.
- Different top/bottom and back mounting arrangements produce the expected dimensions.
- Finished and cut dimensions remain consistent with selected edge treatments.
- Quantity expansion and duplicated parts retain exact identity and coverage.
- Grain-constrained parts cannot be rotated into an invalid orientation.
- Kerf and edge trims can make an otherwise fitting arrangement invalid.
- A part can fail to fit even when total stock area is sufficient.
- Different stock sizes are compared by total purchase cost, not unit area price alone.
- Pack counts and selling increments round correctly.
- No fit, no compatible product, unknown price, and exhausted search budget are distinct outcomes.

Use known-answer layout fixtures and property-based geometry checks. Verify solver output using the independent layout validator rather than tests that simply mirror the packing algorithm.

### Import and AI tests

Use saved, sanitized store-page fixtures for repeatable parser tests, including variant sizes, decimal commas, conditional prices, pack contents, unavailable items, and missing fields. Reimporting must be idempotent and preserve manual overrides.

Use mocked AI responses for schema and workflow tests. Keep live paid AI evaluation separate from normal CI. Test blurry inputs, conflicting dimensions, unresolved fields, malformed output, rate limits, and interrupted jobs.

### End-to-end acceptance

With a manually verified cabinet or shelving example:

1. Select material and upload its drawing.
2. Resolve an AI question and correct a part.
3. Approve the requirements.
4. Select a store, confirm product matches, and supply a cutting profile.
5. Produce a valid cutting plan and fully priced shopping list.
6. Export PDF/CSV and verify they match the displayed revision.
7. Change a dimension and confirm that the previous plan becomes historical.

Also verify phone usability, unauthorized-file access rejection, worker restart recovery, and that API keys never appear in client assets or logs.

## 10. Delivery Milestones

### Milestone 1 — Validate the uncertain inputs

- Test representative product extraction from both stores.
- Obtain representative drawings and expected part lists from the owner.
- Evaluate accessible Gemini models and save the chosen model ID in configuration.
- Document missing catalog fields and unsupported construction cases.

**Exit condition:** demonstrate a real structured drawing interpretation and a normalized product sample from each store, or explicitly record a blocked source and its manual-entry fallback. Do not present a fallback as a completed scraper.

### Milestone 2 — Build a useful manual foundation

- Scaffold Next.js, TypeScript, PostgreSQL migrations, owner authentication, private storage, and the worker queue.
- Implement projects, material groups, catalog review, manual requirements editing, revisions, and approval.
- Add both store import adapters and their fixture tests.

**Exit condition:** manually entered furniture requirements can be approved and linked to real catalog products.

### Milestone 3 — Deliver purchase planning

- Implement construction arithmetic, hardware/pack calculations, and edge-banding calculations.
- Build the cutting solver and independent validator.
- Add purchase snapshots, diagrams, cut sequences, and PDF/CSV export.

**Exit condition:** a verified manual project yields a correct, reproducible purchase plan with valid layouts.

### Milestone 4 — Integrate the AI-assisted workflow

- Add image analysis, structured output validation, clarification questions, and source/proposal labels.
- Connect approved construction parameters to deterministic requirements.
- Ensure product changes affecting geometry return the project to review.

**Exit condition:** an uploaded drawing can reach the same verified result through review and approval.

### Milestone 5 — Validate real use and deploy

- Run the agreed drawing evaluation and end-to-end checks.
- Test home and workshop cutting profiles and all three main material choices.
- Deploy web/worker/database services, configure backups, and verify restoration on a test instance.
- Record job failures, import completeness, model usage, and calculation duration without logging private images or secrets.

**Exit condition:** the owner can complete the full workflow from a phone or computer and recover from failed analysis/import jobs without losing reviewed work.

## 11. Known Dependencies and Practical Limits

- API keys exist but have not been tested in this repository. Model access, quotas, and real analysis cost require the evaluation milestone.
- Representative owner drawings and verified expected dimensions are still needed for meaningful evaluation.
- Store catalog structure and access can change. Keep adapters independent and preserve imported history.
- Catalog coverage may not include every decor, panel thickness, or hardware system; show missing requirements explicitly.
- The application prepares material requirements and cutting plans. It does not certify structural strength or replace manufacturer hardware installation instructions.
- All source observations below were reviewed during planning, not through an implemented scraper. No application code or live integration exists yet.

## 12. Reference Documentation

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js server and client components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js backend-for-frontend guidance and hosting limitations](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [DeepSeek vision API, for a future provider adapter](https://api-docs.deepseek.com/guides/vision/)
- [Senukai panel example](https://www.senukai.lt/p/klijuota-plokste-berzas-2000-x-200-mm-x-18-mm/e6cw)
- [Senukai fastener-pack and price-condition example](https://www.senukai.lt/p/medsraigtis-universalieji-forte-tools-4-5-x-40-mm-balta-sp-200-vnt/h8fa)
- [Ermitažas furniture-hinge category](https://www.ermitazas.lt/c/baldai-interjeras-tekstile/baldu-furnitura/baldu-lankstai/dureliu-lankstai)

Provider model names, library versions, product availability, and prices must be verified again during implementation. The links establish relevant capabilities and representative data, not guaranteed extraction coverage or model accuracy.
