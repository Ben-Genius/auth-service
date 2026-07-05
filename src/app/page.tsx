// =============================================================================
// DEVELOPER PORTAL UI
// =============================================================================
// This is the website developers visit to:
// 1. Create their account
// 2. Create projects (each gets an API key)
// 3. See their API key and copy it
// 4. View user counts per project
// 5. Test the API from a built-in playground
// 6. Read API documentation
// =============================================================================

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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, Shield, Key, Users, Copy, Plus, LogOut, Check,
  ArrowRight, Code2, Terminal, ChevronDown, ChevronUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
interface Developer {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  apiKey: string;
  userCount: number;
  createdAt: string;
}

type View = "loading" | "auth" | "dashboard";

// ---------------------------------------------------------------------------
// API PLAYGROUND COMPONENT
// ---------------------------------------------------------------------------
// This lets developers test the service API directly from the portal.
// No Postman or curl needed — great UX for learning!
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
      // Register a user
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
      // Verify the token
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
        {/* Step selector */}
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

        {/* Code preview */}
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

// ---------------------------------------------------------------------------
// API DOCS COMPONENT
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
export default function Home() {
  const [view, setView] = useState<View>("loading");
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/auth/me");
      if (res.ok) {
        const data = await res.json();
        setDeveloper(data.developer);
        // Load projects
        const projRes = await fetch("/api/portal/projects");
        if (projRes.ok) {
          const projData = await projRes.json();
          setProjects(projData.projects);
        }
        setView("dashboard");
      } else {
        setView("auth");
      }
    } catch {
      setView("auth");
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  // -------------------------------------------------------------------------
  // PORTAL AUTH
  // -------------------------------------------------------------------------
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ email: "", password: "", name: "" });
  const [authLoading, setAuthLoading] = useState(false);

  const handlePortalAuth = async (endpoint: "login" | "register", form: typeof loginForm) => {
    setAuthLoading(true);
    try {
      const res = await fetch(`/api/portal/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(endpoint === "register" ? "Account created!" : "Welcome back!");
      setDeveloper(data.developer);
      setView("dashboard");
      // Load projects
      const projRes = await fetch("/api/portal/projects");
      if (projRes.ok) {
        const projData = await projRes.json();
        setProjects(projData.projects);
      }
    } catch { toast.error("Something went wrong"); }
    finally { setAuthLoading(false); }
  };

  // -------------------------------------------------------------------------
  // PROJECTS
  // -------------------------------------------------------------------------
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

  const handleLogout = async () => {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    setDeveloper(null);
    setProjects([]);
    setSelectedProject(null);
    setView("auth");
    toast.success("Logged out");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  // =========================================================================
  // RENDER: LOADING
  // =========================================================================
  if (view === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // =========================================================================
  // RENDER: AUTH FORMS
  // =========================================================================
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
                <form onSubmit={(e) => { e.preventDefault(); handlePortalAuth("login", loginForm); }} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="dev@example.com" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-pass">Password</Label>
                    <Input id="login-pass" type="password" placeholder="••••••••" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required minLength={8} />
                  </div>
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={(e) => { e.preventDefault(); handlePortalAuth("register", registerForm); }} className="space-y-4 mt-4">
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
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // RENDER: DASHBOARD
  // =========================================================================
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">Auth Service</span>
            <Badge variant="outline" className="hidden sm:inline-flex">v1</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{developer?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 mx-auto w-full max-w-5xl p-4 space-y-6">
        {/* API Key reveal dialog */}
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

        {/* Create project */}
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

        {/* Project list */}
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

        {/* Selected project: Playground + Docs */}
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