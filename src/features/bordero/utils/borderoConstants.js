export const BORDERO_PAGE_SIZE = 10;

export const DEFAULT_BORDERO_FILTER = {
    contract: "all",
    batch: "",
    branch_desc: "",
    region_desc: "",
    submitStatus: "all",
    reconStatus: "all",
    claimStatus: "all",
    subrogationStatus: "all",
    startDate: "",
    endDate: "",
    period: "",
};

export const getNextBorderoStatus = (currentStatus) => {
    const workflow = ["GENERATED", "UNDER_REVIEW", "FINAL"];
    const idx = workflow.indexOf(currentStatus);
    return idx >= 0 && idx < workflow.length - 1 ? workflow[idx + 1] : null;
};
