import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dirbtuvės | Medžiagų planas",
  description:
    "Furniture requirements, cutting layouts, and purchase planning.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ece5d7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="lt">
      <body>{children}</body>
    </html>
  );
}
