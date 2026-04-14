import { IDENTITY } from "./identity";
import { VOICE } from "./voice";
import { PERSONALITY } from "./personality";
import { MECHANICS } from "./mechanics";
import { MODES } from "./modes";
import { LIMITS } from "./limits";
import { EXAMPLES } from "./examples";

export const DEFAULT_SYSTEM_PROMPT = [
  IDENTITY,
  VOICE,
  PERSONALITY,
  MECHANICS,
  MODES,
  LIMITS,
  EXAMPLES,
].join("\n\n");
