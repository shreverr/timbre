import { SIPTransport } from "@livekit/protocol";
import { SipClient } from "livekit-server-sdk";
import { env } from "../../env";
import type {
  ProviderCredentials,
  TelephonyDriver,
  TrunkArgs,
  VerifyResult,
} from "./base";

let sipClient: SipClient | null = null;
function getSipClient(): SipClient {
  if (!sipClient) {
    sipClient = new SipClient(
      env.LIVEKIT_URL,
      env.LIVEKIT_API_KEY,
      env.LIVEKIT_API_SECRET,
    );
  }
  return sipClient;
}

function assertTwilio(creds: ProviderCredentials): asserts creds is ProviderCredentials & {
  type: "twilio";
} {
  if (creds.type !== "twilio") {
    throw new Error(`TwilioDriver got non-twilio creds: ${creds.type}`);
  }
}

export const TwilioDriver: TelephonyDriver = {
  type: "twilio",

  async verify(creds: ProviderCredentials): Promise<VerifyResult> {
    assertTwilio(creds);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}.json`;
    const auth = Buffer.from(
      `${creds.accountSid}:${creds.authToken}`,
      "utf8",
    ).toString("base64");
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      });
    } catch (err) {
      return {
        ok: false,
        reason: `couldn't reach Twilio: ${err instanceof Error ? err.message : "network error"}`,
      };
    }
    if (res.status === 200) return { ok: true };
    if (res.status === 401) {
      return { ok: false, reason: "invalid Twilio credentials" };
    }
    return { ok: false, reason: `Twilio responded with ${res.status}` };
  },

  async createOutboundTrunk(args: TrunkArgs): Promise<{ trunkId: string }> {
    assertTwilio(args.creds);
    const client = getSipClient();
    const trunk = await client.createSipOutboundTrunk(
      args.name,
      args.creds.terminationUri,
      args.numbers,
      {
        transport: SIPTransport.SIP_TRANSPORT_TLS,
        authUsername: args.creds.sipUsername,
        authPassword: args.creds.sipPassword,
      },
    );
    return { trunkId: trunk.sipTrunkId };
  },

  async createInboundTrunk(args: TrunkArgs): Promise<{ trunkId: string }> {
    assertTwilio(args.creds);
    const client = getSipClient();
    const trunk = await client.createSipInboundTrunk(
      args.name,
      args.numbers,
      {
        authUsername: args.creds.sipUsername,
        authPassword: args.creds.sipPassword,
      },
    );
    return { trunkId: trunk.sipTrunkId };
  },

  setupInstructions(livekitSipUri: string): string[] {
    return [
      "Create an Elastic SIP Trunk in your Twilio console.",
      "In the trunk, create SIP credentials (note the username and password).",
      "Copy the Termination URI Twilio shows (e.g. your-trunk.pstn.twilio.com).",
      `Set the Origination URI to ${livekitSipUri || "sip:<your-livekit-project>.sip.livekit.cloud;transport=tls"}.`,
      "Buy a phone number in Twilio and attach it to the trunk's Origination.",
      "Paste the credentials below.",
    ];
  },
};
