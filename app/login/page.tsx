import { AuthForm } from "../auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await searchParams;
  return <AuthForm mode="login" linkError={fehler === "link"} />;
}
