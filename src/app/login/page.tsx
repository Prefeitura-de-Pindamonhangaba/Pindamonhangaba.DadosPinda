import { LoginView } from "@/modules/auth/views/login-view";
import { getLoginOptions } from "@/modules/auth/controllers/login-controller";

export const dynamic = "force-dynamic";
export default function LoginPage() {
  return <LoginView {...getLoginOptions()} />;
}
