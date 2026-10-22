"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/shared/lib/auth/client";
import { useHydrated } from "@/shared/lib/auth/use-hydrated";

export function LogoutButton() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("logout");
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Não foi possível sair. Tente novamente.");
      setPending(false);
    }
  }
  return (
    <div className="logout-control">
      <button
        type="button"
        className="button button-secondary"
        onClick={logout}
        disabled={pending || !hydrated}
      >
        {pending ? "Saindo…" : "Sair"}
      </button>
      <span role="alert">{error}</span>
    </div>
  );
}
