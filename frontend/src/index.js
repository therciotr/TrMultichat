import React from "react";
import ReactDOM from "react-dom";
import CssBaseline from "@material-ui/core/CssBaseline";

import App from "./App";
import "./styles/global.css";

// Log simples para ver primeira XHR que falha após o login
if (typeof window !== "undefined") {
  (function () {
    const _fetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const res = await _fetch(...args);
        if (!res.ok) {
          // eslint-disable-next-line no-console
          console.warn("[fetch]", res.status, args[0]);
        }
        return res;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[fetch-error]", args[0], e?.message || e);
        throw e;
      }
    };
  })();
}

ReactDOM.render(
	<CssBaseline>
		<App />
	</CssBaseline>,
	document.getElementById("root")
);

// Unregister any service workers to avoid stale caches in development
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  try {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  } catch (_) {}
}

// ReactDOM.render(
// 	<React.StrictMode>
// 		<CssBaseline>
// 			<App />
// 		</CssBaseline>,
//   </React.StrictMode>

// 	document.getElementById("root")
// );
