export type AgentType = "SINGLE" | "MULTI";

export type Agent = {
  id: string;
  userId: string;
  name: string;
  type: AgentType;
  voiceId: string | null;
  language: string;
  firstMessage: string | null;
  objective: string | null;
  responseGuidelines: string | null;
  conversationScript: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VoiceGender = "masculine" | "feminine" | "gender_neutral";

export type Voice = {
  id: string;
  name: string;
  description: string;
  gender: VoiceGender | null;
  language: string;
  is_owner: boolean;
  is_public: boolean;
  created_at: string;
};

export type VoiceListResponse = {
  data: Voice[];
  has_more: boolean;
  next_page: string | null;
};

export type ProviderType = "twilio";

export type TelephonyProvider = {
  id: string;
  userId: string;
  type: ProviderType;
  label: string;
  livekitOutboundTrunkId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PhoneNumber = {
  id: string;
  userId: string;
  providerId: string;
  agentId: string | null;
  e164: string;
  livekitInboundTrunkId: string | null;
  dispatchRuleId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type McpTransport = "auto" | "http" | "sse";

export type McpServer = {
  id: string;
  userId: string;
  agentId: string;
  label: string;
  url: string;
  transport: McpTransport;
  hasHeaders: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ToolPhase = "PRE" | "ON" | "POST";
export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type AgentTool = {
  id: string;
  userId: string;
  agentId: string;
  phase: ToolPhase;
  name: string;
  description: string;
  method: HttpMethod;
  url: string;
  hasHeaders: boolean;
  bodyTemplate: string | null;
  parameters: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmbedButtonShape = "circle" | "pill";
export type EmbedPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export type EmbedConfig = {
  id: string;
  agentId: string;
  publicKey: string;
  allowedOrigins: string[];
  enabled: boolean;
  buttonLabel: string | null;
  buttonShape: EmbedButtonShape;
  buttonIconSvg: string | null;
  accentColor: string;
  position: EmbedPosition;
  greetingText: string | null;
  maxConcurrent: number;
  dailyCallQuota: number;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeBase = {
  id: string;
  userId: string;
  name: string;
  toolDescription: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KbDocumentStatus = "processing" | "ready" | "failed";

export type KbDocument = {
  id: string;
  userId: string;
  knowledgeBaseId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: KbDocumentStatus;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CallMode = "test" | "embed" | "demo" | "phone" | "outbound" | string;

export type CallLogSummary = {
  id: string;
  agentId: string;
  mode: CallMode;
  room: string;
  callerIdentity: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  messageCount: number;
  createdAt: string;
};

export type CallTranscriptItem = {
  role: "user" | "agent";
  text: string;
  ts?: number;
};

export type CallLog = {
  id: string;
  agentId: string;
  mode: CallMode;
  room: string;
  callerIdentity: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  transcript: CallTranscriptItem[];
  createdAt: string;
};

export type EmbedTheme = {
  agentName: string;
  enabled: boolean;
  buttonLabel: string | null;
  buttonShape: EmbedButtonShape;
  buttonIconSvg: string | null;
  accentColor: string;
  position: EmbedPosition;
  greetingText: string | null;
};
