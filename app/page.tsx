import { parseLang, t } from "@/lib/i18n";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const lang = parseLang((await searchParams).lang);

  async function go(formData: FormData) {
    "use server";
    const username = String(formData.get("username") ?? "").trim();
    const lang = String(formData.get("lang") ?? "ko");
    if (username) redirect(`/${encodeURIComponent(username)}?lang=${lang}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-[#0d1117] to-[#161b2e] px-6 text-white">
      <div className="absolute right-6 top-6 text-sm text-gray-400">
        <Link href="/?lang=ko" className={lang === "ko" ? "text-white font-bold" : ""}>한국어</Link>
        {" · "}
        <Link href="/?lang=en" className={lang === "en" ? "text-white font-bold" : ""}>English</Link>
      </div>
      <h1 className="text-5xl font-extrabold tracking-tight">
        🎁 {t(lang, "title")}
      </h1>
      <p className="text-lg text-gray-400">{t(lang, "subtitle")}</p>
      <form action={go} className="flex w-full max-w-md gap-2">
        <input type="hidden" name="lang" value={lang} />
        <input
          name="username"
          required
          autoFocus
          placeholder={t(lang, "placeholder")}
          className="flex-1 rounded-lg border border-gray-700 bg-[#0d1117] px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-emerald-400"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-5 py-3 font-bold text-black hover:bg-emerald-400"
        >
          {t(lang, "analyze")}
        </button>
      </form>
    </main>
  );
}
