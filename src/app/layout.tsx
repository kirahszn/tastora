import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tastora — Good food should still feel like home",
  description:
    "Find restaurant meals that match the tastes of someone you care for.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
