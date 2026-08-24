export type SfSlot = "source" | "target";

export type SfLoginHost = "login" | "test";

export type SfSessionPayload = {
  instanceUrl: string;
  sessionId: string;
  username?: string;
  userId?: string;
  orgId?: string;
  loginHost: SfLoginHost;
  connectedAt: number;
};

export type SfOrgSummary = {
  slot: SfSlot;
  instanceUrl: string;
  username?: string;
  userId?: string;
  orgId?: string;
  loginHost: SfLoginHost;
  connectedAt: number;
};

export type SfSObjectSummary = {
  name: string;
  label: string;
  queryable: boolean;
  createable: boolean;
  custom: boolean;
};

export type SfQueryResult = {
  totalSize: number;
  done: boolean;
  records: Record<string, unknown>[];
};

export const SF_API_VERSION = "62.0";

export const SF_COOKIE_NAMES: Record<SfSlot, string> = {
  source: "sf_source",
  target: "sf_target",
};

export const SF_SESSION_MAX_AGE_SEC = 2 * 60 * 60;
