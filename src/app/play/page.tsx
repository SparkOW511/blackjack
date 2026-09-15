import type { Metadata } from "next";
import { BlackjackTableClient } from "@/components/ClientOnly";

export const metadata: Metadata = {
  title: "Table — True Count",
  description: "Play blackjack against a live-shuffled shoe with a card counting coach.",
};

export default function PlayPage() {
  return <BlackjackTableClient />;
}
