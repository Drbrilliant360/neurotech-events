import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import blocks from "./design/blocks.json";
import { renderDc } from "./lib/dcRender";
import { useAppModel } from "./lib/useAppModel";
import "./App.css";

export default function App() {
  const { screen, model } = useAppModel();

  const body = useMemo(() => {
    if (model.is.public) return renderDc(blocks.public, model);
    if (model.is.user) return renderDc(blocks.user, model);
    return renderDc(blocks.admin, model);
  }, [model]);

  return (
    <div className="app-root">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AnimatePresence mode="wait">
        <motion.main
          id="main-content"
          tabIndex={-1}
          key={screen}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {body}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
