"use client";

import { useWeb3 } from "../providers";

export function ConnectButton() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWeb3();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono text-fg-secondary hidden sm:block">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button 
          onClick={disconnect}
          className="btn-secondary text-sm"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={connect}
      disabled={isConnecting}
      className="btn-primary text-sm disabled:opacity-50"
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}