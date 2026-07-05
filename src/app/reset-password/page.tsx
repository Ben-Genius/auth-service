"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Shield, Check, KeyRound } from "lucide-react";
import { authClient } from "@/lib/better-auth/client";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="text-center py-8 space-y-3">
        <KeyRound className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
        <p className="text-sm text-muted-foreground">Invalid or missing reset token.</p>
        <Button variant="outline" onClick={() => router.push("/")}>Back to Portal</Button>
      </div>
    );
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    const { error } = await authClient.resetPassword({
      newPassword,
      token,
    });
    if (error) {
      toast.error(error.message || "Failed to reset password");
      setLoading(false);
      return;
    }
    setDone(true);
    toast.success("Password reset successfully!");
    setTimeout(() => router.push("/"), 2000);
  };

  if (done) {
    return (
      <div className="text-center py-8 space-y-3">
        <Check className="h-10 w-10 text-green-500 mx-auto" />
        <p className="text-sm font-medium">Password reset successful!</p>
        <p className="text-sm text-muted-foreground">Redirecting to portal...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          placeholder="Min. 8 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm Password</Label>
        <Input
          id="confirm-password"
          type="password"
          placeholder="Repeat your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Reset Password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>Enter your new password below.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
