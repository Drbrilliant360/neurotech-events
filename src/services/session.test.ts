import { describe, expect, it } from "vitest";
import { installFakeApi, signedIn } from "../test/fakeApi";
import { authRequest, readTokens } from "./api";

describe("session refresh", () => {
  it("rotates an expired access token once for concurrent requests and retries them", async () => {
    signedIn();
    const api = installFakeApi({
      "GET /me": (call) => (call.auth === "Bearer access-2" ? { body: { ok: true } } : { status: 401, body: { error: { code: "token_expired", message: "Expired." } } }),
      "POST /auth/refresh": () => ({ body: { access_token: "access-2", refresh_token: "refresh-2" } }),
    });

    const results = await Promise.all([authRequest("/me"), authRequest("/me"), authRequest("/me")]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    // The server revokes the session if one refresh token is presented twice.
    expect(api.find("POST", "/auth/refresh")).toHaveLength(1);
    expect(api.find("POST", "/auth/refresh")[0].body).toEqual({ refresh_token: "refresh-1" });
    expect(readTokens()).toEqual({ accessToken: "access-2", refreshToken: "refresh-2" });
  });

  it("forgets the session when the refresh token is rejected", async () => {
    signedIn();
    installFakeApi({
      "GET /me": () => ({ status: 401, body: { error: { code: "token_expired", message: "Expired." } } }),
      "POST /auth/refresh": () => ({ status: 401, body: { error: { code: "token_revoked", message: "Revoked." } } }),
    });

    await expect(authRequest("/me")).rejects.toMatchObject({ status: 401 });
    expect(readTokens()).toBeNull();
  });
});
