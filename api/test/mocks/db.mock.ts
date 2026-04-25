/**
 * In-memory Drizzle-compatible stub supporting the three tables our routes
 * touch: agents, phoneNumbers, telephonyProviders. Each drizzle operation
 * (.from/.insert/.update/.delete) is dispatched to the right store by
 * identity-matching the table object.
 */

import {
  agentKnowledgeBases,
  agentTools,
  agents,
  callLogs,
  embedCalls,
  embedConfigs,
  kbChunks,
  kbDocuments,
  knowledgeBases,
  mcpServers,
  phoneNumbers,
  telephonyProviders,
} from "../../src/db/schema";

export type FakeAgent = {
  id: string;
  userId: string;
  name: string;
  type: "SINGLE" | "MULTI";
  voiceId: string | null;
  language: string;
  firstMessage: string | null;
  objective: string | null;
  responseGuidelines: string | null;
  conversationScript: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FakeProvider = {
  id: string;
  userId: string;
  type: "twilio";
  label: string;
  credentials: string;
  livekitOutboundTrunkId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FakeNumber = {
  id: string;
  userId: string;
  providerId: string;
  agentId: string | null;
  e164: string;
  livekitInboundTrunkId: string | null;
  dispatchRuleId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FakeMcpServer = {
  id: string;
  userId: string;
  agentId: string;
  label: string;
  url: string;
  transport: string;
  headers: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type FakeAgentTool = {
  id: string;
  userId: string;
  agentId: string;
  phase: "PRE" | "ON" | "POST";
  name: string;
  description: string;
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  url: string;
  headers: string | null;
  bodyTemplate: string | null;
  parameters: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type FakeEmbedConfig = {
  id: string;
  userId: string;
  agentId: string;
  publicKey: string;
  allowedOrigins: string;
  enabled: boolean;
  buttonLabel: string | null;
  buttonShape: string;
  buttonIconSvg: string | null;
  accentColor: string;
  position: string;
  greetingText: string | null;
  maxConcurrent: number;
  dailyCallQuota: number;
  createdAt: Date;
  updatedAt: Date;
};

export type FakeEmbedCall = {
  id: string;
  publicKey: string;
  agentId: string;
  room: string;
  startedAt: Date;
  endedAt: Date | null;
};

export type FakeCallLog = {
  id: string;
  userId: string;
  agentId: string;
  mode: string;
  room: string;
  callerIdentity: string | null;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  transcript: string;
  createdAt: Date;
};

export type FakeKnowledgeBase = {
  id: string;
  userId: string;
  name: string;
  toolDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FakeAgentKnowledgeBase = {
  agentId: string;
  knowledgeBaseId: string;
  createdAt: Date;
};

export type FakeKbDocument = {
  id: string;
  userId: string;
  knowledgeBaseId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: "processing" | "ready" | "failed";
  errorMessage: string | null;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type FakeKbChunk = {
  id: string;
  documentId: string;
  knowledgeBaseId: string;
  text: string;
  position: number;
  embedding: number[];
  createdAt: Date;
};

const agentStore: FakeAgent[] = [];
const providerStore: FakeProvider[] = [];
const numberStore: FakeNumber[] = [];
const mcpServerStore: FakeMcpServer[] = [];
const agentToolStore: FakeAgentTool[] = [];
const embedConfigStore: FakeEmbedConfig[] = [];
const embedCallStore: FakeEmbedCall[] = [];
const callLogStore: FakeCallLog[] = [];
const knowledgeBaseStore: FakeKnowledgeBase[] = [];
const agentKbStore: FakeAgentKnowledgeBase[] = [];
const kbDocumentStore: FakeKbDocument[] = [];
const kbChunkStore: FakeKbChunk[] = [];

export function resetFakeDb() {
  agentStore.length = 0;
  providerStore.length = 0;
  numberStore.length = 0;
  mcpServerStore.length = 0;
  agentToolStore.length = 0;
  embedConfigStore.length = 0;
  embedCallStore.length = 0;
  callLogStore.length = 0;
  knowledgeBaseStore.length = 0;
  agentKbStore.length = 0;
  kbDocumentStore.length = 0;
  kbChunkStore.length = 0;
}

export function getStore(): ReadonlyArray<FakeAgent> {
  return agentStore;
}
export function getProviderStore(): ReadonlyArray<FakeProvider> {
  return providerStore;
}
export function getNumberStore(): ReadonlyArray<FakeNumber> {
  return numberStore;
}
export function getMcpServerStore(): ReadonlyArray<FakeMcpServer> {
  return mcpServerStore;
}
export function getAgentToolStore(): ReadonlyArray<FakeAgentTool> {
  return agentToolStore;
}
export function getEmbedConfigStore(): ReadonlyArray<FakeEmbedConfig> {
  return embedConfigStore;
}
export function getEmbedCallStore(): ReadonlyArray<FakeEmbedCall> {
  return embedCallStore;
}
export function getCallLogStore(): ReadonlyArray<FakeCallLog> {
  return callLogStore;
}

export function getKnowledgeBaseStore(): ReadonlyArray<FakeKnowledgeBase> {
  return knowledgeBaseStore;
}
export function getAgentKbStore(): ReadonlyArray<FakeAgentKnowledgeBase> {
  return agentKbStore;
}
export function getKbDocumentStore(): ReadonlyArray<FakeKbDocument> {
  return kbDocumentStore;
}
export function getKbChunkStore(): ReadonlyArray<FakeKbChunk> {
  return kbChunkStore;
}

export function seedKnowledgeBase(
  partial: Partial<FakeKnowledgeBase> & { userId: string },
): FakeKnowledgeBase {
  const now = new Date();
  const row: FakeKnowledgeBase = {
    id: partial.id ?? crypto.randomUUID(),
    userId: partial.userId,
    name: partial.name ?? "Library",
    toolDescription: partial.toolDescription ?? null,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
  knowledgeBaseStore.push(row);
  return row;
}

export function seedAgentKb(
  partial: Partial<FakeAgentKnowledgeBase> & {
    agentId: string;
    knowledgeBaseId: string;
  },
): FakeAgentKnowledgeBase {
  const row: FakeAgentKnowledgeBase = {
    agentId: partial.agentId,
    knowledgeBaseId: partial.knowledgeBaseId,
    createdAt: partial.createdAt ?? new Date(),
  };
  agentKbStore.push(row);
  return row;
}

export function seedKbDocument(
  partial: Partial<FakeKbDocument> & {
    userId: string;
    knowledgeBaseId: string;
  },
): FakeKbDocument {
  const now = new Date();
  const row: FakeKbDocument = {
    id: partial.id ?? crypto.randomUUID(),
    userId: partial.userId,
    knowledgeBaseId: partial.knowledgeBaseId,
    name: partial.name ?? "doc.txt",
    mimeType: partial.mimeType ?? "text/plain",
    sizeBytes: partial.sizeBytes ?? 100,
    status: partial.status ?? "ready",
    errorMessage: partial.errorMessage ?? null,
    chunkCount: partial.chunkCount ?? 0,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
  kbDocumentStore.push(row);
  return row;
}

export function seedCallLog(
  partial: Partial<FakeCallLog> & { userId: string; agentId: string },
): FakeCallLog {
  const now = new Date();
  const row: FakeCallLog = {
    id: partial.id ?? crypto.randomUUID(),
    userId: partial.userId,
    agentId: partial.agentId,
    mode: partial.mode ?? "test",
    room: partial.room ?? `room-${crypto.randomUUID().slice(0, 6)}`,
    callerIdentity: partial.callerIdentity ?? null,
    startedAt: partial.startedAt ?? now,
    endedAt: partial.endedAt ?? now,
    durationSeconds: partial.durationSeconds ?? 0,
    transcript:
      partial.transcript ??
      JSON.stringify([
        { role: "user", text: "hello" },
        { role: "agent", text: "hi there" },
      ]),
    createdAt: partial.createdAt ?? now,
  };
  callLogStore.push(row);
  return row;
}

export function seedEmbedConfig(
  partial: Partial<FakeEmbedConfig> & { userId: string; agentId: string },
): FakeEmbedConfig {
  const now = new Date();
  const row: FakeEmbedConfig = {
    id: partial.id ?? crypto.randomUUID(),
    userId: partial.userId,
    agentId: partial.agentId,
    publicKey: partial.publicKey ?? `pk_${crypto.randomUUID().replace(/-/g, "")}`,
    allowedOrigins: partial.allowedOrigins ?? JSON.stringify(["http://localhost:8000"]),
    enabled: partial.enabled ?? true,
    buttonLabel: partial.buttonLabel ?? null,
    buttonShape: partial.buttonShape ?? "circle",
    buttonIconSvg: partial.buttonIconSvg ?? null,
    accentColor: partial.accentColor ?? "#f59e0b",
    position: partial.position ?? "bottom-right",
    greetingText: partial.greetingText ?? null,
    maxConcurrent: partial.maxConcurrent ?? 5,
    dailyCallQuota: partial.dailyCallQuota ?? 200,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
  embedConfigStore.push(row);
  return row;
}

export function seedEmbedCall(
  partial: Partial<FakeEmbedCall> & { publicKey: string; agentId: string; room: string },
): FakeEmbedCall {
  const now = new Date();
  const row: FakeEmbedCall = {
    id: partial.id ?? crypto.randomUUID(),
    publicKey: partial.publicKey,
    agentId: partial.agentId,
    room: partial.room,
    startedAt: partial.startedAt ?? now,
    endedAt: partial.endedAt ?? null,
  };
  embedCallStore.push(row);
  return row;
}

export function seedMcpServer(
  partial: Partial<FakeMcpServer> & { userId: string; agentId: string },
): FakeMcpServer {
  const now = new Date();
  const row: FakeMcpServer = {
    id: partial.id ?? crypto.randomUUID(),
    userId: partial.userId,
    agentId: partial.agentId,
    label: partial.label ?? "MCP",
    url: partial.url ?? "https://mcp.example.com/sse",
    transport: partial.transport ?? "auto",
    headers: partial.headers ?? null,
    enabled: partial.enabled ?? true,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
  mcpServerStore.push(row);
  return row;
}

export function seedAgentTool(
  partial: Partial<FakeAgentTool> & { userId: string; agentId: string; phase: FakeAgentTool["phase"] },
): FakeAgentTool {
  const now = new Date();
  const row: FakeAgentTool = {
    id: partial.id ?? crypto.randomUUID(),
    userId: partial.userId,
    agentId: partial.agentId,
    phase: partial.phase,
    name: partial.name ?? "tool",
    description: partial.description ?? "desc",
    method: partial.method ?? "GET",
    url: partial.url ?? "https://api.example.com",
    headers: partial.headers ?? null,
    bodyTemplate: partial.bodyTemplate ?? null,
    parameters: partial.parameters ?? null,
    enabled: partial.enabled ?? true,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
  agentToolStore.push(row);
  return row;
}

export function seedAgent(
  partial: Partial<FakeAgent> & { userId: string },
): FakeAgent {
  const now = new Date();
  const row: FakeAgent = {
    id: partial.id ?? crypto.randomUUID(),
    userId: partial.userId,
    name: partial.name ?? "Test agent",
    type: partial.type ?? "SINGLE",
    voiceId: partial.voiceId ?? null,
    language: partial.language ?? "multi",
    firstMessage: partial.firstMessage ?? null,
    objective: partial.objective ?? null,
    responseGuidelines: partial.responseGuidelines ?? null,
    conversationScript: partial.conversationScript ?? null,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
  agentStore.push(row);
  return row;
}

export function seedProvider(
  partial: Partial<FakeProvider> & { userId: string },
): FakeProvider {
  const now = new Date();
  const row: FakeProvider = {
    id: partial.id ?? crypto.randomUUID(),
    userId: partial.userId,
    type: partial.type ?? "twilio",
    label: partial.label ?? "Twilio",
    credentials: partial.credentials ?? "encrypted-blob",
    livekitOutboundTrunkId: partial.livekitOutboundTrunkId ?? "trunk-out-seed",
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
  providerStore.push(row);
  return row;
}

export function seedNumber(
  partial: Partial<FakeNumber> & {
    userId: string;
    providerId: string;
    e164: string;
  },
): FakeNumber {
  const now = new Date();
  const row: FakeNumber = {
    id: partial.id ?? crypto.randomUUID(),
    userId: partial.userId,
    providerId: partial.providerId,
    agentId: partial.agentId ?? null,
    e164: partial.e164,
    livekitInboundTrunkId: partial.livekitInboundTrunkId ?? null,
    dispatchRuleId: partial.dispatchRuleId ?? null,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
  numberStore.push(row);
  return row;
}

type AnyRow =
  | FakeAgent
  | FakeProvider
  | FakeNumber
  | FakeMcpServer
  | FakeAgentTool
  | FakeEmbedConfig
  | FakeEmbedCall
  | FakeCallLog
  | FakeKnowledgeBase
  | FakeAgentKnowledgeBase
  | FakeKbDocument
  | FakeKbChunk;

function storeFor(table: unknown): AnyRow[] {
  if (table === agents) return agentStore as AnyRow[];
  if (table === phoneNumbers) return numberStore as AnyRow[];
  if (table === telephonyProviders) return providerStore as AnyRow[];
  if (table === mcpServers) return mcpServerStore as AnyRow[];
  if (table === agentTools) return agentToolStore as AnyRow[];
  if (table === embedConfigs) return embedConfigStore as AnyRow[];
  if (table === embedCalls) return embedCallStore as AnyRow[];
  if (table === callLogs) return callLogStore as AnyRow[];
  if (table === knowledgeBases) return knowledgeBaseStore as AnyRow[];
  if (table === agentKnowledgeBases) return agentKbStore as AnyRow[];
  if (table === kbDocuments) return kbDocumentStore as AnyRow[];
  if (table === kbChunks) return kbChunkStore as AnyRow[];
  throw new Error("unknown table in fake db");
}

type Predicate = (row: AnyRow) => boolean;

function evalCondition(cond: any): Predicate {
  if (!cond) return () => true;
  if (cond.__op === "and") {
    const preds = cond.args.map(evalCondition);
    return (row) => preds.every((p: Predicate) => p(row));
  }
  if (cond.__op === "or") {
    const preds = cond.args.map(evalCondition);
    return (row) => preds.some((p: Predicate) => p(row));
  }
  if (cond.__op === "eq") {
    const [col, val] = cond.args;
    return (row) => (row as any)[col.__col] === val;
  }
  if (cond.__op === "gte") {
    const [col, val] = cond.args;
    return (row) => {
      const cur = (row as any)[col.__col];
      if (cur instanceof Date && val instanceof Date) {
        return cur.getTime() >= val.getTime();
      }
      return cur >= val;
    };
  }
  if (cond.__op === "isNull") {
    const [col] = cond.args;
    return (row) => (row as any)[col.__col] == null;
  }
  return () => false;
}

type OrderSpec = { column: string; desc: boolean };

function evalOrder(expr: any): OrderSpec | null {
  if (!expr) return null;
  if (expr.__op === "desc") {
    return { column: expr.args[0].__col, desc: true };
  }
  if (expr.__col) return { column: expr.__col, desc: false };
  return null;
}

function sortBy<T extends AnyRow>(rows: T[], spec: OrderSpec | null): T[] {
  if (!spec) return rows;
  const sign = spec.desc ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const av = (a as any)[spec.column];
    const bv = (b as any)[spec.column];
    if (av < bv) return -sign;
    if (av > bv) return sign;
    return 0;
  });
}

function clone<T extends AnyRow>(row: T): T {
  return { ...row };
}

function materialize<T extends AnyRow>(
  store: T[],
  values: Partial<T>,
): T {
  const now = new Date();
  if (store === (agentStore as unknown as T[])) {
    const v = values as Partial<FakeAgent>;
    const row: FakeAgent = {
      id: v.id ?? crypto.randomUUID(),
      userId: v.userId!,
      name: v.name ?? "",
      type: v.type ?? "SINGLE",
      voiceId: v.voiceId ?? null,
      language: v.language ?? "multi",
      firstMessage: v.firstMessage ?? null,
      objective: v.objective ?? null,
      responseGuidelines: v.responseGuidelines ?? null,
      conversationScript: v.conversationScript ?? null,
      createdAt: v.createdAt ?? now,
      updatedAt: v.updatedAt ?? now,
    };
    return row as T;
  }
  if (store === (providerStore as unknown as T[])) {
    const v = values as Partial<FakeProvider>;
    const row: FakeProvider = {
      id: v.id ?? crypto.randomUUID(),
      userId: v.userId!,
      type: v.type ?? "twilio",
      label: v.label ?? "",
      credentials: v.credentials ?? "",
      livekitOutboundTrunkId: v.livekitOutboundTrunkId ?? null,
      createdAt: v.createdAt ?? now,
      updatedAt: v.updatedAt ?? now,
    };
    return row as T;
  }
  if (store === (numberStore as unknown as T[])) {
    const v = values as Partial<FakeNumber>;
    const row: FakeNumber = {
      id: v.id ?? crypto.randomUUID(),
      userId: v.userId!,
      providerId: v.providerId!,
      agentId: v.agentId ?? null,
      e164: v.e164 ?? "",
      livekitInboundTrunkId: v.livekitInboundTrunkId ?? null,
      dispatchRuleId: v.dispatchRuleId ?? null,
      createdAt: v.createdAt ?? now,
      updatedAt: v.updatedAt ?? now,
    };
    return row as T;
  }
  if (store === (mcpServerStore as unknown as T[])) {
    const v = values as Partial<FakeMcpServer>;
    const row: FakeMcpServer = {
      id: v.id ?? crypto.randomUUID(),
      userId: v.userId!,
      agentId: v.agentId!,
      label: v.label ?? "",
      url: v.url ?? "",
      transport: v.transport ?? "auto",
      headers: v.headers ?? null,
      enabled: v.enabled ?? true,
      createdAt: v.createdAt ?? now,
      updatedAt: v.updatedAt ?? now,
    };
    return row as T;
  }
  if (store === (agentToolStore as unknown as T[])) {
    const v = values as Partial<FakeAgentTool>;
    const row: FakeAgentTool = {
      id: v.id ?? crypto.randomUUID(),
      userId: v.userId!,
      agentId: v.agentId!,
      phase: v.phase ?? "ON",
      name: v.name ?? "",
      description: v.description ?? "",
      method: v.method ?? "GET",
      url: v.url ?? "",
      headers: v.headers ?? null,
      bodyTemplate: v.bodyTemplate ?? null,
      parameters: v.parameters ?? null,
      enabled: v.enabled ?? true,
      createdAt: v.createdAt ?? now,
      updatedAt: v.updatedAt ?? now,
    };
    return row as T;
  }
  if (store === (embedConfigStore as unknown as T[])) {
    const v = values as Partial<FakeEmbedConfig>;
    const row: FakeEmbedConfig = {
      id: v.id ?? crypto.randomUUID(),
      userId: v.userId!,
      agentId: v.agentId!,
      publicKey: v.publicKey ?? `pk_${crypto.randomUUID().replace(/-/g, "")}`,
      allowedOrigins: v.allowedOrigins ?? "[]",
      enabled: v.enabled ?? true,
      buttonLabel: v.buttonLabel ?? null,
      buttonShape: v.buttonShape ?? "circle",
      buttonIconSvg: v.buttonIconSvg ?? null,
      accentColor: v.accentColor ?? "#f59e0b",
      position: v.position ?? "bottom-right",
      greetingText: v.greetingText ?? null,
      maxConcurrent: v.maxConcurrent ?? 5,
      dailyCallQuota: v.dailyCallQuota ?? 200,
      createdAt: v.createdAt ?? now,
      updatedAt: v.updatedAt ?? now,
    };
    return row as T;
  }
  if (store === (embedCallStore as unknown as T[])) {
    const v = values as Partial<FakeEmbedCall>;
    const row: FakeEmbedCall = {
      id: v.id ?? crypto.randomUUID(),
      publicKey: v.publicKey!,
      agentId: v.agentId!,
      room: v.room ?? "",
      startedAt: v.startedAt ?? now,
      endedAt: v.endedAt ?? null,
    };
    return row as T;
  }
  if (store === (knowledgeBaseStore as unknown as T[])) {
    const v = values as Partial<FakeKnowledgeBase>;
    const row: FakeKnowledgeBase = {
      id: v.id ?? crypto.randomUUID(),
      userId: v.userId!,
      name: v.name ?? "",
      toolDescription: v.toolDescription ?? null,
      createdAt: v.createdAt ?? now,
      updatedAt: v.updatedAt ?? now,
    };
    return row as T;
  }
  if (store === (agentKbStore as unknown as T[])) {
    const v = values as Partial<FakeAgentKnowledgeBase>;
    const row: FakeAgentKnowledgeBase = {
      agentId: v.agentId!,
      knowledgeBaseId: v.knowledgeBaseId!,
      createdAt: v.createdAt ?? now,
    };
    return row as T;
  }
  if (store === (kbDocumentStore as unknown as T[])) {
    const v = values as Partial<FakeKbDocument>;
    const row: FakeKbDocument = {
      id: v.id ?? crypto.randomUUID(),
      userId: v.userId!,
      knowledgeBaseId: v.knowledgeBaseId!,
      name: v.name ?? "",
      mimeType: v.mimeType ?? "text/plain",
      sizeBytes: v.sizeBytes ?? 0,
      status: v.status ?? "processing",
      errorMessage: v.errorMessage ?? null,
      chunkCount: v.chunkCount ?? 0,
      createdAt: v.createdAt ?? now,
      updatedAt: v.updatedAt ?? now,
    };
    return row as T;
  }
  if (store === (kbChunkStore as unknown as T[])) {
    const v = values as Partial<FakeKbChunk>;
    const row: FakeKbChunk = {
      id: v.id ?? crypto.randomUUID(),
      documentId: v.documentId!,
      knowledgeBaseId: v.knowledgeBaseId!,
      text: v.text ?? "",
      position: v.position ?? 0,
      embedding: v.embedding ?? [],
      createdAt: v.createdAt ?? now,
    };
    return row as T;
  }
  if (store === (callLogStore as unknown as T[])) {
    const v = values as Partial<FakeCallLog>;
    const row: FakeCallLog = {
      id: v.id ?? crypto.randomUUID(),
      userId: v.userId!,
      agentId: v.agentId!,
      mode: v.mode ?? "test",
      room: v.room ?? "",
      callerIdentity: v.callerIdentity ?? null,
      startedAt: v.startedAt ?? now,
      endedAt: v.endedAt ?? now,
      durationSeconds: v.durationSeconds ?? 0,
      transcript: v.transcript ?? "[]",
      createdAt: v.createdAt ?? now,
    };
    return row as T;
  }
  throw new Error("unknown store in materialize");
}

export function makeFakeDb() {
  function selectBuilder() {
    let store: AnyRow[] | null = null;
    let condition: any = null;
    let order: OrderSpec | null = null;

    const api: any = {
      from(table: unknown) {
        store = storeFor(table);
        return api;
      },
      where(cond: any) {
        condition = cond;
        return api;
      },
      orderBy(expr: any) {
        order = evalOrder(expr);
        return api;
      },
      then(onFulfilled: (rows: AnyRow[]) => any, onRejected?: any) {
        const pred = evalCondition(condition);
        const matched = (store ?? []).filter(pred).map(clone);
        const sorted = sortBy(matched, order);
        return Promise.resolve(sorted).then(onFulfilled, onRejected);
      },
    };
    return api;
  }

  function insertBuilder(table: unknown) {
    const store = storeFor(table);
    let values: Partial<AnyRow> | Partial<AnyRow>[] | null = null;
    function applyInsert(): AnyRow[] {
      if (values == null) return [];
      const list = Array.isArray(values) ? values : [values];
      const inserted: AnyRow[] = [];
      for (const v of list) {
        const row = materialize(store, v);
        store.push(row);
        inserted.push(row);
      }
      return inserted;
    }
    const api: any = {
      values(v: Partial<AnyRow> | Partial<AnyRow>[]) {
        values = v;
        return api;
      },
      returning() {
        const inserted = applyInsert();
        return Promise.resolve(inserted.map(clone));
      },
      then(onFulfilled: (rows: AnyRow[]) => any, onRejected?: any) {
        applyInsert();
        return Promise.resolve([]).then(onFulfilled, onRejected);
      },
    };
    return api;
  }

  function updateBuilder(table: unknown) {
    const store = storeFor(table);
    let patch: Partial<AnyRow> | null = null;
    let condition: any = null;
    const api: any = {
      set(p: Partial<AnyRow>) {
        patch = p;
        return api;
      },
      where(cond: any) {
        condition = cond;
        return api;
      },
      returning() {
        const pred = evalCondition(condition);
        const target = store.find(pred);
        if (!target) return Promise.resolve([]);
        Object.assign(target, patch ?? {});
        return Promise.resolve([clone(target)]);
      },
      then(onFulfilled: (rows: AnyRow[]) => any, onRejected?: any) {
        const pred = evalCondition(condition);
        const target = store.find(pred);
        if (target) Object.assign(target, patch ?? {});
        return Promise.resolve([]).then(onFulfilled, onRejected);
      },
    };
    return api;
  }

  function deleteBuilder(table: unknown) {
    const store = storeFor(table);
    let condition: any = null;
    function applyDelete(): AnyRow[] {
      const pred = evalCondition(condition);
      const removed: AnyRow[] = [];
      let i = 0;
      while (i < store.length) {
        if (pred(store[i]!)) {
          removed.push(store.splice(i, 1)[0]!);
        } else {
          i++;
        }
      }
      return removed;
    }
    const api: any = {
      where(cond: any) {
        condition = cond;
        return api;
      },
      returning() {
        const removed = applyDelete();
        return Promise.resolve(removed.map(clone));
      },
      then(onFulfilled: (rows: AnyRow[]) => any, onRejected?: any) {
        applyDelete();
        return Promise.resolve([]).then(onFulfilled, onRejected);
      },
    };
    return api;
  }

  return {
    select: (_fields?: any) => selectBuilder(),
    insert: insertBuilder,
    update: updateBuilder,
    delete: deleteBuilder,
  };
}
