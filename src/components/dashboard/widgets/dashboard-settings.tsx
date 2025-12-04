"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Settings,
  LayoutDashboard,
  Calendar,
  ListTodo,
  Phone,
  Mail,
  BarChart3,
  Zap,
  Activity,
  Plus,
  Trash2,
  GripVertical,
  Palette,
  RotateCcw,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard, WidgetConfig, calendarColors, UserCalendar } from "@/lib/dashboard";

// Widget icon mapping
const widgetIcons: Record<string, React.ReactNode> = {
  tasks: <ListTodo className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  calls: <Phone className="h-4 w-4" />,
  emails: <Mail className="h-4 w-4" />,
  stats: <BarChart3 className="h-4 w-4" />,
  quick_actions: <Zap className="h-4 w-4" />,
  activity: <Activity className="h-4 w-4" />,
};

interface DashboardSettingsProps {
  trigger?: React.ReactNode;
}

export function DashboardSettings({ trigger }: DashboardSettingsProps) {
  const {
    preferences,
    widgets,
    toggleWidget,
    updateWidgetSize,
    calendars,
    toggleCalendar,
    addCalendar,
    updateCalendar,
    removeCalendar,
    setLayoutPreset,
    resetToDefaults,
  } = useDashboard();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"widgets" | "calendars" | "layout">("widgets");
  const [newCalendarName, setNewCalendarName] = useState("");
  const [newCalendarColor, setNewCalendarColor] = useState(calendarColors[0].value);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);

  const handleAddCalendar = () => {
    if (newCalendarName.trim()) {
      addCalendar(newCalendarName.trim(), newCalendarColor);
      setNewCalendarName("");
      setNewCalendarColor(calendarColors[0].value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Customize
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Dashboard Settings
          </DialogTitle>
          <DialogDescription>
            Customize your dashboard layout, widgets, and calendars
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("widgets")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "widgets"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Widgets
          </button>
          <button
            onClick={() => setActiveTab("calendars")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "calendars"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Calendars
          </button>
          <button
            onClick={() => setActiveTab("layout")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "layout"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Layout
          </button>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* Widgets Tab */}
          {activeTab === "widgets" && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Toggle widgets on or off to customize your dashboard view.
              </p>

              <div className="space-y-2">
                {widgets
                  .sort((a, b) => a.order - b.order)
                  .map((widget) => (
                    <div
                      key={widget.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        widget.enabled ? "bg-card" : "bg-muted/30 opacity-60"
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          {widgetIcons[widget.type]}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{widget.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {widget.type.replace("_", " ")}
                          </p>
                        </div>
                      </div>

                      <Select
                        value={widget.size}
                        onValueChange={(value) =>
                          updateWidgetSize(widget.id, value as "small" | "medium" | "large")
                        }
                        disabled={!widget.enabled}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Small</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="large">Large</SelectItem>
                        </SelectContent>
                      </Select>

                      <Switch
                        checked={widget.enabled}
                        onCheckedChange={() => toggleWidget(widget.id)}
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Calendars Tab */}
          {activeTab === "calendars" && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Manage your calendars. Each calendar can have its own color and can be toggled on/off.
              </p>

              {/* Add New Calendar */}
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                <Input
                  placeholder="New calendar name..."
                  value={newCalendarName}
                  onChange={(e) => setNewCalendarName(e.target.value)}
                  className="flex-1 h-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCalendar();
                  }}
                />

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                    >
                      <div
                        className="w-5 h-5 rounded-full"
                        style={{ backgroundColor: newCalendarColor }}
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="end">
                    <div className="grid grid-cols-5 gap-2">
                      {calendarColors.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setNewCalendarColor(color.value)}
                          className={cn(
                            "w-7 h-7 rounded-full transition-transform hover:scale-110",
                            newCalendarColor === color.value && "ring-2 ring-offset-2 ring-primary"
                          )}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Button size="sm" onClick={handleAddCalendar} disabled={!newCalendarName.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              {/* Calendar List */}
              <div className="space-y-2">
                {calendars.map((calendar) => (
                  <div
                    key={calendar.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                      calendar.enabled ? "bg-card" : "bg-muted/30 opacity-60"
                    )}
                  >
                    {/* Color Picker */}
                    <Popover
                      open={showColorPicker === calendar.id}
                      onOpenChange={(open) => setShowColorPicker(open ? calendar.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <button
                          className="w-6 h-6 rounded-full flex-shrink-0 hover:ring-2 ring-offset-2 ring-muted-foreground transition-all"
                          style={{ backgroundColor: calendar.color }}
                        />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" align="start">
                        <div className="grid grid-cols-5 gap-2">
                          {calendarColors.map((color) => (
                            <button
                              key={color.value}
                              onClick={() => {
                                updateCalendar(calendar.id, { color: color.value });
                                setShowColorPicker(null);
                              }}
                              className={cn(
                                "w-7 h-7 rounded-full transition-transform hover:scale-110 relative",
                                calendar.color === color.value && "ring-2 ring-offset-2 ring-primary"
                              )}
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                            >
                              {calendar.color === color.value && (
                                <Check className="h-4 w-4 text-white absolute inset-0 m-auto" />
                              )}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{calendar.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {calendar.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground capitalize">
                          {calendar.provider}
                        </span>
                      </div>
                    </div>

                    <Switch
                      checked={calendar.enabled}
                      onCheckedChange={() => toggleCalendar(calendar.id)}
                    />

                    {!calendar.isDefault && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeCalendar(calendar.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Layout Tab */}
          {activeTab === "layout" && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Choose a preset layout or customize your own.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: "default",
                    name: "Default",
                    description: "Balanced view with all essential widgets",
                  },
                  {
                    id: "compact",
                    name: "Compact",
                    description: "Minimal view with key info only",
                  },
                  {
                    id: "detailed",
                    name: "Detailed",
                    description: "Full view with all widgets expanded",
                  },
                  {
                    id: "custom",
                    name: "Custom",
                    description: "Your personalized configuration",
                  },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() =>
                      setLayoutPreset(preset.id as "default" | "compact" | "detailed" | "custom")
                    }
                    className={cn(
                      "p-4 rounded-lg border text-left transition-all hover:border-primary/50",
                      preferences?.layout === preset.id &&
                        "border-primary bg-primary/5 ring-1 ring-primary"
                    )}
                  >
                    <p className="font-medium text-sm">{preset.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
                    {preferences?.layout === preset.id && (
                      <Badge className="mt-2" variant="secondary">
                        Active
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t pt-4 mt-4">
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
