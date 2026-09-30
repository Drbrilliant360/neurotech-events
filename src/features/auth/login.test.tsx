import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { installFakeApi, tokens, user as account } from "../../test/fakeApi";
import { renderApp } from "../../test/renderApp";

async function signIn(email: string, password: string) {
  const app = renderApp("/login");
  await screen.findByRole("button", { name: "Sign in to my events" });
  await app.user.type(screen.getByLabelText("Email address"), email);
  await app.user.type(screen.getByLabelText("Password"), password);
  await app.user.click(screen.getByRole("button", { name: "Sign in to my events" }));
  return app;
}

describe("login", () => {
  it("signs an attendee in, keeps the session tokens and opens the attendee workspace", async () => {
    const api = installFakeApi({
      "POST /auth/login": () => ({ body: { ...tokens(), user: account() } }),
    });
    await signIn("demo-user@example.com", "User-demo-2026");

    await waitFor(() => expect(window.location.pathname).toBe("/app"));
    expect(api.find("POST", "/auth/login")[0].body).toEqual({ email: "demo-user@example.com", password: "User-demo-2026" });
    expect(JSON.parse(sessionStorage.getItem("neurotech.events.session") ?? "{}")).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
    // The attendee workspace loads the caller's own data with the new access token.
    await waitFor(() => expect(api.find("GET", "/attendee/registrations")).toHaveLength(1));
    expect(api.find("GET", "/attendee/registrations")[0].auth).toBe("Bearer access-1");
    expect(api.find("GET", "/admin/workspace")).toHaveLength(0);
  });

  it("opens the organiser console for an organiser account", async () => {
    const api = installFakeApi({
      "POST /auth/login": () => ({ body: { ...tokens(), user: account({ role: "platform_admin", organizer: true, attendee_id: null }) } }),
    });
    await signIn("demo-admin@example.com", "Admin-password-1");

    await waitFor(() => expect(window.location.pathname).toBe("/admin"));
    await waitFor(() => expect(api.find("GET", "/admin/workspace")).toHaveLength(1));
  });

  it("shows the server's error and stays on the sign-in page when the password is wrong", async () => {
    installFakeApi({
      "POST /auth/login": () => ({ status: 401, body: { error: { code: "invalid_credentials", message: "Incorrect email or password." } } }),
    });
    await signIn("demo-user@example.com", "wrong-password");

    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
    expect(sessionStorage.getItem("neurotech.events.session")).toBeNull();
  });

  it("validates the form before calling the API", async () => {
    const api = installFakeApi();
    await signIn("demo-user@example.com", "short");

    expect(await screen.findByText("Use at least 8 characters.")).toBeInTheDocument();
    expect(api.find("POST", "/auth/login")).toHaveLength(0);
  });
});
