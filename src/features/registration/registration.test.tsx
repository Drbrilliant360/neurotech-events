import { screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { installFakeApi, MEETUP_ID } from "../../test/fakeApi";
import { renderApp } from "../../test/renderApp";

async function fillAttendee(user: UserEvent, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    const input = screen.getByLabelText(label);
    await user.clear(input);
    await user.type(input, value);
  }
}

describe("registration", () => {
  it("lets a guest register for a free event and shows the confirmed ticket", async () => {
    const api = installFakeApi({
      "POST /registrations/free": (call) => ({
        status: 201,
        body: {
          id: "reg-1", event_id: MEETUP_ID, event_slug: "generative-ai-tanzania-meetup", event_title: "Generative AI Tanzania Meetup",
          ticket_number: "NTS-ABC123", status: "confirmed", attendee_id: "att-1", ticket_code: (call.body as { ticket_code: string }).ticket_code,
        },
      }),
    });
    const { user } = renderApp("/register/generative-ai-tanzania-meetup");

    expect(await screen.findByRole("heading", { name: "Register for Generative AI Tanzania Meetup" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await fillAttendee(user, {
      "Full name": "Asha Mwinyi",
      Email: "asha@example.com",
      Phone: "+255 712 345 678",
      Organization: "Neurotech Africa",
      "Role / title": "Engineer",
    });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Review your registration" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue to checkout" }));

    await waitFor(() => expect(window.location.pathname).toMatch(/^\/checkout\//));
    await user.click(await screen.findByRole("button", { name: "Confirm free registration" }));

    expect(await screen.findByText(/Ticket NTS-ABC123 for Generative AI Tanzania Meetup is confirmed/)).toBeInTheDocument();
    const [request] = api.find("POST", "/registrations/free");
    expect(request.body).toMatchObject({
      event_slug: "generative-ai-tanzania-meetup",
      ticket_code: "tix_z",
      attendee: { full_name: "Asha Mwinyi", email: "asha@example.com", organization: "Neurotech Africa", job_title: "Engineer" },
    });
    // The browser never creates paid or free registrations on its own; only the server call does.
    expect(api.find("POST", "/payments/mobile")).toHaveLength(0);
  });

  it("flags missing attendee details and does not continue", async () => {
    const api = installFakeApi();
    const { user } = renderApp("/register/generative-ai-tanzania-meetup");

    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Enter your full name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attendee information" })).toBeInTheDocument();
    expect(api.find("POST", "/registrations/free")).toHaveLength(0);
  });

  it("shows the server's reason when the ticket can no longer be confirmed", async () => {
    installFakeApi({
      "POST /registrations/free": () => ({ status: 409, body: { error: { code: "sold_out", message: "This ticket type is sold out." } } }),
    });
    const { user } = renderApp("/register/generative-ai-tanzania-meetup");

    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await fillAttendee(user, { "Full name": "Juma Said", Email: "juma@example.com", Phone: "0712345678", Organization: "UDSM", "Role / title": "Student" });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue to checkout" }));
    await user.click(await screen.findByRole("button", { name: "Confirm free registration" }));

    expect(await screen.findByText("This ticket type is sold out.")).toBeInTheDocument();
    expect(screen.queryByText(/is confirmed/)).not.toBeInTheDocument();
  });
});
