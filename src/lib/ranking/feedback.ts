// Caregiver feedback on earlier results (candidate ids only). Shape matches `RankingFeedback`.
import { z } from "zod";
import type { RankingFeedback } from "./rank";

const ids = z.array(z.string().trim().min(1).max(100)).max(50).optional();

export const RankingFeedbackSchema = z.object({
  liked: ids,
  disliked: ids,
  notSuitable: ids,
  tried: ids,
}) satisfies z.ZodType<RankingFeedback>;
