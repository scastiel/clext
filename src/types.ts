export enum DiffMode {
  Working = "working",
  LastCommit = "lastCommit",
  Branch = "branch",
}

export const DIFF_MODE_LABELS: Record<DiffMode, string> = {
  [DiffMode.Working]: "Working Changes",
  [DiffMode.LastCommit]: "Last Commit",
  [DiffMode.Branch]: "vs Main",
};
