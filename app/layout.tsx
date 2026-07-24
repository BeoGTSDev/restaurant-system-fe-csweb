import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maison Lucas · Order at your table",
  description: "Browse the menu and order directly from your table.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
