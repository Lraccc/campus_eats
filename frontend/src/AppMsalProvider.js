import React, { useEffect, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./msalConfig";

const msalInstance = new PublicClientApplication(msalConfig);

export default function AppMsalProvider({ children }) {
  const [msalReady, setMsalReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    msalInstance.initialize()
      .then(() => {
        if (isMounted) setMsalReady(true);
      })
      .catch((err) => {
        console.error("MSAL initialization failed", err);
      });
    return () => { isMounted = false; };
  }, []);

  if (!msalReady) {
    return <div>Loading authentication...</div>;
  }

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
