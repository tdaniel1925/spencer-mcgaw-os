"use client";

import { useState } from "react";
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
} from "lucide-react";

export default function PhoneAgentPage() {
  const [isAgentActive, setIsAgentActive] = useState(true);
  const [isTestMode, setIsTestMode] = useState(false);

  return (
    <>
      <Header title="Phone Agent" />
      <main className="p-6 space-y-6">
        {/* Status Banner */}
        <Card className={isAgentActive ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isAgentActive ? "bg-green-100" : "bg-yellow-100"}`}>
                  {isAgentActive ? (
                    <PhoneCall className="h-6 w-6 text-green-600" />
                  ) : (
                    <PhoneOff className="h-6 w-6 text-yellow-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">
                    AI Phone Agent is {isAgentActive ? "Active" : "Paused"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isAgentActive
                      ? "Handling incoming calls automatically"
                      : "Calls will go to voicemail"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isAgentActive}
                    onCheckedChange={setIsAgentActive}
                  />
                  <span className="text-sm font-medium">
                    {isAgentActive ? "Active" : "Paused"}
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
                    <Select defaultValue="professional">
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
                    <Select defaultValue="normal">
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
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Record calls</p>
                    <p className="text-sm text-muted-foreground">
                      Save call recordings for review
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Transcribe calls</p>
                    <p className="text-sm text-muted-foreground">
                      Generate text transcripts of conversations
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
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
                  defaultValue="Hello, thank you for calling Spencer McGaw CPA. This is our automated assistant. How may I help you today?"
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
                  defaultValue="Our office hours are Monday through Friday, 9 AM to 5 PM Central Time. Is there anything else I can help you with?"
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
                  defaultValue="I'd be happy to connect you with one of our team members. Please hold while I transfer your call."
                  rows={3}
                />
              </CardContent>
            </Card>
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
