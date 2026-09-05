export type Role = "creator" | "brand" | "admin";

export function homeForRole(role: Role): "/dashboard" | "/brand" | "/admin" {
  if (role === "creator") return "/dashboard";
  if (role === "admin") return "/admin";
  return "/brand";
}
