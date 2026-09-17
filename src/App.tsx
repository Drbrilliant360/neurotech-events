import { AppRouter } from "./app/router/AppRouter";
import "./App.css";
import "./styles/platform.css";
import "./styles/experience.css";
import "./styles/revision.css";
import "./styles/workspace.css";
import "./styles/pages.css";

export default function App() {
  return (
    <div className="app-root">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div id="main-content" tabIndex={-1}>
        <AppRouter />
      </div>
    </div>
  );
}
