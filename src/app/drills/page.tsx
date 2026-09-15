import type { Metadata } from "next";
import { DrillsClient } from "@/components/ClientOnly";

export const metadata: Metadata = {
  title: "Drills — True Count",
  description: "Card counting drills: Hi-Lo tags, flash counting, deck countdown and true count conversion.",
};

export default function DrillsPage() {
  return <DrillsClient />;
}
