export type Relationship =
  | "Spouse"
  | "Parent"
  | "Sibling"
  | "Child"
  | "Friend"
  | "Guardian"
  | "Other";

export interface Emergency {
  name: string;
  relationshipType: Relationship | null;
  contact: string;
  address: string;
}

export interface Intermediary {
  id: string;
  code: string;
  displayName: string;
  channel: "Broker" | "Bancassurance" | "Agency";
  licence: string;
  email: string;
  mobile: string;
  businessAddress: string;
  emergency: Emergency | null;
  status: "Active" | "Draft";
}

export const RELATIONSHIP_UI: Exclude<Relationship, "Guardian">[] = [
  "Spouse",
  "Parent",
  "Sibling",
  "Child",
  "Friend",
  "Other",
];

export const RELATIONSHIP_SPEC: Relationship[] = [
  "Spouse",
  "Parent",
  "Sibling",
  "Child",
  "Friend",
  "Guardian",
  "Other",
];

const g = globalThis as unknown as { __qfxStore?: Map<string, Intermediary> };

function seed(): Map<string, Intermediary> {
  const map = new Map<string, Intermediary>();
  map.set("IM-1001", {
    id: "IM-1001",
    code: "IM-1001",
    displayName: "Lanka Brokerage (Pvt) Ltd",
    channel: "Broker",
    licence: "BRK-88921",
    email: "ops@lankabroker.example",
    mobile: "+94771234001",
    businessAddress: "12 Galle Road, Colombo 03",
    emergency: {
      name: "Nirmala Perera",
      relationshipType: null,
      contact: "0771234002",
      address: "12 Galle Road, Colombo 03",
    },
    status: "Active",
  });
  map.set("IM-1002", {
    id: "IM-1002",
    code: "IM-1002",
    displayName: "Southern Agency",
    channel: "Agency",
    licence: "AG-4410",
    email: "south@agency.example",
    mobile: "+94718822110",
    businessAddress: "Matara",
    emergency: null,
    status: "Active",
  });
  return map;
}

export function store(): Map<string, Intermediary> {
  if (!g.__qfxStore) g.__qfxStore = seed();
  return g.__qfxStore;
}

export function listIntermediaries(q?: string): Intermediary[] {
  const all = [...store().values()];
  if (!q) return all;
  const needle = q.toLowerCase();
  return all.filter(
    (i) =>
      i.displayName.toLowerCase().includes(needle) ||
      i.code.toLowerCase().includes(needle),
  );
}

export function getIntermediary(id: string): Intermediary | undefined {
  return store().get(id);
}

export function upsertIntermediary(item: Intermediary): Intermediary {
  store().set(item.id, item);
  return item;
}
