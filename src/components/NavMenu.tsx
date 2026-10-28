"use client";
// The landing page's section links on phones: a native <details> disclosure, so it opens and
// closes without JavaScript too. Script only adds closing on Escape, on a link tap, and on a
// tap outside.
import Link from "next/link";
import { useEffect, useRef } from "react";
import styles from "@/app/layout.module.css";

export interface NavItem {
  href: string;
  label: string;
}

export function NavMenu({ items }: { items: readonly NavItem[] }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const close = () => {
      el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        close();
        el.querySelector("summary")?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (el.open && !el.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return (
    <details ref={ref} className={styles.menu}>
      <summary className={styles.menuButton}>
        <span className={styles.menuIcon} aria-hidden="true" />
        <span className={styles.menuText}>Menu</span>
      </summary>
      <ul className={styles.menuList}>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={styles.menuLink}
              onClick={() => {
                if (ref.current) ref.current.open = false;
              }}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
