import Link from "next/link";

import { loginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const inputClass = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="mx-auto max-w-md px-4 py-16"><Card><CardHeader><CardTitle>SIST portal sign in</CardTitle><p className="text-sm text-muted-foreground">Use your registered email address and password.</p></CardHeader><CardContent><form action={loginAction} className="space-y-5"><label className="block space-y-2 text-sm font-medium">Email<input className={inputClass} name="email" type="email" autoComplete="email" maxLength={320} required /></label><label className="block space-y-2 text-sm font-medium">Password<input className={inputClass} name="password" type="password" autoComplete="current-password" maxLength={128} required /></label>{error ? <p className="text-sm text-destructive" role="alert">{error === "disabled" ? "This account is disabled. Please contact administration." : "The email address or password is incorrect."}</p> : null}<Button className="w-full" type="submit">Sign in</Button><p className="text-center text-sm text-muted-foreground">Need a student account? <Link className="font-medium text-primary hover:underline" href="/register">Register</Link></p></form></CardContent></Card></main>;
}
