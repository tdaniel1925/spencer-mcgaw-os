"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Settings,
  MessageSquare,
  Volume2,
  Mic,
  Bot,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
  Save,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface PhoneAgentSettings {
  isAgentActive: boolean;
  voiceType: string;
  speakingSpeed: string;
  autoCreateTasks: boolean;
  recordCalls: boolean;
  transcribeCalls: boolean;
  greetingScript: string;
  businessHoursResponse: string;
  transferMessage: string;
}

const defaultSettings: PhoneAgentSettings = {
  isAgentActive: true,
  voiceType: "professional",
  speakingSpeed: "normal",
  autoCreateTasks: true,
  recordCalls: true,
  transcribeCalls: true,
  greetingScript: "Hello, thank you for calling Spencer McGaw CPA. This is our automated assistant. How may I help you today?",
  businessHoursResponse: "Our office hours are Monday through Friday, 9 AM to 5 PM Central Time. Is there anything else I can help you with?",
  transferMessage: "I'd be happy to connect you with one of our team members. Please hold while I transfer your call.",
};

const STORAGE_KEY = "phone-agent-settings";

export default function PhoneAgentPage() {
  const [settings, setSettings] = useState<PhoneAgentSettings>(defaultSettings);
  const [isTestMode, setIsTestMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      } catch {
        console.error("Failed to parse saved settings");
      }
    }
  }, []);

  // Update a single setting
  const updateSetting = <K extends keyof PhoneAgentSettings>(
    key: K,
    value: PhoneAgentSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Save settings to localStorage
  const saveSettings = () => {
    setIsSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setHasChanges(false);
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle agent active toggle (saves immediately)
  const handleAgentToggle = (active: boolean) => {
    updateSetting("isAgentActive", active);
    // Save immediately for critical settings
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, isAgentActive: active }));
    toast.success(active ? "Phone agent activated" : "Phone agent paused");
    setHasChanges(false);
  };

  return (
    <>
      <Header title="Phone Agent" />
      <main className="p-6 space-y-6">
        {/* Status Banner */}
        <Card className={settings.isAgentActive ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950" : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${settings.isAgentActive ? "bg-green-100 dark:bg-green-900" : "bg-yellow-100 dark:bg-yellow-900"}`}>
                  {settings.isAgentActive ? (
                    <PhoneCall className="h-6 w-6 text-green-600" />
                  ) : (
                    <PhoneOff className="h-6 w-6 text-yellow-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">
                    AI Phone Agent is {settings.isAgentActive ? "Active" : "Paused"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {settings.isAgentActive
                      ? "Handling incoming calls automatically"
                      : "Calls will go to voicemail"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={settings.isAgentActive}
                    onCheckedChange={handleAgentToggle}
                  />
                  <span className="text-sm font-medium">
                    {settings.isAgentActive ? "Active" : "Paused"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="scripts">Scripts</TabsTrigger>
            <TabsTrigger value="test">Test Agent</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Calls Today</p>
                      <p className="text-2xl font-bold">24</p>
                    </div>
                    <Phone className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Duration</p>
                      <p className="text-2xl font-bold">3:42</p>
                    </div>
                    <Volume2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Tasks Created</p>
                      <p className="text-2xl font-bold">18</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Transfers</p>
                      <p className="text-2xl font-bold">6</p>
                    </div>
                    <PhoneCall className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Capabilities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Agent Capabilities
                </CardTitle>
                <CardDescription>
                  What the AI phone agent can do
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Answer Common Questions</p>
                      <p className="text-sm text-muted-foreground">
                        Business hours, services offered, document requirements
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Create Tasks</p>
                      <p className="text-sm text-muted-foreground">
                        Log callback requests, document needs, and action items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Lookup Client Info</p>
                      <p className="text-sm text-muted-foreground">
                        Verify caller identity and retrieve account details
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Transfer Calls</p>
                      <p className="text-sm text-muted-foreground">
                        Route complex inquiries to team members
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Voice Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Voice Type</Label>
                    <Select
                      value={settings.voiceType}
                      onValueChange={(v) => updateSetting("voiceType", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional Female</SelectItem>
                        <SelectItem value="friendly">Friendly Male</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Speaking Speed</Label>
                    <Select
                      value={settings.speakingSpeed}
                      onValueChange={(v) => updateSetting("speakingSpeed", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slow">Slow</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="fast">Fast</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Call Handling</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-create tasks</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically create tasks from call outcomes
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoCreateTasks}
                    onCheckedChange={(v) => updateSetting("autoCreateTasks", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Record calls</p>
                    <p className="text-sm text-muted-foreground">
                      Save call recordings for review
                    </p>
                  </div>
                  <Switch
                    checked={settings.recordCalls}
                    onCheckedChange={(v) => updateSetting("recordCalls", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Transcribe calls</p>
                    <p className="text-sm text-muted-foreground">
                      Generate text transcripts of conversations
                    </p>
                  </div>
                  <Switch
                    checked={settings.transcribeCalls}
                    onCheckedChange={(v) => updateSetting("transcribeCalls", v)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            {hasChanges && (
              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {isSaving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Scripts Tab */}
          <TabsContent value="scripts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Greeting Script</CardTitle>
                <CardDescription>
                  What the agent says when answering calls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={settings.greetingScript}
                  onChange={(e) => updateSetting("greetingScript", e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Business Hours Response</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={settings.businessHoursResponse}
                  onChange={(e) => updateSetting("businessHoursResponse", e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transfer Message</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={settings.transferMessage}
                  onChange={(e) => updateSetting("transferMessage", e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Save Button */}
            {hasChanges && (
              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {isSaving ? "Saving..." : "Save Scripts"}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Test Tab */}
          <TabsContent value="test" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Test Mode
                </CardTitle>
                <CardDescription>
                  Simulate a call to test the AI agent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isTestMode}
                      onCheckedChange={setIsTestMode}
                    />
                    <span className="text-sm font-medium">
                      {isTestMode ? "Test mode active" : "Test mode off"}
                    </span>
                  </div>
                </div>

                {isTestMode && (
                  <div className="p-4 bg-muted rounded-lg space-y-4">
                    <div className="flex items-center gap-4">
                      <Button>
                        <Play className="h-4 w-4 mr-2" />
                        Start Test Call
                      </Button>
                      <Button variant="outline">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                    </div>
                    <div className="p-3 bg-background rounded border">
                      <p className="text-sm text-muted-foreground">
                        Click &quot;Start Test Call&quot; to simulate an incoming call and test the AI agent&apos;s responses.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
