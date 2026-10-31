"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export default function ConfigPage() {
  const [guildId, setGuildId] = React.useState("");
  const [notificationChannelId, setNotificationChannelId] = React.useState("");
  const [pingRoleId, setPingRoleId] = React.useState("");
  const [timezone, setTimezone] = React.useState("UTC");
  const [titleLanguage, setTitleLanguage] = React.useState("ROMAJI");
  const [airingAlertsEnabled, setAiringAlertsEnabled] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    if (!guildId) {
      toast.error("Please enter a Discord Guild ID.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/config/server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          notificationChannelId: notificationChannelId || null,
          pingRoleId: pingRoleId || null,
          timezone,
          titleLanguage,
          airingAlertsEnabled,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to save config.",
        );
      }

      toast.success("Server config saved!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save config.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Server Config</h1>
        <p className="mt-1 text-muted-foreground">
          Configure your Discord server's AniSync settings
        </p>
      </div>

      <Card className="border-space-700 bg-space-800">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">
            Discord Server
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              Guild ID
            </label>
            <Input
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              placeholder="Enter your Discord server's Guild ID"
              className="border-space-600 bg-space-700"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              Notification Channel ID
            </label>
            <Input
              value={notificationChannelId}
              onChange={(e) => setNotificationChannelId(e.target.value)}
              placeholder="Channel for airing alerts"
              className="border-space-600 bg-space-700"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              Ping Role ID
            </label>
            <Input
              value={pingRoleId}
              onChange={(e) => setPingRoleId(e.target.value)}
              placeholder="Role to ping for notifications"
              className="border-space-600 bg-space-700"
            />
          </div>

          <Separator className="my-2" />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              Timezone
            </label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="border-space-600 bg-space-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern (US)</SelectItem>
                <SelectItem value="America/Chicago">Central (US)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific (US)</SelectItem>
                <SelectItem value="Europe/London">London</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              Title Language
            </label>
            <Select value={titleLanguage} onValueChange={setTitleLanguage}>
              <SelectTrigger className="border-space-600 bg-space-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ROMAJI">Romaji</SelectItem>
                <SelectItem value="ENGLISH">English</SelectItem>
                <SelectItem value="NATIVE">Native (Japanese)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">
              Airing Alerts
            </label>
            <button
              onClick={() => setAiringAlertsEnabled((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                airingAlertsEnabled ? "bg-neon-400" : "bg-space-600"
              }`}
              role="switch"
              aria-checked={airingAlertsEnabled}
              aria-label="Toggle airing alerts"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  airingAlertsEnabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="mt-2 bg-neon-400 text-space-950 hover:bg-neon-300"
          >
            {saving ? "Saving..." : "Save Config"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}