export const DEV_AUTH_BYPASS_USER = {
  id: "dev-user",
  name: "Dev User",
  email: "dev@example.local",
  role: "admin",
  isDevBypass: true,
};

export const isDevAuthBypassEnabled = () =>
  import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === "true";
