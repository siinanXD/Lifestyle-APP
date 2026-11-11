import type { ReactNode } from "react";
import { SyncProvider } from "../sync-provider";
import { TabBar } from "./tab-bar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SyncProvider />
      <div className="app-main">{children}</div>
      <TabBar />
    </>
  );
}
