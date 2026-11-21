import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/inter";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/aa/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "AllAboard",
  description: "Plan greener trips by train, bus and car share, before you buy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          <SiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
          <Toaster closeButton toastOptions={{ className: "!border-2 !border-ink !rounded-xl !shadow-hard-sm !font-sans" }} />
        </TooltipProvider>
      </body>
    </html>
  );
}
