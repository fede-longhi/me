import {
  copy,
  EVENT_BY_ID,
  EVENTS,
  ITEM_IDS,
  ITEMS,
  MOVES,
  MOVE_IDS,
  REGIONS,
  REGION_IDS,
  RELIC_IDS,
  RELICS,
  RUN_LEVELS,
  SPECIES,
  SPECIES_IDS,
} from "./runtime";

export type ContentWarning = {
  level: "warn" | "error";
  scope: string;
  message: string;
};

/** Client-safe flag — set NEXT_PUBLIC_BEAST_PATH_DEV=true in .env.local */
export function isBeastPathDev() {
  return process.env.NEXT_PUBLIC_BEAST_PATH_DEV === "true";
}

export function collectContentWarnings(): ContentWarning[] {
  const warnings: ContentWarning[] = [];

  for (const id of SPECIES_IDS) {
    const sp = SPECIES[id];
    if (!sp.art) {
      warnings.push({
        level: "warn",
        scope: `species:${id}`,
        message: "Missing thumbnail art",
      });
    }
    if (!sp.artFull) {
      warnings.push({
        level: "warn",
        scope: `species:${id}`,
        message: "Missing full-body art",
      });
    }
    for (const entry of sp.learnset) {
      if (!MOVES[entry.moveId]) {
        warnings.push({
          level: "error",
          scope: `species:${id}`,
          message: `Learnset references unknown move ${entry.moveId}`,
        });
      }
    }
    for (const locale of ["en", "es"] as const) {
      if (!copy[locale].species[id]) {
        warnings.push({
          level: "error",
          scope: `species:${id}`,
          message: `Missing ${locale} name`,
        });
      }
    }
  }

  for (const id of MOVE_IDS) {
    for (const locale of ["en", "es"] as const) {
      if (!copy[locale].moves[id]) {
        warnings.push({
          level: "error",
          scope: `move:${id}`,
          message: `Missing ${locale} copy`,
        });
      }
    }
  }

  for (const event of EVENTS) {
    for (const locale of ["en", "es"] as const) {
      const block = copy[locale].events[event.id];
      if (!block) {
        warnings.push({
          level: "error",
          scope: `event:${event.id}`,
          message: `Missing ${locale} copy`,
        });
        continue;
      }
      for (const choice of event.choices) {
        if (!block.choices[choice.labelKey]) {
          warnings.push({
            level: "error",
            scope: `event:${event.id}`,
            message: `Missing ${locale} choice "${choice.labelKey}"`,
          });
        }
      }
    }
    if (!EVENT_BY_ID[event.id]) {
      warnings.push({
        level: "error",
        scope: `event:${event.id}`,
        message: "Not indexed in EVENT_BY_ID",
      });
    }
  }

  for (const id of ITEM_IDS) {
    for (const locale of ["en", "es"] as const) {
      if (!copy[locale].items[id]) {
        warnings.push({
          level: "warn",
          scope: `item:${id}`,
          message: `Missing ${locale} copy`,
        });
      }
    }
    if (!ITEMS[id]?.art) {
      warnings.push({
        level: "warn",
        scope: `item:${id}`,
        message: "Missing art path",
      });
    }
  }

  for (const id of RELIC_IDS) {
    for (const locale of ["en", "es"] as const) {
      if (!copy[locale].relics[id]) {
        warnings.push({
          level: "warn",
          scope: `relic:${id}`,
          message: `Missing ${locale} copy`,
        });
      }
    }
    if (!RELICS[id]?.art) {
      warnings.push({
        level: "warn",
        scope: `relic:${id}`,
        message: "Missing art path",
      });
    }
  }

  for (const id of REGION_IDS) {
    const region = REGIONS[id];
    if (!region) continue;
    for (const locale of ["en", "es"] as const) {
      if (!copy[locale].regions[id]) {
        warnings.push({
          level: "error",
          scope: `region:${id}`,
          message: `Missing ${locale} name`,
        });
      }
    }
    if (region.creatures.length === 0) {
      warnings.push({
        level: "error",
        scope: `region:${id}`,
        message: "No creatures in battle pool",
      });
    }
    for (const sid of region.creatures) {
      if (!SPECIES[sid]) {
        warnings.push({
          level: "error",
          scope: `region:${id}`,
          message: `Unknown creature ${sid}`,
        });
      }
    }
    for (const sid of region.earlyCreatures ?? []) {
      if (!SPECIES[sid]) {
        warnings.push({
          level: "error",
          scope: `region:${id}`,
          message: `Unknown early creature ${sid}`,
        });
      }
    }
    if (region.bosses.length === 0) {
      warnings.push({
        level: "error",
        scope: `region:${id}`,
        message: "No bosses listed",
      });
    }
    if (!region.levels?.length) {
      warnings.push({
        level: "error",
        scope: `region:${id}`,
        message: "No path levels assigned",
      });
    } else {
      for (const level of region.levels) {
        if (level !== 1 && level !== 2 && level !== 3) {
          warnings.push({
            level: "error",
            scope: `region:${id}`,
            message: `Invalid path level ${String(level)}`,
          });
        }
      }
    }
    for (const sid of region.bosses) {
      if (!SPECIES[sid]) {
        warnings.push({
          level: "error",
          scope: `region:${id}`,
          message: `Unknown boss ${sid}`,
        });
      } else if (SPECIES[sid].rarity !== "boss") {
        warnings.push({
          level: "warn",
          scope: `region:${id}`,
          message: `Boss ${sid} does not have rarity "boss"`,
        });
      }
    }
    for (const eid of region.events) {
      if (!EVENT_BY_ID[eid]) {
        warnings.push({
          level: "error",
          scope: `region:${id}`,
          message: `Unknown event ${eid}`,
        });
      }
    }
  }

  for (const level of RUN_LEVELS) {
    const candidates = REGION_IDS.filter((id) =>
      REGIONS[id]?.levels?.includes(level),
    );
    if (candidates.length === 0) {
      warnings.push({
        level: "error",
        scope: `regionLevels:${level}`,
        message: "No regions assigned to this path level",
      });
    }
  }

  return warnings;
}
