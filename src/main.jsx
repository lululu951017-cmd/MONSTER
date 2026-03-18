import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { installMonsterFeishuBridge } from "./integrations/feishu.js";

installMonsterFeishuBridge();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
