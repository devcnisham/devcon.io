import { Empty, Shell } from "./shell";

/**
 * Empty home.
 *
 * The spec reader and checker in `lib/ship/` are deliberately not rendered
 * here. They work — they caught a real overclaim on their first run — but a
 * half-built feature on the page argues for itself while the shape is still
 * being decided.
 */
export default function Home() {
  return (
    <Shell here="/">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-6 sm:px-8">
        <Empty label="home" />
      </div>
    </Shell>
  );
}
