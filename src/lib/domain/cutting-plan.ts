/**
 * A deliberately deterministic cutting-plan calculator. It is kept separate
 * from AI calls: every suggested purchase must have a non-overlapping layout
 * whose coordinates are inside the stock board.
 */
export type CutRequirement = {
  id: string;
  label: string;
  quantity: number;
  lengthMm: number;
  widthMm: number;
};

export type StockBoard = {
  id: string;
  label: string;
  lengthMm: number;
  widthMm: number;
  priceCents: number | null;
  url: string;
};

export type CutPlacement = {
  requirementId: string;
  label: string;
  lengthMm: number;
  widthMm: number;
  rotated: boolean;
  xMm: number;
  yMm: number;
};

export type PlannedBoard = {
  boardNumber: number;
  placements: CutPlacement[];
  remainingAreaMm2: number;
};

export type PurchasePlan = {
  stock: StockBoard;
  boards: PlannedBoard[];
  totalCents: number | null;
  sawKerfMm: number;
};

export type CuttingPlanResult =
  | { ok: true; plan: PurchasePlan; alternatives: PurchasePlan[] }
  | {
      ok: false;
      reason: "NO_REQUIREMENTS" | "NO_FITTING_STOCK";
      oversizedRequirements: CutRequirement[];
    };

type Rectangle = { x: number; y: number; length: number; width: number };
type WorkingBoard = { placements: CutPlacement[]; free: Rectangle[] };
type ExpandedRequirement = Omit<CutRequirement, "quantity">;
type PlacementCandidate = {
  free: Rectangle;
  index: number;
  allocatedLength: number;
  allocatedWidth: number;
  rotated: boolean;
};

const tenthsPerMillimetre = 10;

function toTenths(value: number) {
  return Math.round(value * tenthsPerMillimetre);
}

function fromTenths(value: number) {
  return value / tenthsPerMillimetre;
}

function isPositiveDimension(value: number) {
  return Number.isFinite(value) && value > 0;
}

function expandRequirements(requirements: CutRequirement[]) {
  return requirements
    .flatMap((requirement) =>
      Array.from({ length: requirement.quantity }, (_, index) => ({
        ...requirement,
        id: `${requirement.id}-${index + 1}`,
      })),
    )
    .sort(
      (first, second) =>
        second.lengthMm * second.widthMm - first.lengthMm * first.widthMm ||
        Math.max(second.lengthMm, second.widthMm) -
          Math.max(first.lengthMm, first.widthMm),
    );
}

function placeOnBoard(
  board: WorkingBoard,
  requirement: ExpandedRequirement,
  sawKerfTenths: number,
) {
  const originalLength = toTenths(requirement.lengthMm) + sawKerfTenths;
  const originalWidth = toTenths(requirement.widthMm) + sawKerfTenths;
  const candidates = board.free
    .flatMap(({ x, y, length, width }, index) => {
      const free = { x, y, length, width };
      const candidates: PlacementCandidate[] = [];

      if (originalLength <= free.length && originalWidth <= free.width) {
        candidates.push({
          free,
          index,
          allocatedLength: originalLength,
          allocatedWidth: originalWidth,
          rotated: false,
        });
      }

      if (
        originalLength !== originalWidth &&
        originalWidth <= free.length &&
        originalLength <= free.width
      ) {
        candidates.push({
          free,
          index,
          allocatedLength: originalWidth,
          allocatedWidth: originalLength,
          rotated: true,
        });
      }

      return candidates;
    })
    .sort(
      (first, second) =>
        first.free.length * first.free.width -
          second.free.length * second.free.width ||
        first.free.y - second.free.y ||
        first.free.x - second.free.x ||
        Number(first.rotated) - Number(second.rotated),
    );
  const candidate = candidates[0];

  if (!candidate) {
    return false;
  }

  const { free } = candidate;
  const placement: CutPlacement = {
    requirementId: requirement.id,
    label: requirement.label,
    lengthMm: requirement.lengthMm,
    widthMm: requirement.widthMm,
    rotated: candidate.rotated,
    xMm: fromTenths(free.x),
    yMm: fromTenths(free.y),
  };
  const right: Rectangle = {
    x: free.x + candidate.allocatedLength,
    y: free.y,
    length: free.length - candidate.allocatedLength,
    width: free.width,
  };
  const below: Rectangle = {
    x: free.x,
    y: free.y + candidate.allocatedWidth,
    length: candidate.allocatedLength,
    width: free.width - candidate.allocatedWidth,
  };

  board.placements.push(placement);
  board.free.splice(candidate.index, 1, right, below);
  board.free = board.free.filter(
    (rectangle) => rectangle.length && rectangle.width,
  );
  return true;
}

function placementBounds(placement: CutPlacement, sawKerf: number) {
  const left = toTenths(placement.xMm);
  const top = toTenths(placement.yMm);
  const length =
    toTenths(placement.rotated ? placement.widthMm : placement.lengthMm) +
    sawKerf;
  const width =
    toTenths(placement.rotated ? placement.lengthMm : placement.widthMm) +
    sawKerf;

  return { left, top, right: left + length, bottom: top + width };
}

function verifyPlacementWithinBoard(
  placement: CutPlacement,
  stockLength: number,
  stockWidth: number,
  sawKerf: number,
) {
  const bounds = placementBounds(placement, sawKerf);

  if (
    bounds.left < 0 ||
    bounds.top < 0 ||
    bounds.right > stockLength ||
    bounds.bottom > stockWidth
  ) {
    throw new Error(
      "Generated cutting plan has a placement outside its stock board.",
    );
  }
}

function placementsOverlap(
  first: CutPlacement,
  second: CutPlacement,
  sawKerf: number,
) {
  const a = placementBounds(first, sawKerf);
  const b = placementBounds(second, sawKerf);

  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

function verifyBoard(
  board: PlannedBoard,
  stockLength: number,
  stockWidth: number,
  sawKerf: number,
) {
  for (const placement of board.placements) {
    verifyPlacementWithinBoard(placement, stockLength, stockWidth, sawKerf);
  }

  for (let first = 0; first < board.placements.length; first += 1) {
    for (
      let second = first + 1;
      second < board.placements.length;
      second += 1
    ) {
      if (
        placementsOverlap(
          board.placements[first],
          board.placements[second],
          sawKerf,
        )
      ) {
        throw new Error(
          "Generated cutting plan contains overlapping placements.",
        );
      }
    }
  }
}

function verifyPlan(plan: PurchasePlan) {
  const stockLength = toTenths(plan.stock.lengthMm);
  const stockWidth = toTenths(plan.stock.widthMm);
  const sawKerf = toTenths(plan.sawKerfMm);

  for (const board of plan.boards) {
    verifyBoard(board, stockLength, stockWidth, sawKerf);
  }
}

function makePlanForStock(
  requirements: ExpandedRequirement[],
  stock: StockBoard,
  sawKerfMm: number,
): PurchasePlan | null {
  const stockLength = toTenths(stock.lengthMm);
  const stockWidth = toTenths(stock.widthMm);
  const sawKerfTenths = toTenths(sawKerfMm);
  const boards: WorkingBoard[] = [];

  for (const requirement of requirements) {
    let placed = false;

    for (const board of boards) {
      if (placeOnBoard(board, requirement, sawKerfTenths)) {
        placed = true;
        break;
      }
    }

    if (!placed) {
      const board: WorkingBoard = {
        placements: [],
        free: [{ x: 0, y: 0, length: stockLength, width: stockWidth }],
      };

      if (!placeOnBoard(board, requirement, sawKerfTenths)) {
        return null;
      }

      boards.push(board);
    }
  }

  const plan: PurchasePlan = {
    stock,
    sawKerfMm,
    totalCents:
      stock.priceCents === null ? null : stock.priceCents * boards.length,
    boards: boards.map((board, index) => ({
      boardNumber: index + 1,
      placements: board.placements,
      remainingAreaMm2: board.free.reduce(
        (area, rectangle) =>
          area + fromTenths(rectangle.length) * fromTenths(rectangle.width),
        0,
      ),
    })),
  };

  verifyPlan(plan);
  return plan;
}

/**
 * Finds a verified layout using one available stock size. A rectangular cut
 * may rotate; its placement records that rotation for workshop review.
 */
export function calculateCuttingPlan(
  requirements: CutRequirement[],
  availableStock: StockBoard[],
  sawKerfMm = 3,
): CuttingPlanResult {
  const validRequirements = requirements.filter(
    (requirement) =>
      Number.isInteger(requirement.quantity) &&
      requirement.quantity > 0 &&
      isPositiveDimension(requirement.lengthMm) &&
      isPositiveDimension(requirement.widthMm),
  );
  const validStock = availableStock.filter(
    (stock) =>
      isPositiveDimension(stock.lengthMm) && isPositiveDimension(stock.widthMm),
  );

  if (!validRequirements.length) {
    return { ok: false, reason: "NO_REQUIREMENTS", oversizedRequirements: [] };
  }

  const expandedRequirements = expandRequirements(validRequirements);
  const alternatives = validStock
    .map((stock) => makePlanForStock(expandedRequirements, stock, sawKerfMm))
    .filter((plan): plan is PurchasePlan => plan !== null)
    .sort((first, second) => {
      const firstCost = first.totalCents ?? Number.MAX_SAFE_INTEGER;
      const secondCost = second.totalCents ?? Number.MAX_SAFE_INTEGER;
      return (
        firstCost - secondCost ||
        first.boards.length - second.boards.length ||
        first.boards.reduce((area, board) => area + board.remainingAreaMm2, 0) -
          second.boards.reduce(
            (area, board) => area + board.remainingAreaMm2,
            0,
          )
      );
    });

  if (!alternatives.length) {
    const sawKerfTenths = toTenths(sawKerfMm);
    const oversizedRequirements = validRequirements.filter((requirement) =>
      validStock.every((stock) => {
        const fitsWithoutRotation =
          toTenths(requirement.lengthMm) + sawKerfTenths <=
            toTenths(stock.lengthMm) &&
          toTenths(requirement.widthMm) + sawKerfTenths <=
            toTenths(stock.widthMm);
        const fitsRotated =
          toTenths(requirement.widthMm) + sawKerfTenths <=
            toTenths(stock.lengthMm) &&
          toTenths(requirement.lengthMm) + sawKerfTenths <=
            toTenths(stock.widthMm);

        return !fitsWithoutRotation && !fitsRotated;
      }),
    );
    return { ok: false, reason: "NO_FITTING_STOCK", oversizedRequirements };
  }

  return {
    ok: true,
    plan: alternatives[0],
    alternatives: alternatives.slice(1, 4),
  };
}
