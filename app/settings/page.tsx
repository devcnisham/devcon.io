import { redirect } from "next/navigation";

/** Settings became the console. A redirect rather than a 404 — the old path
 *  may be open in a tab or a bookmark. */
export default function Settings() {
  redirect("/console");
}
