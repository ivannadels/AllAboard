import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { TrainFront } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "AllAboard",
  description: "Plan greener trips by train, bus and car share, before you buy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <TooltipProvider>
          <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <TrainFront className="size-4" />
                </span>
                AllAboard
              </Link>
              <nav className="flex items-center gap-4 text-sm text-muted-foreground">
                <Link href="/search" className="hover:text-foreground">
                  Search
                </Link>
                <Link href="/" className="hover:text-foreground">
                  Trips
                </Link>
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

          <footer className="border-t">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
              <span>Trains, buses and car sharing only. We never sell flights.</span>
              <Badge variant="outline" className="font-mono tracking-wider">
                MOCK DATA
              </Badge>
            </div>
          </footer>
          <Toaster richColors closeButton />
        </TooltipProvider>
      </body>
    </html>
  );
}
