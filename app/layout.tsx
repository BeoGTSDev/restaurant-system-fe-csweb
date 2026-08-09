// Root layout shared by every page in this web app.
import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import { ThemeProvider } from "./ThemeProvider";

export const metadata: Metadata = {
  title: "Maison Lucas · Order at your table",
  description: "Browse the menu and order directly from your table.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeScript = `(function(){try{var t=localStorage.getItem('restaurant-ui-theme')||'system';var r=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r}catch(e){}})()`;
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body><ThemeProvider>{children}</ThemeProvider></body></html>;
}
