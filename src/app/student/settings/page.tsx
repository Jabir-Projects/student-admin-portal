import { ThemeToggle } from "@/components/staff/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudentSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-muted-foreground text-sm font-medium">
          Student portal
        </p>
        <h1 className="text-sist-navy-dark mt-1 text-3xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage the presentation preferences for this browser.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Color theme</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Light mode is the default. Use the theme button to switch between
              light and dark mode.
            </p>
          </div>
          <ThemeToggle />
        </CardContent>
      </Card>
    </div>
  );
}
