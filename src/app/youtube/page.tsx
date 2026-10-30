import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { YtIntelPage } from "@/components/YtIntel";
export const metadata = { title: "YouTube Intelligence" };
export default function Page() { return <AppShell><Suspense><YtIntelPage /></Suspense></AppShell>; }
