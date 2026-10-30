import { redirect } from "next/navigation";
/** Now an internal skill of the agent and brainstorm — the old page sends people to the dashboard. */
export default function Page() { redirect("/dashboard"); }
