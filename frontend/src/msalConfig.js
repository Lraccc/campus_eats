// MSAL configuration for Microsoft OAuth
export const msalConfig = {
    auth: {
        clientId: "6533df52-b33b-4953-be58-6ae5caa69797",
        authority: "https://login.microsoftonline.com/823cde44-4433-456d-b801-bdf0ab3d41fc", // Single-tenant: Cebu Institute of Technology University
        redirectUri: window.location.origin + "/login" // Must match Azure portal config
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false
    }
};

export const loginRequest = {
    scopes: ["openid", "profile", "email", "api://6533df52-b33b-4953-be58-6ae5caa69797/access_as_user"]
};
