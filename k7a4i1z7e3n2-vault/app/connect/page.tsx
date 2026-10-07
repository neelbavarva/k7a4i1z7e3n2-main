import type { Metadata } from "next";
import ConnectWindow from "../../components/ConnectWindow";

// The small window that connects a wallet extension when the vault is inside the split view's
// frame (see connectInWindow in lib/wallets.js). No lock: it never calls the API or shows anything
// stored, and only hands public addresses back to the vault page that opened it.

export const metadata: Metadata = {
    title: "Connect a wallet · k7a4i1z7e3n2",
};

export default function Page() {
    return <ConnectWindow />;
}
