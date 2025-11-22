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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-bg-primary text-fg-primary">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 bg-bg-secondary/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-blue-400 flex items-center justify-center shadow-lg shadow-accent/20">
                    <svg 
                      width="18" 
                      height="18" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="white" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                </div>
                <span className="font-semibold text-lg tracking-tight">
                  x402<span className="text-fg-muted">-Guard</span>
                </span>
              </div>
              
              {/* Connect Button */}
              <button className="btn-primary text-sm">
                Connect Wallet
              </button>
            </div>
          </div>
        </nav>
        
        {/* Main Content */}
        <main className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}