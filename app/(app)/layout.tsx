import type { ReactNode } from "react";
import { TabBar } from "./tab-bar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="app-main">{children}</div>
      <TabBar />
    </>
  );
}
