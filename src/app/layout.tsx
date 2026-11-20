import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { getSettings } from "@/lib/settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "JH7 Marketing",
    template: "%s · JH7 Marketing",
  },
  description: "Sistema interno de gestão da JH7 Marketing.",
  icons: {
    icon: "/brand/favicon.svg",
    apple: "/brand/apple-touch-icon.png",
  },
};

// O layout lê o nome do sistema no banco. Forçar renderização por requisição
// evita que `next build` tente consultar o banco (que não existe na imagem de
// build) ao prerenderizar as páginas.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { systemName } = await getSettings();

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} dark antialiased`}
    >
      <body className="min-h-dvh bg-background text-foreground">
        {children}
        <Toaster position="top-center" richColors closeButton />
        <span className="sr-only">{systemName}</span>
      </body>
    </html>
  );
}
