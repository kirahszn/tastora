import type { Metadata } from "next";
import { PrintView } from "./PrintView";

export const metadata: Metadata = {
  title: "Questions to ask — Tastora",
};

export default function PrintPage() {
  return <PrintView />;
}
