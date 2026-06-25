import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import { ClienteAuthProvider } from "./components/ClienteAuthProvider";
import { VisitTracker } from "./components/VisitTracker";
import { WishlistProvider } from "@/lib/use-wishlist";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pastoril Moda Country",
  description: "Loja online Pastoril Moda Country",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const themeColor = "#241006";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClienteAuthProvider>
          <WishlistProvider>
            <VisitTracker />
            {children}
          </WishlistProvider>
        </ClienteAuthProvider>
      </body>
    </html>
  );
}
