import dotenv from "dotenv";
import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { LibSQLStore } from "@mastra/libsql";

import { weatherAgent } from "./agents/weather";
import { codeReviewAgent } from "./agents/code-review";
import { translatorAgent } from "./agents/translator";
import { currencyAgent } from "./agents/currency";
import { summarizerAgent } from "./agents/summarizer";
import { dailyPlannerAgent } from "./agents/daily-planner";

dotenv.config({ path: "../../.env" });

export const mastra = new Mastra({
  agents: {
    weatherAgent,
    codeReviewAgent,
    translatorAgent,
    currencyAgent,
    summarizerAgent,
    dailyPlannerAgent,
  },
  logger: createLogger({
    name: "Mastra",
    level: "info",
  }),
  storage: new LibSQLStore({
    url: process.env.TURSO_DATABASE_URL || "file:../mastra.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  }) as any,
});
