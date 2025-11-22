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
      <body 
        className="min-h-screen"
        style={{ 
          backgroundColor: '#0A0B0D', 
          color: '#FFFFFF',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale'
        } as React.CSSProperties}
      >
        <nav 
          style={{ 
            backgroundColor: '#131416', 
            borderBottom: '1px solid #252830' 
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: '#0052FF' }}
                >
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
                <span className="font-semibold text-lg tracking-tight">x402-Guard</span>
              </div>
              <div className="flex items-center space-x-4">
                <button 
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: '#0052FF', color: 'white' }}
                >
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