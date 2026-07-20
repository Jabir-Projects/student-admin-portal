import Link from "next/link";

export default function StudentLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-block text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          ← Back to home
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-900">
              Student Login
            </h1>

            <p className="mt-2 text-slate-600">
              Access your student administration portal
            </p>
          </div>

          <form className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="studentId"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Student ID or Email
              </label>

              <input
                id="studentId"
                name="studentId"
                type="text"
                placeholder="Enter your student ID"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                />
                Remember me
              </label>

              <Link
                href="/forgot-password"
                className="text-sm font-medium text-blue-700 hover:text-blue-800"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white transition hover:bg-blue-800"
            >
              Sign in
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Having trouble signing in? Contact the administration.
          </p>
        </div>
      </div>
    </main>
  );
}