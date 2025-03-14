import HeaderAuth from "@/components/header-auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import "./globals.css";
import { 
  cryuncial, 
  alchemist, 
  unzialish, 
  celticknots, 
  quillsword,
  quickquill,
  luminari,
  gorckhelozat,
  mysticora
} from './fonts';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Merlin's Tower",
  description: "Ask anything, and let magic guide your way...",
};

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.className} ${cryuncial.variable} ${alchemist.variable} ${unzialish.variable} ${celticknots.variable} ${quillsword.variable} ${quickquill.variable} ${luminari.variable} ${gorckhelozat.variable} ${mysticora.variable}`} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="min-h-screen flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col items-center">
              <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
                  <div className="flex gap-5 items-center font-semibold">
                  <ThemeSwitcher />
                    <Link className="font-celticknots text-4xl pt-2" href={"/"}>Merlin's Tower 🏰</Link>
                  </div>
                  <HeaderAuth />
                </div>
              </nav>

              <div className="flex-1 w-full">
                {children}
              </div>
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
