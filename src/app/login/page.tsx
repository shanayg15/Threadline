import { AuthShell } from "@/components/auth-shell";
import { env } from "@/lib/config/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — Threadline" };

export default function LoginPage() {
  const demoHint =
    env.NODE_ENV !== "production" ? (
      <span>
        Demo login: <code className="font-mono">owner@demo-apparel.example</code> /{" "}
        <code className="font-mono">demo-password-123</code>
      </span>
    ) : undefined;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Threadline console."
      footer={demoHint}
    >
      <LoginForm />
    </AuthShell>
  );
}
