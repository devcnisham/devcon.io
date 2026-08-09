import { Empty, Shell } from "./shell";

/**
 * Empty home. The only other destination is the work page.
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
