import type { ProviderType, TelephonyDriver } from "./drivers/base";
import { TwilioDriver } from "./drivers/twilio";

const DRIVERS: Record<ProviderType, TelephonyDriver> = {
  twilio: TwilioDriver,
};

export function getDriver(type: ProviderType): TelephonyDriver {
  const driver = DRIVERS[type];
  if (!driver) {
    throw new Error(`no telephony driver registered for '${type}'`);
  }
  return driver;
}

export { DRIVERS };
export type { ProviderType, TelephonyDriver } from "./drivers/base";
