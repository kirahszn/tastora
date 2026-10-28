import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import Link from "next/link";
import { ChefMark } from "@/components/ChefMark";
import { NavMenu } from "@/components/NavMenu";
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

// Self-hosted at build time by next/font: the browser never calls Google.
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

const REPO_URL = "https://github.com/kirahszn/tastora";

const SECTIONS = [
  { href: "/#how", label: "How it works" },
  { href: "/#qloo", label: "Why Qloo" },
  { href: "/#rules", label: "Our rules" },
] as const;

const PHOTOS = [
  { by: "Anna Shvets", href: "https://www.pexels.com/photo/a-family-eating-dinner-together-11368637/" },
  { by: "Nothing Ahead", href: "https://www.pexels.com/photo/choice-of-food-during-family-dinner-20089303/" },
  { by: "Juan TM", href: "https://www.pexels.com/photo/engaging-dinner-gathering-with-shared-plates-31705508/" },
] as const;

const NEW_TAB = <span className="sr-only"> (opens in a new tab)</span>;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <header className={styles.header}>
          <div className={styles.pill}>
            <Link href="/" className={styles.brand}>
              <ChefMark size={30} />
              Tastora
            </Link>
            {/* The landing page shows its section links and a "Find food" pill (phones: the pill
                and a menu); every other page keeps the single Profile link. */}
            <nav aria-label="Main" className={styles.nav}>
              {SECTIONS.map((s) => (
                <Link key={s.href} href={s.href} className={`${styles.navText} ${styles.landingOnly}`}>
                  {s.label}
                </Link>
              ))}
              <Link href="/profile" className={`${styles.navText} ${styles.otherPagesOnly}`}>
                Profile
              </Link>
              <Link href="/profile" className={`btn btn-primary ${styles.navPill} ${styles.landingPill}`}>
                Find food <span aria-hidden="true">↗</span>
              </Link>
              <div className={styles.landingMenu}>
                <NavMenu items={SECTIONS} />
              </div>
            </nav>
          </div>
        </header>
        <main id="main" className={styles.main} tabIndex={-1}>
          {children}
        </main>
        <footer className={styles.footer}>
          <div className={styles.footerInner}>
            <div className={styles.footerLead}>
              <p className={styles.footerBrand}>
                <ChefMark size={26} />
                Tastora
              </p>
              <p>
                Restaurants that fit someone&rsquo;s taste, and the questions to ask before you go. Free, no sign-up.
              </p>
              <p className="mono">Taste data by Qloo · Made for caregivers</p>
            </div>
            <nav aria-label="Footer" className={styles.footerNav}>
              <Link href="/profile">Find food</Link>
              {SECTIONS.map((s) => (
                <Link key={s.href} href={s.href}>
                  {s.label}
                </Link>
              ))}
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                GitHub{NEW_TAB}
              </a>
            </nav>
          </div>
          <div className={styles.footerSmall}>
            <p>
              MIT licence · Photos on Pexels by{" "}
              {PHOTOS.map((p, i) => (
                <span key={p.by}>
                  {i > 0 && (i === PHOTOS.length - 1 ? " and " : ", ")}
                  <a href={p.href} target="_blank" rel="noopener noreferrer">
                    {p.by}
                    {NEW_TAB}
                  </a>
                </span>
              ))}{" "}
              (Pexels License; the people pictured don&rsquo;t endorse Tastora).
            </p>
            <p>The Qloo name belongs to its owner and is used here only to credit the taste data.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
