export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Student Admin Portal
            </h1>
            <p className="text-sm text-slate-500">
              Student Services Platform
            </p>
          </div>

          <a
            href="/login"
            className="rounded-lg bg-blue-700 px-5 py-2.5 font-medium text-white transition hover:bg-blue-800"
          >
            Login
          </a>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-85px)] max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2">
        <div>
          <span className="inline-block rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
            Simple • Fast • Secure
          </span>

          <h2 className="mt-6 text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
            Manage your student requests easily
          </h2>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Submit administrative document requests, follow their progress and
            receive updates from the administration—all from one platform.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <a
              href="/login"
              className="rounded-lg bg-blue-700 px-6 py-3 text-center font-semibold text-white transition hover:bg-blue-800"
            >
              Student Login
            </a>

            <a
              href="/admin/login"
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-800 transition hover:bg-slate-100"
            >
              Administration Login
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
          <h3 className="text-2xl font-bold text-slate-900">
            Available services
          </h3>

          <div className="mt-6 space-y-4">
            <ServiceCard
              number="01"
              title="Submit a request"
              description="Request certificates, transcripts and other administrative documents."
            />

            <ServiceCard
              number="02"
              title="Track progress"
              description="Check whether your request is pending, approved or completed."
            />

            <ServiceCard
              number="03"
              title="Receive updates"
              description="View important notifications from the administration."
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function ServiceCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-slate-200 p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 font-bold text-blue-700">
        {number}
      </div>

      <div>
        <h4 className="font-semibold text-slate-900">{title}</h4>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}