// Feature barrel — import from here when consuming the claims feature
export { default as ClaimSubmit } from "./pages/ClaimSubmit";
export { claimService } from "./services/claimService";
export { useClaimData } from "./hooks/useClaimData";
export { useClaimUpload } from "./hooks/useClaimUpload";
export { ClaimUploadDialog } from "./components/ClaimUploadDialog";
export { SubrogationDialog } from "./components/SubrogationDialog";
export { ClaimTrendTab } from "./components/ClaimTrendTab";
