import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

/** Render the whole app at `path`, exactly as the browser would load it. */
export function renderApp(path = "/") {
  window.history.pushState({}, "", path);
  const user = userEvent.setup();
  return { user, ...render(<App />) };
}
