"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createServerFormSchema,
  updateServerFormSchema,
  type ServerFormValues
} from "@/lib/schemas/server";
import { DEFAULT_VPS_DEPLOY_ROOT } from "@/lib/server-layout";
import {
  createServerAction,
  updateServerAction
} from "@/app/dashboard/servers/actions";

const WEB_STACK_OPTIONS = [
  { value: "none", label: "None (not documented)" },
  { value: "nginx", label: "Nginx" },
  { value: "apache", label: "Apache" },
  { value: "caddy", label: "Caddy" }
] as const;

const textareaClass =
  "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export function ServerForm({
  mode,
  serverId,
  defaultValues,
  onSuccess
}: {
  mode: "create" | "edit";
  serverId?: string;
  defaultValues?: Partial<ServerFormValues>;
  onSuccess?: () => void;
}) {
  const schema = mode === "create" ? createServerFormSchema : updateServerFormSchema;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ServerFormValues>({
    resolver: zodResolver(schema) as Resolver<ServerFormValues>,
    defaultValues: {
      name: "",
      host: "",
      sshUser: "deploy",
      webStack: "none",
      reverseProxyNotes: "",
      tlsCertPath: "",
      tlsKeyPath: "",
      reverseProxyConfigPath: "",
      deployRoot: DEFAULT_VPS_DEPLOY_ROOT,
      sshPrivateKey: "",
      ...defaultValues
    }
  });

  async function onSubmit(values: ServerFormValues) {
    const payload = {
      ...values,
      reverseProxyNotes: values.reverseProxyNotes ?? "",
      tlsCertPath: values.tlsCertPath ?? "",
      tlsKeyPath: values.tlsKeyPath ?? "",
      reverseProxyConfigPath: values.reverseProxyConfigPath ?? ""
    };

    if (mode === "create") {
      const res = await createServerAction({
        ...payload,
        sshPrivateKey: values.sshPrivateKey ?? ""
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Server added");
    } else if (serverId) {
      const res = await updateServerAction({
        id: serverId,
        ...payload,
        sshPrivateKey: values.sshPrivateKey?.trim() || undefined
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Server updated");
    }
    onSuccess?.();
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" {...register("name")} placeholder="Production VPS" />
        {errors.name ? (
          <p className="text-destructive text-xs">{errors.name.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="host">Host / IP</Label>
        <Input id="host" {...register("host")} placeholder="203.0.113.10" />
        {errors.host ? (
          <p className="text-destructive text-xs">{errors.host.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="sshUser">SSH user</Label>
        <Input id="sshUser" {...register("sshUser")} placeholder="deploy" />
        {errors.sshUser ? (
          <p className="text-destructive text-xs">{errors.sshUser.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="sshPrivateKey">
          {mode === "create" ? "Private key (PEM)" : "New private key (optional)"}
        </Label>
        <textarea
          id="sshPrivateKey"
          rows={mode === "create" ? 8 : 6}
          className={textareaClass}
          placeholder={
            mode === "create"
              ? "-----BEGIN OPENSSH PRIVATE KEY-----"
              : "Leave empty to keep the existing encrypted key"
          }
          {...register("sshPrivateKey")}
        />
        {errors.sshPrivateKey ? (
          <p className="text-destructive text-xs">{errors.sshPrivateKey.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="deployRoot">VPS deploy root</Label>
        <Input
          id="deployRoot"
          {...register("deployRoot")}
          placeholder={DEFAULT_VPS_DEPLOY_ROOT}
          autoComplete="off"
        />
        <p className="text-muted-foreground text-xs">
          Central stores apps, configs, data, and logs under this path (e.g.{" "}
          <span className="font-mono">{DEFAULT_VPS_DEPLOY_ROOT}/apps/&lt;slug&gt;</span>).
        </p>
        {errors.deployRoot ? (
          <p className="text-destructive text-xs">{errors.deployRoot.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="webStack">Web / reverse proxy</Label>
        <Controller
          name="webStack"
          control={control}
          render={({ field }) => (
            <select
              id="webStack"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={field.value}
              onChange={field.onChange}
            >
              {WEB_STACK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reverseProxyNotes">Reverse-proxy notes (optional)</Label>
        <textarea
          id="reverseProxyNotes"
          rows={4}
          className={textareaClass}
          placeholder="e.g. upstream port, extra context"
          {...register("reverseProxyNotes")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tlsCertPath">TLS certificate path on server (optional)</Label>
        <Input
          id="tlsCertPath"
          {...register("tlsCertPath")}
          placeholder="/etc/letsencrypt/live/example/fullchain.pem"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tlsKeyPath">TLS private key path on server (optional)</Label>
        <Input
          id="tlsKeyPath"
          {...register("tlsKeyPath")}
          placeholder="/etc/letsencrypt/live/example/privkey.pem"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reverseProxyConfigPath">Reverse-proxy config path (optional)</Label>
        <Input
          id="reverseProxyConfigPath"
          {...register("reverseProxyConfigPath")}
          placeholder="/etc/nginx/sites-available/myapp.conf"
          autoComplete="off"
        />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : mode === "create" ? "Save server" : "Save changes"}
      </Button>
    </form>
  );
}
