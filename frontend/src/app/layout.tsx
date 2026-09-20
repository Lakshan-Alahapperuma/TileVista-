import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../features/auth/AuthContext";
import { CartProvider } from "../features/cart/context/CartContext";

export const metadata: Metadata = {
  title: "TileVista",
  description: "Experience premium virtual tile and bathware customizations, real-time inventory management, and POS tracking.",
  icons: {
    icon: '/images/ui/logo.svg'
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased selection:bg-indigo-600 selection:text-white">
        <AuthProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}