import React, { useEffect, useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import {
  MIN_PASSWORD_LENGTH,
  createAccount,
  getLastAccount,
  getSession,
  listAccounts,
  removeAccount,
  signIn,
  type Account,
} from "./authStore";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

type Mode = "signin" | "signup";

// After signing in or creating the account, you land on the Vault
const goToVault = () => window.location.replace(chrome.runtime.getURL("options.html#/vault"));
const legalUrl = (page: "terms" | "privacy") => chrome.runtime.getURL(`options.html#/${page}`);

export function AuthApp() {
  const [ready, setReady] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lastEmail, setLastEmail] = useState("");
  const [mode, setMode] = useState<Mode>("signup");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      if (await getSession()) return goToVault(); // already signed in
      const all = await listAccounts();
      setAccounts(all);
      setLastEmail((await getLastAccount())?.email ?? "");
      setMode(all.length > 0 ? "signin" : "signup");
      setReady(true);
    })();
  }, []);

  const switchMode = (next: string) => {
    setError("");
    setNotice("");
    setResetEmail(null);
    setMode(next as Mode);
  };

  const run = async (action: () => Promise<unknown>) => {
    setError("");
    setBusy(true);
    try {
      await action();
      goToVault();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  const target = accounts.find((x) => x.email === (resetEmail ?? "").trim().toLowerCase());

  const eraseAccount = async () => {
    if (!target) return;
    setBusy(true);
    await removeAccount(target.id);
    const left = await listAccounts();
    setAccounts(left);
    setResetEmail(null);
    setError("");
    setNotice("Account erased. You can sign in with another account or create a new one.");
    if (left.length === 0) setMode("signup");
    setBusy(false);
  };

  if (!ready) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px] space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Data Firewall</h1>
            <p className="mt-1 text-sm text-muted-foreground">The internet can ask. You decide what it gets.</p>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-5 p-6">
            <Tabs value={mode} onValueChange={switchMode}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-5">
                {accounts.length > 0 ? (
                  <SignInForm
                    defaultEmail={lastEmail}
                    busy={busy}
                    onSubmit={(email, password, remember) => run(() => signIn(email, password, remember))}
                    onForgot={(email) => setResetEmail(resetEmail === null ? email : null)}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    There are no accounts on this device yet.{" "}
                    <button className="text-primary hover:underline" onClick={() => switchMode("signup")}>
                      Create one
                    </button>
                    .
                  </p>
                )}
              </TabsContent>

              <TabsContent value="signup" className="mt-5">
                <SignUpForm
                  busy={busy}
                  onSubmit={(name, email, password, remember) => run(() => createAccount({ name, email, password }, remember))}
                />
              </TabsContent>
            </Tabs>

            {error && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {notice && (
              <Alert variant="success">
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}

            {resetEmail !== null && mode === "signin" && (
              <Alert variant="warning">
                <AlertDescription className="space-y-3">
                  {target ? (
                    <p>
                      A forgotten password can't be recovered, because nothing ever leaves your device. You can erase the account for{" "}
                      <span className="font-medium text-foreground">{target.email}</span> and everything stored with it (its vault,
                      activity and companies) and start over. Other accounts on this device are not affected.
                    </p>
                  ) : (
                    <p>Type the email of the account you can't get into, then choose Forgot password again.</p>
                  )}
                  <div className="flex gap-2">
                    {target && (
                      <Button size="sm" variant="destructive" disabled={busy} onClick={eraseAccount}>
                        Erase this account
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setResetEmail(null)}>
                      Cancel
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Your account and details stay on this device. Nothing is sent to a server.
          <br />
          <a href={legalUrl("terms")} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            Terms of Use
          </a>
          {" · "}
          <a href={legalUrl("privacy")} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}

// ── Forms ────────────────────────────────────────────────────────────────────

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="pr-10"
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SignInForm({
  defaultEmail,
  busy,
  onSubmit,
  onForgot,
}: {
  defaultEmail: string;
  busy: boolean;
  onSubmit: (email: string, password: string, remember: boolean) => void;
  onForgot: (email: string) => void;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(email, password, remember);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="si-email">Email</Label>
        <Input id="si-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="si-password">Password</Label>
          <button type="button" onClick={() => onForgot(email)} className="text-xs text-muted-foreground hover:text-foreground">
            Forgot password?
          </button>
        </div>
        <PasswordInput id="si-password" value={password} onChange={setPassword} autoComplete="current-password" />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
        Keep me signed in on this device
      </label>
      <Button type="submit" className="w-full" disabled={busy || !password}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignUpForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (name: string, email: string, password: string, remember: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [remember, setRemember] = useState(false);
  const [localError, setLocalError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setLocalError("The two passwords don't match.");
    setLocalError("");
    onSubmit(name, email, password, remember);
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label htmlFor="su-name">Name</Label>
        <Input id="su-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-password">Password</Label>
        <PasswordInput
          id="su-password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-confirm">Confirm password</Label>
        <PasswordInput id="su-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
        Keep me signed in on this device
      </label>

      <label className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
        <Checkbox className="mt-0.5" checked={agree} onCheckedChange={(v) => setAgree(v === true)} />
        <span>
          I agree to the{" "}
          <a href={legalUrl("terms")} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Terms of Use
          </a>{" "}
          and{" "}
          <a href={legalUrl("privacy")} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Privacy Policy
          </a>
        </span>
      </label>

      {localError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={busy || !agree || !name || !email || !password}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
