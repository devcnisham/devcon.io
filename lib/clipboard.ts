/**
 * Copy text, and report whether the clipboard actually took it.
 *
 * `writeText` rejects when the document isn't focused, on a non-secure origin,
 * or when permission is denied. Two things go wrong if that isn't handled: the
 * rejection is unhandled and crashes the dev overlay, and — worse — the caller
 * carries on as if the copy worked. In Prompts that corrupted `prompt_copied`,
 * which is the single signal the telemetry exists to produce.
 *
 * Returns false rather than throwing, so the caller decides what a failed copy
 * means. Nothing here should ever record a success it didn't get.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older/blocked path: a hidden textarea still works when the async
    // clipboard API refuses.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
