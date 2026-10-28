import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ChefMark } from "@/components/ChefMark";
import "./globals.css";
import styles from "./layout.module.css";

const TITLE = "Tastora — Good food should still feel like home";
const DESCRIPTION =
  "Find restaurants near someone you care for that match their tastes, with clear notes on what to check.";

export const metadata: Metadata = {
  metadataBase: new URL("https://tastora-three.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "Tastora", url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Tastora has one warm light theme; the browser chrome matches the page.
export const viewport: Viewport = {
  themeColor: "#fffbf7",
  colorScheme: "light",
};

const REPO_URL = "https://github.com/kirahszn/tastora";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="/" className={styles.brand}>
              <ChefMark size={34} />
              Tastora
            </Link>
            {/* The landing page shows its section links and a "Find food" pill (phones: the pill
                only); every other page keeps the single Profile link. */}
            <nav aria-label="Main" className={styles.nav}>
              <Link href="/#how" className={`${styles.navText} ${styles.landingOnly}`}>
                How it works
              </Link>
              <Link href="/#qloo" className={`${styles.navText} ${styles.landingOnly}`}>
                Why Qloo
              </Link>
              <Link href="/profile" className={`${styles.navText} ${styles.landingOnly}`}>
                Profile
              </Link>
              <Link href="/profile" className={`${styles.navLink} ${styles.otherPagesOnly}`}>
                Profile
              </Link>
              <Link href="/profile" className={`btn btn-primary ${styles.navPill} ${styles.landingPill}`}>
                Find food
              </Link>
            </nav>
          </div>
        </header>
        <main id="main" className={styles.main} tabIndex={-1}>
          {children}
        </main>
        <footer className={styles.footer}>
          <div className={styles.footerInner}>
            <p>
              Powered by <strong>Qloo</strong> taste intelligence · Built with Claude
            </p>
            <p>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                Source on GitHub<span className="sr-only"> (opens in a new tab)</span>
              </a>{" "}
              · MIT licence
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
