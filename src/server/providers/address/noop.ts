import "server-only";

import type { AddressProvider } from "../types";

/**
 * No-op address provider — returns empty suggestions. Manual entry always
 * works. TODO(stretch:location.address_autocomplete): Google Places impl.
 */
export const noopAddressProvider: AddressProvider = {
  name: "noop",
  async autocomplete() {
    return [];
  },
  async resolve() {
    return null;
  },
  async healthCheck() {
    return { ok: true, checkedAt: new Date().toISOString(), message: "noop" };
  },
};
