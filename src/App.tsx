import { AppRouter } from "./app/router/AppRouter";
import { InteractionMotion } from "./components/shared/InteractionMotion";
import "./App.css";
import "./styles/platform.css";
import "./styles/experience.css";
import "./styles/pages.css";
import "./styles/commerce.css";
import "./styles/workspace.css";
import "./styles/revision.css";
import "./styles/system-polish.css";
import "./styles/premium-polish.css";
import "./styles/mobile.css";

export default function App() {
  return (
    <div className="app-root">
      <InteractionMotion />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div id="main-content" tabIndex={-1}>
        <AppRouter />
      </div>
    </div>
  );
}
