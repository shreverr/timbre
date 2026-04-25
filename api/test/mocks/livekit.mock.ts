/**
 * In-memory stubs for the livekit-server-sdk exports we use.
 */

import { mock } from "bun:test";

type Dispatch = {
  roomName: string;
  agentName: string;
  metadata: string | undefined;
};

type SipOutboundTrunk = {
  id: string;
  name: string;
  address: string;
  numbers: string[];
};

type SipInboundTrunk = {
  id: string;
  name: string;
  numbers: string[];
};

type SipDispatchRule = {
  id: string;
  name?: string;
  rule: unknown;
  trunkIds: string[];
  metadata?: string;
};

type SipParticipant = {
  trunkId: string;
  to: string;
  roomName: string;
  from?: string;
};

const dispatches: Dispatch[] = [];
const outboundTrunks = new Map<string, SipOutboundTrunk>();
const inboundTrunks = new Map<string, SipInboundTrunk>();
const dispatchRules = new Map<string, SipDispatchRule>();
const sipParticipants: SipParticipant[] = [];
const deletedTrunkIds: string[] = [];
const deletedDispatchRuleIds: string[] = [];

let trunkCounter = 0;
let ruleCounter = 0;
let participantCounter = 0;
let shouldFailDispatch = false;

export function resetLivekitMock() {
  dispatches.length = 0;
  outboundTrunks.clear();
  inboundTrunks.clear();
  dispatchRules.clear();
  sipParticipants.length = 0;
  deletedTrunkIds.length = 0;
  deletedDispatchRuleIds.length = 0;
  trunkCounter = 0;
  ruleCounter = 0;
  participantCounter = 0;
  shouldFailDispatch = false;
}

export function getDispatches(): ReadonlyArray<Dispatch> {
  return dispatches;
}

export function getOutboundTrunks(): ReadonlyArray<SipOutboundTrunk> {
  return [...outboundTrunks.values()];
}

export function getInboundTrunks(): ReadonlyArray<SipInboundTrunk> {
  return [...inboundTrunks.values()];
}

export function getDispatchRules(): ReadonlyArray<SipDispatchRule> {
  return [...dispatchRules.values()];
}

export function getSipParticipants(): ReadonlyArray<SipParticipant> {
  return sipParticipants;
}

export function getDeletedTrunkIds(): ReadonlyArray<string> {
  return deletedTrunkIds;
}

export function getDeletedDispatchRuleIds(): ReadonlyArray<string> {
  return deletedDispatchRuleIds;
}

export function makeDispatchFail(fail: boolean) {
  shouldFailDispatch = fail;
}

export function installLivekitMock() {
  mock.module("livekit-server-sdk", () => {
    class AccessToken {
      private identity: string;
      constructor(_key: string, _secret: string, opts: { identity: string }) {
        this.identity = opts.identity;
      }
      addGrant(_grant: unknown) {}
      toJwt() {
        return Promise.resolve(`test-token-for-${this.identity}`);
      }
    }

    class AgentDispatchClient {
      constructor(_url: string, _key: string, _secret: string) {}
      createDispatch(
        roomName: string,
        agentName: string,
        opts?: { metadata?: string },
      ) {
        if (shouldFailDispatch) {
          return Promise.reject(new Error("upstream unavailable"));
        }
        dispatches.push({
          roomName,
          agentName,
          metadata: opts?.metadata,
        });
        return Promise.resolve({ id: `disp-${roomName}`, roomName, agentName });
      }
    }

    class SipClient {
      constructor(_url: string, _key: string, _secret: string) {}

      createSipOutboundTrunk(
        name: string,
        address: string,
        numbers: string[],
        _opts?: unknown,
      ) {
        const id = `trunk-out-${++trunkCounter}`;
        const trunk: SipOutboundTrunk = { id, name, address, numbers };
        outboundTrunks.set(id, trunk);
        return Promise.resolve({ sipTrunkId: id });
      }

      createSipInboundTrunk(
        name: string,
        numbers: string[],
        _opts?: unknown,
      ) {
        const id = `trunk-in-${++trunkCounter}`;
        const trunk: SipInboundTrunk = { id, name, numbers };
        inboundTrunks.set(id, trunk);
        return Promise.resolve({ sipTrunkId: id });
      }

      createSipDispatchRule(rule: unknown, opts?: {
        name?: string;
        trunkIds?: string[];
        metadata?: string;
      }) {
        const id = `rule-${++ruleCounter}`;
        const stored: SipDispatchRule = {
          id,
          name: opts?.name,
          rule,
          trunkIds: opts?.trunkIds ?? [],
          metadata: opts?.metadata,
        };
        dispatchRules.set(id, stored);
        return Promise.resolve({ sipDispatchRuleId: id });
      }

      deleteSipDispatchRule(id: string) {
        deletedDispatchRuleIds.push(id);
        dispatchRules.delete(id);
        return Promise.resolve({});
      }

      deleteSipTrunk(id: string) {
        deletedTrunkIds.push(id);
        outboundTrunks.delete(id);
        inboundTrunks.delete(id);
        return Promise.resolve({});
      }

      createSipParticipant(
        trunkId: string,
        to: string,
        roomName: string,
        opts?: { fromNumber?: string; participantIdentity?: string },
      ) {
        const id = `sip-call-${++participantCounter}`;
        sipParticipants.push({
          trunkId,
          to,
          roomName,
          from: opts?.fromNumber,
        });
        return Promise.resolve({
          sipCallId: id,
          participantIdentity: opts?.participantIdentity ?? id,
        });
      }
    }

    return { AccessToken, AgentDispatchClient, SipClient };
  });
}
