import { redirect } from "next/navigation";

/**
 * `/work` is not a view of its own — it is the page that holds two.
 * Landing here means "open the work page", so send them to the default view
 * rather than rendering a third, emptier thing.
 */
export default function Work() {
  redirect("/work/workspace");
}
