"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2, Shield, Key, Users, Copy, Plus, LogOut, Check,
  ArrowRight, Code2, Terminal, ChevronDown, ChevronUp, Github,
} from "lucide-react";
import { authClient } from "@/lib/better-auth/client";

interface Project {
  id: string;
  name: string;
  apiKey: string;
  userCount: number;
  createdAt: string;
}

type View = "loading" | "auth" | "dashboard";

function ApiPlayground({ apiKey }: { apiKey: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<string>("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const steps = [
    { label: "Register a user", desc: "Create a test user via the API" },
    { label: "Verify token", desc: "Check that the returned token works" },
  ];

  const runStep = async () => {
    setLoading(true);
    setResult("");

    if (step === 0) {
      const testEmail = `test${Date.now()}@example.com`;
      try {
        const res = await fetch("/api/v1/auth/register", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: testEmail, password: "testpass123", name: "Test User" }),
        });
        const data = await res.json();
        setResult(JSON.stringify(data, null, 2));
        if (data.token) setToken(data.token);
        toast.success("User registered! Token received.");
      } catch (e) {
        setResult(`Error: ${e}`);
      }
    } else if (step === 1 && token) {
      try {
        const res = await fetch("/api/v1/auth/me", {
          headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await res.json();
        setResult(JSON.stringify(data, null, 2));
        toast.success(res.ok ? "Token is valid!" : "Token verification failed.");
      } catch (e) {
        setResult(`Error: ${e}`);
      }
    }

    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">API Playground</CardTitle>
        </div>
        <CardDescription>Test the service API without leaving this page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {steps.map((s, i) => (
            <button
              key={i}
              onClick={() => { setStep(i); setResult(""); }}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                step === i
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{steps[step].desc}</p>

        <button
          onClick={() => setShowCode(!showCode)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Code2 className="h-3 w-3" />
          {showCode ? "Hide" : "Show"} curl command
          {showCode ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showCode && (
          <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto">
            {step === 0 ? (
              `curl -X POST /api/v1/auth/register \\\n  -H "Authorization: Bearer ${apiKey.slice(0, 12)}..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"email": "user@example.com", "password": "testpass123"}'`
            ) : (
              `curl /api/v1/auth/me \\\n  -H "Authorization: Bearer ${token ? token.slice(0, 20) + "..." : "<token from step 1>"}`
            )}
          </pre>
        )}

        <Button onClick={runStep} disabled={loading || (step === 1 && !token)}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Run Step {step + 1}
        </Button>

        {result && (
          <div className="relative rounded-lg bg-muted p-4">
            <button
              onClick={() => navigator.clipboard.writeText(result)}
              className="absolute right-2 top-2 p-1 rounded hover:bg-border"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <pre className="text-xs overflow-x-auto pr-8">{result}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApiDocs() {
  const [openEndpoint, setOpenEndpoint] = useState<string | null>(null);

  const endpoints = [
    {
      method: "POST",
      path: "/api/v1/auth/register",
      desc: "Register a new user",
      auth: "API Key",
      body: '{ "email": "user@example.com", "password": "secret123", "name": "John" }',
      response: '{ "message": "User registered", "token": "eyJ...", "user": { "id": "...", "email": "...", "emailVerified": false } }',
    },
    {
      method: "POST",
      path: "/api/v1/auth/login",
      desc: "Authenticate an existing user",
      auth: "API Key",
      body: '{ "email": "user@example.com", "password": "secret123" }',
      response: '{ "message": "Login successful", "token": "eyJ...", "user": { "id": "...", "email": "..." } }',
    },
    {
      method: "POST",
      path: "/api/v1/auth/otp/send",
      desc: "Generate an OTP (returns code for delivery by your app)",
      auth: "API Key + userId in body, OR Service Token",
      body: '{ "userId": "svc_xxx" }',
      response: '{ "message": "OTP generated", "code": "673755", "expiresIn": 600 }',
    },
    {
      method: "POST",
      path: "/api/v1/auth/otp/verify",
      desc: "Verify an OTP code",
      auth: "API Key + userId in body, OR Service Token",
      body: '{ "code": "673755" }',
      response: '{ "message": "Email verified", "token": "eyJ...(new)", "user": { "emailVerified": true } }',
    },
    {
      method: "GET",
      path: "/api/v1/auth/me",
      desc: "Verify a service token, get user info",
      auth: "Service Token (Bearer)",
      body: null,
      response: '{ "user": { "id": "...", "email": "...", "name": "...", "emailVerified": true }, "projectId": "..." }',
    },
  ];

  const methodColors: Record<string, string> = {
    GET: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    POST: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">API Reference</CardTitle>
        </div>
        <CardDescription>
          All endpoints require your API key in the <code className="text-xs bg-muted px-1 rounded">Authorization: Bearer ak_xxx</code> header.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {endpoints.map((ep) => (
          <div key={ep.path} className="rounded-lg border">
            <button
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
              onClick={() => setOpenEndpoint(openEndpoint === ep.path ? null : ep.path)}
            >
              <span className={`text-xs font-bold px-2 py-1 rounded ${methodColors[ep.method]}`}>
                {ep.method}
              </span>
              <code className="text-sm font-mono flex-1">{ep.path}</code>
              <span className="text-xs text-muted-foreground hidden sm:block">{ep.desc}</span>
              {openEndpoint === ep.path ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {openEndpoint === ep.path && (
              <div className="border-t p-4 space-y-3 text-sm">
                <p className="text-muted-foreground">{ep.desc}</p>
                <div>
                  <span className="font-medium">Auth:</span>{" "}
                  <span className="text-muted-foreground">{ep.auth}</span>
                </div>
                {ep.body && (
                  <div>
                    <span className="font-medium">Request Body:</span>
                    <pre className="mt-1 rounded bg-muted p-2 text-xs">{ep.body}</pre>
                  </div>
                )}
                <div>
                  <span className="font-medium">Response:</span>
                  <pre className="mt-1 rounded bg-muted p-2 text-xs">{ep.response}</pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { data: session, isPending: sessionLoading, refetch: refetchSession } = authClient.useSession();
  const [view, setView] = useState<View>("loading");
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) {
      if (session) {
        loadProjects();
        setView("dashboard");
      } else {
        setView("auth");
      }
    }
  }, [session, sessionLoading, loadProjects]);

  // ── BETTERAUTH PORTAL AUTH ────────────────────────────────────────
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ email: "", password: "", name: "" });
  const [authLoading, setAuthLoading] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  const handleLogin = async () => {
    setAuthLoading(true);
    const { error } = await authClient.signIn.email({
      email: loginForm.email,
      password: loginForm.password,
    });
    if (error) {
      toast.error(error.message || error.statusText || "Invalid email or password");
      setAuthLoading(false);
      return;
    }
    toast.success("Welcome back!");
    await refetchSession();
    loadProjects();
    setView("dashboard");
    setAuthLoading(false);
  };

  const handleRegister = async () => {
    setAuthLoading(true);
    const { error } = await authClient.signUp.email({
      email: registerForm.email,
      password: registerForm.password,
      name: registerForm.name,
    });
    if (error) {
      toast.error(error.message || error.statusText || "Failed to create account");
      setAuthLoading(false);
      return;
    }
    toast.success("Account created!");
    await refetchSession();
    loadProjects();
    setView("dashboard");
    setAuthLoading(false);
  };

  const handleSocialSignIn = async (provider: "google" | "github" | "discord") => {
    await authClient.signIn.social({ provider, callbackURL: "/" });
  };

  const handleMagicLink = async () => {
    if (!magicLinkEmail) return;
    setMagicLinkLoading(true);
    const { error } = await authClient.signIn.magicLink({
      email: magicLinkEmail,
      callbackURL: "/",
    });
    if (error) {
      toast.error(error.message || "Failed to send magic link");
      setMagicLinkLoading(false);
      return;
    }
    setMagicLinkSent(true);
    setMagicLinkLoading(false);
    toast.success("Magic link sent! Check your email (or server console).");
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) return;
    const { error } = await authClient.requestPasswordReset({
      email: forgotPasswordEmail,
      redirectTo: "/reset-password",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setResetSent(true);
    toast.success("Password reset link sent to your email!");
  };

  const handleLogout = async () => {
    await authClient.signOut();
    setProjects([]);
    setSelectedProject(null);
    setView("auth");
    toast.success("Logged out");
  };

  // ── PROJECTS ──────────────────────────────────────────────────────
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const res = await fetch("/api/portal/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(`Project "${data.project.name}" created!`);
      setProjects([data.project, ...projects]);
      setNewProjectName("");
      setShowApiKey(data.project.apiKey);
    } catch { toast.error("Failed to create project"); }
    finally { setCreatingProject(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  // ── LOADING ───────────────────────────────────────────────────────
  if (sessionLoading || view === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── AUTH FORMS ────────────────────────────────────────────────────
  if (view === "auth") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Auth Service Portal</CardTitle>
            <CardDescription>
              Sign up to get API keys and manage your projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="register" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="dev@example.com" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-pass">Password</Label>
                    <Input id="login-pass" type="password" placeholder="••••••••" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required minLength={8} />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Button variant="outline" onClick={() => handleSocialSignIn("google")} className="w-full">
                    <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  </Button>
                  <Button variant="outline" onClick={() => handleSocialSignIn("github")} className="w-full">
                    <Github className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => handleSocialSignIn("discord")} className="w-full">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                  </Button>
                </div>

                {/* Magic Link — passwordless email sign-in */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or sign in without a password</span>
                  </div>
                </div>

                {magicLinkSent ? (
                  <div className="text-center py-4 space-y-2">
                    <Check className="h-8 w-8 text-green-500 mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Magic link sent to <strong>{magicLinkEmail}</strong>!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Check the server console for the link (dev mode).
                    </p>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleMagicLink(); }}
                    className="space-y-3"
                  >
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="dev@example.com"
                        value={magicLinkEmail}
                        onChange={(e) => setMagicLinkEmail(e.target.value)}
                        required
                        className="flex-1"
                      />
                      <Button type="submit" disabled={magicLinkLoading || !magicLinkEmail.trim()}>
                        {magicLinkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      We'll send you a one-click sign-in link. No password needed.
                    </p>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Name</Label>
                    <Input id="reg-name" type="text" placeholder="Jane Developer" value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input id="reg-email" type="email" placeholder="dev@example.com" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-pass">Password</Label>
                    <Input id="reg-pass" type="password" placeholder="Min. 8 characters" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} required minLength={8} />
                  </div>
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Button variant="outline" onClick={() => handleSocialSignIn("google")} className="w-full">
                    <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  </Button>
                  <Button variant="outline" onClick={() => handleSocialSignIn("github")} className="w-full">
                    <Github className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => handleSocialSignIn("discord")} className="w-full">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Forgot Password Dialog */}
            <Dialog open={showForgotPassword} onOpenChange={() => { setShowForgotPassword(false); setResetSent(false); }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset Password</DialogTitle>
                  <DialogDescription>
                    Enter your email and we will send you a password reset link.
                  </DialogDescription>
                </DialogHeader>
                {resetSent ? (
                  <div className="text-center py-4 space-y-2">
                    <Check className="h-8 w-8 text-green-500 mx-auto" />
                    <p className="text-sm text-muted-foreground">Check your email for the reset link.</p>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleForgotPassword(); }} className="space-y-4">
                    <Input
                      type="email"
                      placeholder="dev@example.com"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      required
                    />
                    <Button type="submit" className="w-full">Send Reset Link</Button>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">Auth Service</span>
            <Badge variant="outline" className="hidden sm:inline-flex">v1</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{session?.user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl p-4 space-y-6">
        <Dialog open={!!showApiKey} onOpenChange={() => setShowApiKey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>API Key Created</DialogTitle>
              <DialogDescription>
                Copy this key now. You won&apos;t be able to see it again after closing this dialog.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-muted p-3 text-sm break-all select-all">{showApiKey}</code>
              <Button onClick={() => copyToClipboard(showApiKey!)} size="icon" variant="outline">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use this key in the <code>Authorization: Bearer ak_xxx</code> header when calling the service API.
            </p>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Your Projects</CardTitle>
                <CardDescription>Each project gets its own API key and isolated user database.</CardDescription>
              </div>
              <Badge variant="secondary">{projects.length} project{projects.length !== 1 ? "s" : ""}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="My App Name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                className="max-w-xs"
              />
              <Button onClick={handleCreateProject} disabled={creatingProject || !newProjectName.trim()}>
                {creatingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="ml-1">Create</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No projects yet. Create one above to get your API key.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                className={`cursor-pointer transition-colors hover:border-primary/50 ${selectedProject?.id === project.id ? "border-primary" : ""}`}
                onClick={() => setSelectedProject(project)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(project.apiKey); }}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Copy API key"
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                      {showApiKey === project.apiKey ? project.apiKey : `${project.apiKey.slice(0, 16)}...${project.apiKey.slice(-4)}`}
                    </code>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowApiKey(project.apiKey); }}
                      className="text-xs text-primary hover:underline"
                    >
                      Reveal
                    </button>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {project.userCount} user{project.userCount !== 1 ? "s" : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {selectedProject && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">{selectedProject.name}</h2>
              <Badge variant="outline" className="text-xs">{selectedProject.apiKey.slice(0, 16)}...</Badge>
            </div>

            <ApiPlayground apiKey={selectedProject.apiKey} />
            <ApiDocs />
          </div>
        )}
      </main>
    </div>
  );
}
