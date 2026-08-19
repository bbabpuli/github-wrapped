import { parseLang, t } from "@/lib/i18n";
import { currentYear } from "@/lib/year";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const lang = parseLang((await searchParams).lang);
  const year = currentYear();

  async function go(formData: FormData) {
    "use server";
    const username = String(formData.get("username") ?? "").trim();
    const lang = String(formData.get("lang") ?? "ko");
    if (username) redirect(`/${encodeURIComponent(username)}?lang=${lang}`);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden bg-limepop px-6 text-ink">
      <div className="absolute right-6 top-6 text-sm font-semibold">
        <Link href="/?lang=ko" className={lang === "ko" ? "underline underline-offset-4" : "opacity-50"}>한국어</Link>
        {" · "}
        <Link href="/?lang=en" className={lang === "en" ? "underline underline-offset-4" : "opacity-50"}>English</Link>
      </div>

      <div className="flex flex-col items-center gap-4 text-center">
        <span className="-rotate-2 rounded-full bg-ink px-4 py-1.5 font-display text-sm tracking-wide text-limepop">
          {year} WRAPPED
        </span>
        <h1 className="font-display text-6xl leading-[0.95] sm:text-8xl">
          {t(lang, "title")}
        </h1>
        <p className="max-w-md text-lg font-semibold">{t(lang, "subtitle")}</p>
      </div>

      <form action={go} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <input type="hidden" name="lang" value={lang} />
        <input
          name="username"
          required
          autoFocus
          placeholder={t(lang, "placeholder")}
          className="flex-1 rounded-2xl border-[3px] border-ink bg-limepop px-5 py-4 font-semibold text-ink placeholder-ink/40 outline-none focus:bg-white"
        />
        <button
          type="submit"
          className="rounded-2xl bg-grape px-7 py-4 font-display text-lg text-white transition-transform hover:-rotate-1 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {t(lang, "analyze")}
        </button>
      </form>

      <p className="text-xs font-semibold opacity-60">{t(lang, "publicOnly")}</p>
    </main>
  );
}
