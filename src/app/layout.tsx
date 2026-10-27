import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import styles from "./layout.module.css";

const TITLE = "Tastora — Good food should still feel like home";
const DESCRIPTION =
  "Find New York restaurants that match the tastes of someone you care for, with clear notes on what to check.";

export const metadata: Metadata = {
  metadataBase: new URL("https://tastora-three.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "Tastora", url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf6ee" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1512" },
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
              <svg aria-hidden="true" focusable="false" className={styles.mark} viewBox="0 0 24 24" width="24" height="24">
                <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M12 2.5a9.5 9.5 0 0 0 0 19z" fill="currentColor" />
              </svg>
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
