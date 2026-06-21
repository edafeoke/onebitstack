import { normalizeBuildCommand, normalizeStartCommand } from "@/lib/deployment/normalize-commands";

type PkgShape = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

export type DetectedStack = {
  framework: string;
  runtime: string;
  buildCommand: string;
  startCommand: string;
  restartCommand: string;
  hints: string[];
};

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readDeps(pkg: PkgShape): Record<string, string> {
  const d = pkg.dependencies ?? {};
  const dev = pkg.devDependencies ?? {};
  return { ...dev, ...d };
}

/**
 * Infer framework/runtime/commands from root-level repo files (already fetched as strings).
 */
const LARAVEL_COMPOSER_BUILD =
  "composer install --no-dev --optimize-autoloader";
const LARAVEL_REACT_BUILD = `${LARAVEL_COMPOSER_BUILD} && npm ci && npm run build`;
const PHP_FPM_RELOAD = "sudo systemctl reload php8.4-fpm";

export function inferStackFromRootFiles(input: {
  packageJson: string | null;
  composerJson: string | null;
  indexHtml: string | null;
  requirementsTxt: string | null;
  pyprojectToml: string | null;
  dockerfile: string | null;
  goMod: string | null;
  /** Any next.config.{js,mjs,ts} at repo root */
  nextConfig?: string | null;
  /** Laravel artisan file at repo root */
  artisan?: string | null;
}): DetectedStack {
  const hints: string[] = [];
  const docker = input.dockerfile?.toLowerCase().includes("from ");

  if (input.composerJson && input.packageJson) {
    const composerParsed = tryParseJson(input.composerJson);
    if (
      isRecord(composerParsed) &&
      isRecord(composerParsed.require) &&
      composerParsed.require["laravel/framework"]
    ) {
      hints.push("composer.json: laravel + package.json (SPA/Inertia)");
      return {
        framework: "laravel-react",
        runtime: "php-fpm",
        buildCommand: normalizeBuildCommand(LARAVEL_REACT_BUILD, {
          framework: "laravel-react",
          runtime: "php-fpm"
        }),
        startCommand: "php artisan serve --host=0.0.0.0 --port=${PORT}",
        restartCommand: PHP_FPM_RELOAD,
        hints
      };
    }
  }

  if (input.packageJson) {
    const parsed = tryParseJson(input.packageJson);
    if (isRecord(parsed)) {
      const pkg = parsed as PkgShape;
      const deps = readDeps(pkg);
      const scripts = pkg.scripts ?? {};
      const hasNextConfig = Boolean(input.nextConfig?.trim());
      const hasNext = Boolean(deps.next) || hasNextConfig;
      const hasReact = Boolean(deps.react);
      const hasVite = Boolean(deps.vite);
      const hasNuxt = Boolean(deps.nuxt);
      const hasSvelte = Boolean(deps["@sveltejs/kit"]);
      const hasVue = Boolean(deps.vue);
      const hasAstro = Boolean(deps.astro);
      const hasRemix = Boolean(deps["@remix-run/node"] || deps["@remix-run/react"]);
      const hasNest = Boolean(deps["@nestjs/core"]);
      const hasExpress = Boolean(deps.express);

      if (hasNext) {
        hints.push(hasNextConfig ? "next.config + package.json" : "package.json: next");
        return {
          framework: "nextjs",
          runtime: "node",
          buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci && npm run build"),
          startCommand: normalizeStartCommand(scripts.start ?? "npm run start"),
          restartCommand: "pm2 restart {projectSlug}",
          hints
        };
      }
      if (hasRemix) {
        hints.push("package.json: remix");
        return {
          framework: "remix",
          runtime: "node",
          buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci && npm run build"),
          startCommand: normalizeStartCommand(scripts.start ?? "npm run start"),
          restartCommand: "pm2 restart {projectSlug}",
          hints
        };
      }
      if (hasAstro) {
        hints.push("package.json: astro");
        return {
          framework: "astro",
          runtime: "node",
          buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci && npm run build"),
          startCommand: normalizeStartCommand(scripts.start ?? "node ./dist/server/entry.mjs"),
          restartCommand: "pm2 restart {projectSlug}",
          hints
        };
      }
      if (hasNuxt) {
        hints.push("package.json: nuxt");
        return {
          framework: "nuxt",
          runtime: "node",
          buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci && npm run build"),
          startCommand: normalizeStartCommand(scripts.start ?? "node .output/server/index.mjs"),
          restartCommand: "pm2 restart {projectSlug}",
          hints
        };
      }
      if (hasSvelte) {
        hints.push("package.json: sveltekit");
        return {
          framework: "svelte",
          runtime: "node",
          buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci && npm run build"),
          startCommand: normalizeStartCommand(scripts.start ?? "node build"),
          restartCommand: "pm2 restart {projectSlug}",
          hints
        };
      }
      if (hasVue && hasVite) {
        hints.push("package.json: vue + vite");
        return {
          framework: "vue",
          runtime: "node",
          buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci && npm run build"),
          startCommand: scripts.preview
            ? "npm run preview -- --host 0.0.0.0 --port ${PORT}"
            : "npx serve -s dist -l ${PORT}",
          restartCommand: "pm2 restart {projectSlug}",
          hints
        };
      }
      if (hasVue) {
        hints.push("package.json: vue");
        return {
          framework: "vue",
          runtime: "node",
          buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci && npm run build"),
          startCommand: normalizeStartCommand(scripts.start ?? "npm run start"),
          restartCommand: "pm2 restart {projectSlug}",
          hints
        };
      }
      if (hasVite && hasReact) {
        hints.push("package.json: vite + react");
        return {
          framework: "vite",
          runtime: "node",
          buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci && npm run build"),
          startCommand: scripts.preview
            ? "npm run preview -- --host 0.0.0.0 --port ${PORT}"
            : "npx serve -s dist -l ${PORT}",
          restartCommand: "pm2 restart {projectSlug}",
          hints
        };
      }
      if (deps["react-scripts"]) {
        hints.push("package.json: react-scripts");
        return {
          framework: "react",
          runtime: "node",
          buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci && npm run build"),
          startCommand: "npx serve -s build -l ${PORT}",
          restartCommand: "pm2 restart {projectSlug}",
          hints
        };
      }
      if (hasReact) {
        hints.push("package.json: react (generic)");
        return {
          framework: "react",
          runtime: "node",
          buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci && npm run build"),
          startCommand: normalizeStartCommand(scripts.start ?? "npm run start"),
          restartCommand: "pm2 restart {projectSlug}",
          hints
        };
      }
      if (hasNest) {
        hints.push("package.json: @nestjs/core");
        return {
          framework: "nestjs",
          runtime: "node",
          buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci && npm run build"),
          startCommand: normalizeStartCommand(scripts.start ?? "node dist/main.js"),
          restartCommand: "pm2 restart {projectSlug}",
          hints
        };
      }
      if (hasExpress) {
        hints.push("package.json: express");
        return {
          framework: "express",
          runtime: "node",
          buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci"),
          startCommand: normalizeStartCommand(scripts.start ?? "node dist/index.js"),
          restartCommand: "pm2 restart {projectSlug}",
          hints
        };
      }
      if (deps.fastify || deps.hono) {
        hints.push("package.json: node server");
        return {
          framework: "nodejs",
          runtime: "node",
          buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci"),
          startCommand: normalizeStartCommand(scripts.start ?? "node dist/index.js"),
          restartCommand: "pm2 restart {projectSlug}",
          hints
        };
      }
      hints.push("package.json: present (fallback node)");
      return {
        framework: "nodejs",
        runtime: "node",
        buildCommand: normalizeBuildCommand(scripts.build ?? "npm ci"),
        startCommand: normalizeStartCommand(scripts.start ?? "npm run start"),
        restartCommand: "pm2 restart {projectSlug}",
        hints
      };
    }
  }

  if (input.composerJson) {
    const parsed = tryParseJson(input.composerJson);
    if (isRecord(parsed) && isRecord(parsed.require) && parsed.require["laravel/framework"]) {
      hints.push(input.artisan ? "artisan + composer.json: laravel" : "composer.json: laravel");
      return {
        framework: "laravel",
        runtime: "php-fpm",
        buildCommand: normalizeBuildCommand(LARAVEL_COMPOSER_BUILD, {
          framework: "laravel",
          runtime: "php-fpm"
        }),
        startCommand: "php artisan serve --host=0.0.0.0 --port=${PORT}",
        restartCommand: PHP_FPM_RELOAD,
        hints
      };
    }
    hints.push("composer.json: php");
    return {
      framework: "php",
      runtime: "php-fpm",
      buildCommand: normalizeBuildCommand(LARAVEL_COMPOSER_BUILD, {
        framework: "php",
        runtime: "php-fpm"
      }),
      startCommand: "php -S 0.0.0.0:${PORT} -t public",
      restartCommand: PHP_FPM_RELOAD,
      hints
    };
  }

  if (input.pyprojectToml || input.requirementsTxt) {
    const py = input.pyprojectToml ?? "";
    const req = input.requirementsTxt ?? "";
    const pipBuild = input.requirementsTxt
      ? "python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt"
      : "python3 -m venv .venv && . .venv/bin/activate && pip install .";
    if (/django/i.test(py) || /django/i.test(req)) {
      hints.push("python: django");
      return {
        framework: "django",
        runtime: "python",
        buildCommand: pipBuild,
        startCommand:
          ". .venv/bin/activate && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT}",
        restartCommand: "pm2 restart {projectSlug}",
        hints
      };
    }
    if (/fastapi/i.test(py) || /fastapi/i.test(req)) {
      hints.push("python: fastapi");
      return {
        framework: "fastapi",
        runtime: "python",
        buildCommand: pipBuild,
        startCommand: ". .venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port ${PORT}",
        restartCommand: "pm2 restart {projectSlug}",
        hints
      };
    }
    hints.push("python");
    return {
      framework: "python",
      runtime: "python",
      buildCommand: pipBuild,
      startCommand: ". .venv/bin/activate && python main.py",
      restartCommand: "pm2 restart {projectSlug}",
      hints
    };
  }

  if (input.goMod) {
    hints.push("go.mod");
    return {
      framework: "go",
      runtime: "go",
      buildCommand: "go build -o app .",
      startCommand: "./app",
      restartCommand: "pm2 restart {projectSlug}",
      hints
    };
  }

  if (docker) {
    hints.push("Dockerfile");
    return {
      framework: "docker",
      runtime: "docker",
      buildCommand: "docker build -t app .",
      startCommand: "docker run -d -p ${PORT}:${PORT} app",
      restartCommand: "docker restart {projectSlug}",
      hints
    };
  }

  if (
    input.indexHtml &&
    !input.packageJson &&
    !input.composerJson &&
    !input.requirementsTxt &&
    !input.pyprojectToml &&
    !input.goMod &&
    !docker
  ) {
    hints.push("index.html at repo root");
    return {
      framework: "static",
      runtime: "static",
      buildCommand: "",
      startCommand: "",
      restartCommand: "",
      hints
    };
  }

  return {
    framework: "static",
    runtime: "static",
    buildCommand: "",
    startCommand: "",
    restartCommand: "",
    hints: ["no recognized manifest; default static"]
  };
}
