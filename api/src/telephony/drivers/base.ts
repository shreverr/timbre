export type ProviderType = "twilio";

export type TwilioCredentials = {
  accountSid: string;
  authToken: string;
  sipUsername: string;
  sipPassword: string;
  terminationUri: string;
};

export type ProviderCredentials = { type: "twilio" } & TwilioCredentials;

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export type TrunkArgs = {
  name: string;
  creds: ProviderCredentials;
  numbers: string[];
};

export interface TelephonyDriver {
  readonly type: ProviderType;
  verify(creds: ProviderCredentials): Promise<VerifyResult>;
  createOutboundTrunk(args: TrunkArgs): Promise<{ trunkId: string }>;
  createInboundTrunk(args: TrunkArgs): Promise<{ trunkId: string }>;
  setupInstructions(livekitSipUri: string): string[];
}
