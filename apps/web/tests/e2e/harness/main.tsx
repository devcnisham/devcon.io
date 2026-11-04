import { createRoot } from "react-dom/client";
import { FileWorkspace } from "../../../src/features/files";
createRoot(document.getElementById("root")!).render(
  <FileWorkspace projectId="11111111-1111-4111-8111-111111111111" />
);
