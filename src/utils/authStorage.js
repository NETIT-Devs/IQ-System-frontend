export function getAuthenticatedUser() {
  for (const storage of [localStorage, sessionStorage]) {
    const token = storage.getItem("authToken");
    const serializedUser = storage.getItem("authUser");

    if (!token || !serializedUser) continue;

    try {
      const user = JSON.parse(serializedUser);

      if (user && typeof user === "object" && user.role) {
        return user;
      }
    } catch {
      continue;
    }
  }

  return null;
}
