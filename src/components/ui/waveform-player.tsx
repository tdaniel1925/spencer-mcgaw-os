"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WaveformPlayerProps {
  src: string;
  onPlayStateChange?: (isPlaying: boolean) => void;
  className?: string;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function WaveformPlayer({ src, onPlayStateChange, className }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize WaveSurfer with pre-check for audio availability
  useEffect(() => {
    if (!containerRef.current || !src) return;

    setIsLoading(true);
    setError(null);

    // Pre-check if audio is available via HEAD request
    const checkAndLoadAudio = async () => {
      try {
        const checkResponse = await fetch(src, { method: "HEAD" });

        if (!checkResponse.ok) {
          if (checkResponse.status === 404) {
            setError("Recording no longer available");
          } else if (checkResponse.status === 202) {
            setError("Recording is still processing...");
          } else {
            setError("Recording unavailable");
          }
          setIsLoading(false);
          return;
        }

        // Audio is available, proceed with WaveSurfer
        const wavesurfer = WaveSurfer.create({
          container: containerRef.current!,
          waveColor: "rgb(var(--primary) / 0.3)",
          progressColor: "rgb(var(--primary))",
          cursorColor: "rgb(var(--primary))",
          cursorWidth: 2,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 60,
          normalize: true,
          backend: "WebAudio",
        });

        wavesurferRef.current = wavesurfer;

        wavesurfer.on("ready", () => {
          setIsLoading(false);
          setDuration(wavesurfer.getDuration());
          wavesurfer.setVolume(volume);
        });

        wavesurfer.on("audioprocess", () => {
          setCurrentTime(wavesurfer.getCurrentTime());
        });

        wavesurfer.on("seeking", () => {
          setCurrentTime(wavesurfer.getCurrentTime());
        });

        wavesurfer.on("play", () => {
          setIsPlaying(true);
          onPlayStateChange?.(true);
        });

        wavesurfer.on("pause", () => {
          setIsPlaying(false);
          onPlayStateChange?.(false);
        });

        wavesurfer.on("finish", () => {
          setIsPlaying(false);
          onPlayStateChange?.(false);
        });

        wavesurfer.on("error", (err) => {
          console.error("[WaveformPlayer] Error:", err);
          setError("Failed to load audio");
          setIsLoading(false);
        });

        // Load the audio
        wavesurfer.load(src);
      } catch (err) {
        console.error("[WaveformPlayer] Pre-check error:", err);
        setError("Recording unavailable");
        setIsLoading(false);
      }
    };

    checkAndLoadAudio();

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [src]);

  // Update volume when changed
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  const togglePlayPause = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  }, []);

  const skipBack = useCallback(() => {
    if (wavesurferRef.current) {
      const newTime = Math.max(0, wavesurferRef.current.getCurrentTime() - 10);
      wavesurferRef.current.seekTo(newTime / duration);
    }
  }, [duration]);

  const skipForward = useCallback(() => {
    if (wavesurferRef.current) {
      const newTime = Math.min(duration, wavesurferRef.current.getCurrentTime() + 10);
      wavesurferRef.current.seekTo(newTime / duration);
    }
  }, [duration]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleVolumeChange = useCallback((value: number[]) => {
    setVolume(value[0]);
    if (value[0] > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  if (error) {
    return (
      <div className={cn("rounded-lg border bg-muted/50 p-4", className)}>
        <div className="text-center text-sm text-muted-foreground">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-3", className)}>
      {/* Waveform Container */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg z-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        <div
          ref={containerRef}
          className={cn(
            "w-full rounded-lg overflow-hidden",
            isLoading && "opacity-50"
          )}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Play controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={skipBack}
            disabled={isLoading}
            aria-label="Skip back 10 seconds"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={togglePlayPause}
            disabled={isLoading}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={skipForward}
            disabled={isLoading}
            aria-label="Skip forward 10 seconds"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Time display */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-[90px]">
          <span className="font-mono">{formatTime(currentTime)}</span>
          <span>/</span>
          <span className="font-mono">{formatTime(duration)}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Volume control */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            onValueChange={handleVolumeChange}
            max={1}
            step={0.1}
            className="w-20"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}
