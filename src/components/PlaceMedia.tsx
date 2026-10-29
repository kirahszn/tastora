"use client";
// A place's picture (Phase 12): Qloo's own image for that place when the response has one, credited
// "Image: Qloo", otherwise (or if it fails to load) an original cuisine illustration chosen from the
// place's cuisine tags. Never a stock food photo: on a restaurant card that would imply their dish.
import { useEffect, useRef, useState } from "react";
import { cuisineArtFor, qlooImageUrl } from "@/lib/ui/cuisineArt";
import { CuisineArt } from "./CuisineArt";
import styles from "./PlaceMedia.module.css";

export function PlaceMedia({
  imageUrl,
  alt,
  cuisines,
  className = "",
  children,
}: {
  imageUrl?: string | null;
  /** Describes the photo; the illustration is decorative. */
  alt: string;
  cuisines: readonly string[];
  className?: string;
  /** Overlays, e.g. the rank badge. */
  children?: React.ReactNode;
}) {
  const src = qlooImageUrl(imageUrl);
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const kind = cuisineArtFor(cuisines);

  // An image that failed before hydration never fires onError; check it once mounted.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  const photo = src && !failed;
  return (
    <div className={`${styles.media} ${className}`} data-art={photo ? undefined : kind}>
      {photo ? (
        <>
          {/* Qloo's CDN image as served (420px wide); next/image would proxy it for no gain. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={img}
            className={styles.photo}
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
          <span className={styles.credit}>Image: Qloo</span>
        </>
      ) : (
        <CuisineArt kind={kind} className={styles.art} />
      )}
      {children}
    </div>
  );
}
