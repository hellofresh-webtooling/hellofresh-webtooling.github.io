import "@testing-library/jest-dom";

// Stub Supabase env vars zodat de module laadt zonder echte verbinding
Object.assign(import.meta, {
  env: {
    VITE_SUPABASE_URL: "https://test.supabase.co",
    VITE_SUPABASE_KEY: "test-key",
    VITE_EDGE_URL: "https://test.functions.supabase.co/app-proxy",
    VITE_EDGE_SECRET: "test-secret",
    BASE_URL: "/",
  },
});
