export type FrameworkId =
  | "nextjs"
  | "react"
  | "vue"
  | "nuxt"
  | "svelte"
  | "remix"
  | "astro"
  | "vite"
  | "express"
  | "nestjs"
  | "nodejs"
  | "laravel"
  | "laravel-react"
  | "php"
  | "fastapi"
  | "django"
  | "python"
  | "go"
  | "docker"
  | "static";

export type FrameworkMeta = {
  id: FrameworkId;
  label: string;
  badgeClass: string;
};

const META: Record<FrameworkId, FrameworkMeta> = {
  nextjs: { id: "nextjs", label: "Next.js", badgeClass: "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" },
  react: { id: "react", label: "React", badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  vue: { id: "vue", label: "Vue", badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  nuxt: { id: "nuxt", label: "Nuxt", badgeClass: "bg-emerald-600/15 text-emerald-800 dark:text-emerald-200" },
  svelte: { id: "svelte", label: "SvelteKit", badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  remix: { id: "remix", label: "Remix", badgeClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  astro: { id: "astro", label: "Astro", badgeClass: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300" },
  vite: { id: "vite", label: "Vite", badgeClass: "bg-violet-500/15 text-violet-600 dark:text-violet-300" },
  express: { id: "express", label: "Express", badgeClass: "bg-neutral-500/15 text-neutral-800 dark:text-neutral-200" },
  nestjs: { id: "nestjs", label: "NestJS", badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  nodejs: { id: "nodejs", label: "Node.js", badgeClass: "bg-lime-500/15 text-lime-800 dark:text-lime-200" },
  laravel: { id: "laravel", label: "Laravel", badgeClass: "bg-red-500/15 text-red-700 dark:text-red-300" },
  "laravel-react": {
    id: "laravel-react",
    label: "Laravel + React",
    badgeClass: "bg-red-600/15 text-red-800 dark:text-red-200"
  },
  php: { id: "php", label: "PHP", badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
  fastapi: { id: "fastapi", label: "FastAPI", badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300" },
  django: { id: "django", label: "Django", badgeClass: "bg-green-600/15 text-green-800 dark:text-green-200" },
  python: { id: "python", label: "Python", badgeClass: "bg-yellow-500/15 text-yellow-800 dark:text-yellow-200" },
  go: { id: "go", label: "Go", badgeClass: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200" },
  docker: { id: "docker", label: "Docker", badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  static: { id: "static", label: "Static", badgeClass: "bg-muted text-muted-foreground" }
};

const ALIASES: Record<string, FrameworkId> = {
  next: "nextjs",
  nextjs: "nextjs",
  "next.js": "nextjs",
  react: "react",
  vue: "vue",
  nuxt: "nuxt",
  nuxtjs: "nuxt",
  svelte: "svelte",
  sveltekit: "svelte",
  remix: "remix",
  astro: "astro",
  vite: "vite",
  express: "express",
  nestjs: "nestjs",
  nest: "nestjs",
  node: "nodejs",
  nodejs: "nodejs",
  laravel: "laravel",
  "laravel-react": "laravel-react",
  "laravel_react": "laravel-react",
  html: "static",
  php: "php",
  "php-fpm": "php",
  fastapi: "fastapi",
  django: "django",
  python: "python",
  go: "go",
  golang: "go",
  docker: "docker",
  static: "static"
};

export function normalizeFrameworkId(raw: string | null | undefined): FrameworkId {
  const key = (raw ?? "static").toLowerCase().trim();
  return ALIASES[key] ?? "static";
}

export function getFrameworkMeta(raw: string | null | undefined): FrameworkMeta {
  return META[normalizeFrameworkId(raw)];
}

export function listFrameworkMetas(): FrameworkMeta[] {
  return Object.values(META);
}
