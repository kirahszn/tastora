// Response types the UI reads. Type-only re-exports: nothing server-side reaches the client bundle.
export type { PlaceRef, QlooEvidence, RecommendResponse, RecommendResult } from "@/lib/agent/recommend";
export type { TraceStep } from "@/lib/agent/session";
export type { RequirementResult, RequirementStatus } from "@/lib/constraints/evaluate";
