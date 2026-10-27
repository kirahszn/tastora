import type { Metadata } from "next";
import { ResultsView } from "./ResultsView";

export const metadata: Metadata = {
  title: "Suggestions — Tastora",
};

export default function ResultsPage() {
  return <ResultsView />;
}
