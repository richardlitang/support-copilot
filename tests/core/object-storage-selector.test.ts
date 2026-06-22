import { describe, expect, it } from "vitest";
import { getObjectStorage } from "@/src/server/storage/objectStorage";

describe("getObjectStorage", () => {
  it("returns a backend exposing put/get/deleteObject for local", () => {
    const store = getObjectStorage("local");
    expect(typeof store.putObject).toBe("function");
    expect(typeof store.getObject).toBe("function");
    expect(typeof store.deleteObject).toBe("function");
  });
  it("returns a backend for supabase without throwing at selection time", () => {
    // Selecting supabase must not require live creds; the supabase client is
    // only constructed lazily inside the backend's methods.
    expect(() => getObjectStorage("supabase")).not.toThrow();
  });
  it("defaults unknown/empty providers to a local-shaped backend", () => {
    expect(typeof getObjectStorage("nonsense").putObject).toBe("function");
  });
});
