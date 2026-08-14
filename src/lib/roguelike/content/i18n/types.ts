import type { Element, HabitatId } from "../../types";

export type LocaleLabel = {
  species: Record<string, string>;
  elements: Record<Element, string>;
  habitats: Record<HabitatId, string>;
  regions: Record<string, string>;
  nodes: Record<
    "battle" | "elite" | "shop" | "event" | "rest" | "boss" | "start" | "habitat",
    string
  >;
  moves: Record<string, { name: string; description: string }>;
  events: Record<string, { title: string; body: string; choices: Record<string, string> }>;
  shop: Record<"heal" | "buffAtk" | "buffDef" | "recruit" | "sell" | "item" | "relic", string>;
  items: Record<string, { name: string; description: string }>;
  relics: Record<string, { name: string; description: string }>;
  ui: Record<string, string>;
};
