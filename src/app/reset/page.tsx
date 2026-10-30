import { Suspense } from "react";
import { ResetForm } from "@/components/AuthForms";
import { PublicNav } from "@/components/PublicSite";
export const metadata = { title: "Reset password" };
export default function Page() { return <><PublicNav /><Suspense><ResetForm /></Suspense></>; }
