import { useContext } from "react";
import { AuthContext, AuthContextType } from "./AuthProvider";

/**
 * Custom hook to consume authentication context states and operations.
 * Must be used within an `<AuthProvider>` wrapper tree.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
