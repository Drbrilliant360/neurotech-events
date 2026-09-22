import type { DemoRole } from "../domain/types";

/** Where a person's own workspace lives for the current session role. */
export function accountPathFor(role: DemoRole): string {
  if (role === "admin") return "/admin";
  if (role === "attendee") return "/app";
  return "/login";
}
