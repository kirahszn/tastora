import { SHARE_ALT, SHARE_SIZE, shareCard } from "./shareCard";

export const alt = SHARE_ALT;
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return shareCard();
}
