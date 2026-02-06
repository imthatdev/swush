export type AdminMetricsDaily = {
  date: string;
  users: number;
  files: number;
  storageBytes: number;
  shortLinks: number;
};

export type AdminMetricsTotals = {
  users: number;
  verifiedUsers: number;
  admins: number;
  owners: number;
  files: number;
  shortLinks: number;
  tags: number;
  folders: number;
  watchlist: number;
};

export type AdminMetrics = {
  totals: AdminMetricsTotals;
  storageBytes: number;
  daily: AdminMetricsDaily[];
};
