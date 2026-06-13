import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Get started — Threadline" };

export default function SignupPage() {
  return (
    <AuthShell title="Create your workspace" subtitle="Spin up a Threadline brand in seconds.">
      <SignupForm />
    </AuthShell>
  );
}
