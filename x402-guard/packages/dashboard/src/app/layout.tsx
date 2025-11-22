import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "x402-Guard Dashboard",
  description: "Budget controls for x402 payments",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-900 text-white">
        <nav className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <span className="text-2xl mr-2">🛡️</span>
                <span className="font-bold text-xl">x402-Guard</span>
              </div>
              <div className="flex items-center space-x-4">
                {/* Wallet connect button would go here */}
                <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium">
                  Connect Wallet
                </button>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
