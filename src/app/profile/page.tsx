import type { Metadata } from "next";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = {
  title: "Their tastes and needs — Tastora",
};

export default function ProfilePage() {
  return <ProfileForm />;
}
