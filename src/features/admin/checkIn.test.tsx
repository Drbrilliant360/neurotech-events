import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ATTENDEE_ID, installFakeApi, MEETUP_ID, REGISTRATION_ID, SUMMIT_ID, signedIn, user as account, workspace } from "../../test/fakeApi";
import { renderApp } from "../../test/renderApp";

const registration = {
  id: REGISTRATION_ID, event_id: MEETUP_ID, ticket_number: "NTS-7F3A9C21", status: "confirmed", attendee_id: ATTENDEE_ID,
  attendee_name: "Asha Mwinyi", attendee_email: "asha@example.com", attendee_phone: null, attendee_organization: "Neurotech Africa",
  ticket_type_id: "t-free", ticket_name: "Community seat", amount_paid: 0, checked_in_at: null, created_at: "2026-09-27T10:00:00Z",
  cancelled_at: null,
};

const checkedIn = {
  id: "chk-1", event_id: MEETUP_ID, attendee_id: ATTENDEE_ID, registration_id: REGISTRATION_ID, ticket_number: "NTS-7F3A9C21",
  attendee_name: "Asha Mwinyi", ticket_name: "Community seat", checked_in_at: "2026-10-24T13:40:00Z", checked_in_by: "Demo Admin", undone: false,
};

function openCheckIn(routes: Parameters<typeof installFakeApi>[0] = {}, registrations: unknown[] = [registration]) {
  signedIn();
  const api = installFakeApi({
    "GET /me": () => ({ body: account({ role: "platform_admin", organizer: true, attendee_id: null }) }),
    "GET /admin/workspace": () => ({ body: workspace(registrations) }),
    ...routes,
  });
  const app = renderApp("/admin/check-in");
  return { api, ...app };
}

async function lookUp(user: ReturnType<typeof openCheckIn>["user"], value: string) {
  const input = await screen.findByLabelText("Or look up a name, email or ticket number");
  await user.type(input, value);
  await user.click(screen.getByRole("button", { name: "Confirm check-in" }));
}

describe("check-in", () => {
  it("checks a ticket in by ticket number and announces the attendee", async () => {
    const { api, user } = openCheckIn({ "POST /admin/events/*/check-ins": () => ({ status: 201, body: checkedIn }) });
    await lookUp(user, "NTS-7F3A9C21");

    const status = await screen.findByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Checked in Asha Mwinyi · Community seat."));
    const [request] = api.find("POST", `/admin/events/${MEETUP_ID}/check-ins`);
    expect(request.body).toEqual({ code: "NTS-7F3A9C21" });
    expect(within(status).getByText(/Checked in/)).toHaveClass("is-ok");
  });

  it("sends a signed QR payload unchanged to the event the registration belongs to", async () => {
    // The ticket belongs to the second event in the console, so trying events in order would miss it.
    const { api, user } = openCheckIn(
      { "POST /admin/events/*/check-ins": () => ({ status: 201, body: { ...checkedIn, event_id: SUMMIT_ID } }) },
      [{ ...registration, event_id: SUMMIT_ID }],
    );
    const payload = `NTQ1.${REGISTRATION_ID.replace(/-/g, "")}.c2lnbmF0dXJlLWZyb20tc2VydmVy`;
    await lookUp(user, payload);

    await waitFor(() => expect(api.find("POST", `/admin/events/${SUMMIT_ID}/check-ins`)).toHaveLength(1));
    expect(api.find("POST", `/admin/events/${SUMMIT_ID}/check-ins`)[0].body).toEqual({ code: payload });
    // Only the owning event is tried; the signature is verified by the server.
    expect(api.calls.filter((call) => call.method === "POST" && call.path.endsWith("/check-ins"))).toHaveLength(1);
  });

  it("reports a second scan of the same ticket as already checked in", async () => {
    const { user } = openCheckIn({
      "POST /admin/events/*/check-ins": () => ({
        status: 409, body: { error: { code: "already_checked_in", message: "Ticket already checked in at 13:40." } },
      }),
    });
    await lookUp(user, "NTS-7F3A9C21");

    const result = await screen.findByText("Already checked in: Ticket already checked in at 13:40.");
    expect(result).toHaveClass("is-duplicate");
  });

  it("explains when the camera cannot be used instead of failing silently", async () => {
    const { user } = openCheckIn();
    // jsdom, like an insecure http:// page on a phone, exposes no camera API.
    await user.click(await screen.findByRole("button", { name: "Scan ticket QR with camera" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/camera/i);
    await user.click(screen.getByRole("button", { name: "Close camera" }));
    expect(screen.getByRole("button", { name: "Scan ticket QR with camera" })).toBeInTheDocument();
  });
});
