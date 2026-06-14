"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { inviteUserAction } from "./actions";

type Role = "owner" | "agent" | "viewer";

type Member = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "agent", label: "Agent" },
  { value: "viewer", label: "Viewer" },
];

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function TeamPanel({ members, canInvite }: { members: Member[]; canInvite: boolean }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [isPending, startTransition] = useTransition();

  function onInvite(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim();
    if (!em) {
      toast.error("Enter an email to invite.");
      return;
    }
    startTransition(async () => {
      const r = await inviteUserAction({ email: em, name: name.trim(), role });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Teammate invited.");
      setEmail("");
      setName("");
      setRole("agent");
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No teammates yet.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.email}</TableCell>
                  <TableCell>{m.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{roleLabel(m.role)}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {canInvite ? (
        <form onSubmit={onInvite} className="space-y-4 rounded-lg border p-4">
          <h3 className="text-sm font-medium">Invite a teammate</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@brand.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Inviting…" : "Send invite"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Only owners can invite teammates.</p>
      )}
    </div>
  );
}
