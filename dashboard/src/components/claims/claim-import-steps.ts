import { afterKind, type ImportStep } from "@/components/input/import-shell";

// Kept out of the client-only flow so server components (the Input Data page) get the array, not a client reference.
export const CLAIM_IMPORT_STEPS: ImportStep[] = afterKind([
  { id: 1, label: "Unggah" },
  { id: 2, label: "Ringkasan" },
]);
