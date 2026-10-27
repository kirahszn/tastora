import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Tastora — Good food should still feel like home",
  description:
    "Find New York restaurants that match the tastes of someone you care for, with clear notes on what to check.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf5ec" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1814" },
  ],
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
              <span aria-hidden="true" className={styles.mark}>
                ◐
              </span>
              Tastora
            </Link>
            <nav aria-label="Main">
              <Link href="/profile" className={styles.navLink}>
                Profile
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
              Powered by <strong>Qloo</strong> taste intelligence.
            </p>
            <p>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                Source on GitHub<span className="sr-only"> (opens in a new tab)</span>
              </a>{" "}
              · Open source under the MIT licence.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
