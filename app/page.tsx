import Link from "next/link";
import { redirect } from "next/navigation";
import {
  UploadCloud,
  FolderTree,
  GitBranch,
  ShieldCheck,
  History,
  Zap,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { GitHubLoginButton } from "@/components/github-login-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: UploadCloud,
    title: "Drag & drop upload",
    body: "Drop a .zip of any project. We validate size, file count, and scan for dangerous file types.",
  },
  {
    icon: FolderTree,
    title: "File tree preview",
    body: "Inspect the exact directory structure before anything is published. Nested folders preserved.",
  },
  {
    icon: GitBranch,
    title: "One-click publish",
    body: "Create a new repo or pick an existing one, set a branch and commit message, and ship.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    body: "GitHub OAuth, encrypted access tokens, path-traversal and ZIP-bomb protection.",
  },
  {
    icon: History,
    title: "Activity history",
    body: "Every publish is logged with commit hash, status, and full logs. Retry failed jobs.",
  },
  {
    icon: Zap,
    title: "Real-time progress",
    body: "Watch extraction, commit, and push happen live with streaming progress updates.",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    blurb: "For personal projects",
    items: ["50 MB uploads", "Unlimited public repos", "Activity history"],
  },
  {
    name: "Pro",
    price: "$9",
    blurb: "For active developers",
    items: ["500 MB uploads", "Private repos", "Priority publishing", "Retry & logs"],
    featured: true,
  },
  {
    name: "Team",
    price: "$29",
    blurb: "For small teams",
    items: ["Everything in Pro", "Multi-repo publishing", "Scheduled publishing", "Shared activity"],
  },
];

const faqs = [
  {
    q: "Do you store my code?",
    a: "Your ZIP is stored only temporarily while it is being published, then removed. We never keep a permanent copy of your source.",
  },
  {
    q: "Do you need my GitHub password?",
    a: "Never. We use GitHub OAuth. Your access token is encrypted at rest and only used to create repositories and push your files.",
  },
  {
    q: "How are files published?",
    a: "We use the GitHub Git Data API to create blobs, a tree, and a commit, then update the branch — no local git binary required.",
  },
  {
    q: "What about huge archives?",
    a: "Uploads are size-limited and screened for ZIP bombs and executables. Limits are configurable by the operator.",
  },
];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="flex items-center gap-2 font-semibold">
          <UploadCloud className="size-5" />
          ZipShip
        </div>
        <nav className="flex items-center gap-6 text-sm text-zinc-600 dark:text-zinc-400">
          <a href="#features" className="hidden hover:text-zinc-900 sm:block dark:hover:text-zinc-50">
            Features
          </a>
          <a href="#pricing" className="hidden hover:text-zinc-900 sm:block dark:hover:text-zinc-50">
            Pricing
          </a>
          <a href="#faq" className="hidden hover:text-zinc-900 sm:block dark:hover:text-zinc-50">
            FAQ
          </a>
          <GitHubLoginButton size="sm" label="Sign in" />
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center">
        <Badge variant="secondary">ZIP → GitHub in one click</Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Publish a project ZIP straight to GitHub
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Upload an archive, preview the file tree, choose a repository, and
          push every file and folder to GitHub — without touching the command
          line.
        </p>
        <div className="flex flex-col items-center gap-3">
          <GitHubLoginButton size="lg" />
          <span className="text-xs text-zinc-500">
            Uses GitHub OAuth. No passwords, no personal access tokens.
          </span>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-semibold">Features</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <f.icon className="size-6 text-zinc-700 dark:text-zinc-300" />
                <CardTitle className="text-base">{f.title}</CardTitle>
                <CardDescription>{f.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-semibold">Pricing</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((p) => (
            <Card
              key={p.name}
              className={p.featured ? "border-zinc-900 dark:border-zinc-50" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{p.name}</CardTitle>
                  {p.featured && <Badge>Popular</Badge>}
                </div>
                <CardDescription>{p.blurb}</CardDescription>
                <div className="pt-2 text-3xl font-bold">
                  {p.price}
                  <span className="text-sm font-normal text-zinc-500">/mo</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {p.items.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto w-full max-w-3xl px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-semibold">FAQ</h2>
        <div className="space-y-4">
          {faqs.map((f) => (
            <Card key={f.q}>
              <CardHeader>
                <CardTitle className="text-base">{f.q}</CardTitle>
                <CardDescription>{f.a}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 px-6 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
        <div className="flex items-center justify-center gap-2">
          <GitBranch className="size-4" />
          <span>ZipShip — built with Next.js & the GitHub API</span>
        </div>
        <p className="mt-2">
          <Link href="/dashboard" className="hover:underline">
            Go to dashboard
          </Link>
        </p>
      </footer>
    </div>
  );
}
