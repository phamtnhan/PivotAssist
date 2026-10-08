"use client";

import { useState, useEffect, useRef } from "react";
import {
  VideoCamera,
  Microphone,
  SpeakerHigh,
  CheckCircle,
  CaretDown,
  CameraSlash,
  MicrophoneSlash,
  WarningCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";

interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

interface CameraAlignmentGuideProps {
  onReadyChange?: (isReady: boolean) => void;
  onMicDeviceChange?: (deviceId: string) => void;
  mode?: "mic" | "av";
}

function sampleLuma(video: HTMLVideoElement): number | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 36;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, 64, 36);
  const pixels = ctx.getImageData(0, 0, 64, 36).data;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    sum += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    count += 1;
  }
  return count > 0 ? sum / count : null;
}

export function CameraAlignmentGuide({
  onReadyChange,
  onMicDeviceChange,
  mode = "av",
}: CameraAlignmentGuideProps) {
  const { t } = useLocale();
  const micOnly = mode === "mic";
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([]);
  const [mics, setMics] = useState<MediaDeviceOption[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceOption[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(!micOnly);
  const [isMicActive, setIsMicActive] = useState(true);
  const [micLevel, setMicLevel] = useState(0);
  const [micHeard, setMicHeard] = useState(false);
  const [hasStream, setHasStream] = useState(false);
  const [luma, setLuma] = useState<number | null>(null);
  const [videoStats, setVideoStats] = useState<{
    width: number;
    height: number;
    fps: number;
  } | null>(null);
  const [isPlayingTestAudio, setIsPlayingTestAudio] = useState(false);
  const [showAdvancedTech, setShowAdvancedTech] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameTimesRef = useRef<number[]>([]);

  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDeviceError(t("micNoEnum"));
      return;
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const nextCameras = devices
      .filter((device) => device.kind === "videoinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
      }));
    const nextMics = devices
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${index + 1}`,
      }));
    const nextSpeakers = devices
      .filter((device) => device.kind === "audiooutput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || t("speakerN", { n: index + 1 }),
      }));
    setCameras(nextCameras);
    setMics(nextMics);
    setSpeakers(nextSpeakers);
    setSelectedCamera((current) =>
      current && nextCameras.some((item) => item.deviceId === current)
        ? current
        : (nextCameras[0]?.deviceId ?? ""),
    );
    setSelectedMic((current) =>
      current && nextMics.some((item) => item.deviceId === current)
        ? current
        : (nextMics[0]?.deviceId ?? ""),
    );
    setSelectedSpeaker((current) =>
      current && nextSpeakers.some((item) => item.deviceId === current)
        ? current
        : (nextSpeakers[0]?.deviceId ?? ""),
    );
  };

  useEffect(() => {
    let active = true;

    async function startCamera() {
      setDeviceError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setHasStream(false);
        setDeviceError(micOnly ? t("micNoSupport") : t("avNoSupport"));
        return;
      }
      if (!isCameraActive && !isMicActive) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setHasStream(false);
        return;
      }
      try {
        const videoConstraint: MediaTrackConstraints = selectedCamera
          ? { deviceId: { exact: selectedCamera }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" };
        const audioConstraint: boolean | MediaTrackConstraints = isMicActive
          ? selectedMic
            ? { deviceId: { exact: selectedMic } }
            : true
          : false;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: !micOnly && isCameraActive ? videoConstraint : false,
          audio: audioConstraint,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        setHasStream(
          stream.getVideoTracks().some((track) => track.readyState === "live") ||
            stream.getAudioTracks().some((track) => track.readyState === "live"),
        );
        if (videoRef.current) videoRef.current.srcObject = stream;
        await refreshDevices();
      } catch (err) {
        setHasStream(false);
        setDeviceError(err instanceof Error ? err.message : t("micOpenFail"));
      }
    }

    void startCamera();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (meterFrameRef.current) cancelAnimationFrame(meterFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== "closed")
        void audioContextRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraActive, isMicActive, selectedCamera, selectedMic, micOnly]);

  useEffect(() => {
    if (selectedMic) onMicDeviceChange?.(selectedMic);
  }, [selectedMic, onMicDeviceChange]);

  useEffect(() => {
    onReadyChange?.(
      micOnly
        ? hasStream && isMicActive && Boolean(streamRef.current?.getAudioTracks().length)
        : hasStream && isCameraActive && Boolean(streamRef.current?.getVideoTracks().length),
    );
  }, [hasStream, isCameraActive, isMicActive, micOnly, onReadyChange]);

  useEffect(() => {
    if (!isMicActive || !hasStream || !streamRef.current?.getAudioTracks().length) {
      setMicLevel(0);
      return;
    }
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = audioContext.createMediaStreamSource(streamRef.current);
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    audioContextRef.current = audioContext;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }
      const level = Math.min(100, Math.round(Math.sqrt(sum / data.length) * 220));
      setMicLevel(level);
      if (level >= 8) setMicHeard(true);
      meterFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (meterFrameRef.current) cancelAnimationFrame(meterFrameRef.current);
      source.disconnect();
      if (audioContext.state !== "closed") void audioContext.close();
      audioContextRef.current = null;
    };
  }, [hasStream, isMicActive, selectedMic]);

  useEffect(() => {
    if (!isCameraActive || !hasStream) {
      setLuma(null);
      setVideoStats(null);
      return;
    }
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      setLuma(sampleLuma(video));
      const now = performance.now();
      frameTimesRef.current.push(now);
      frameTimesRef.current = frameTimesRef.current.filter((time) => now - time < 1000);
      setVideoStats({
        width: video.videoWidth,
        height: video.videoHeight,
        fps: frameTimesRef.current.length,
      });
    }, 400);
    return () => window.clearInterval(interval);
  }, [hasStream, isCameraActive]);

  const handleTestSpeaker = async () => {
    try {
      setIsPlayingTestAudio(true);
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      if (selectedSpeaker && "setSinkId" in audioCtx) {
        await (
          audioCtx as AudioContext & { setSinkId?: (id: string) => Promise<void> }
        ).setSinkId?.(selectedSpeaker);
      }
      const playChime = (freq: number, startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = audioCtx.currentTime;
      playChime(523.25, now, 0.25);
      playChime(659.25, now + 0.12, 0.3);
      playChime(783.99, now + 0.24, 0.4);
      window.setTimeout(() => setIsPlayingTestAudio(false), 700);
    } catch {
      setIsPlayingTestAudio(false);
    }
  };

  const cameraLive =
    isCameraActive && hasStream && Boolean(streamRef.current?.getVideoTracks().length);
  const lightingLabel =
    luma == null
      ? t("micLightNone")
      : luma < 40
        ? t("micLightLow")
        : luma > 200
          ? t("micLightHigh")
          : t("micLightOk");
  const lightingOk = luma != null && luma >= 40 && luma <= 200;
  const micLabel = !isMicActive
    ? t("micOff")
    : !streamRef.current?.getAudioTracks().length
      ? t("micNoSignal")
      : micHeard
        ? t("micHearing")
        : t("micTrySpeak");

  if (micOnly) {
    return (
      <div className="space-y-4">
        <div className="rounded-[24px] border border-[rgba(33,34,38,0.1)] bg-[#121317] px-6 py-6 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-3 text-white">
            {isMicActive ? <Microphone size={26} weight="fill" /> : <MicrophoneSlash size={26} />}
          </div>
          <div className="w-full max-w-xs h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[#34A853] transition-all duration-100"
              style={{ width: `${isMicActive ? micLevel : 0}%` }}
            />
          </div>
          <p className="mt-3 text-[12px] text-white/70">{micLabel}</p>
          <button
            type="button"
            onClick={() => setIsMicActive((prev) => !prev)}
            className="mt-4 px-4 py-2 rounded-full bg-white/15 text-white text-[12.5px] font-[450]"
          >
            {isMicActive ? t("micTurnOff") : t("micTurnOn")}
          </button>
        </div>
        {deviceError ? (
          <div
            className="rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6] px-3.5 py-2.5 text-[12.5px] text-[#C5221F]"
            role="alert"
          >
            {deviceError}
          </div>
        ) : null}
        <div>
          <label className="block text-[12px] font-[450] text-[#45474D] mb-1">
            {t("micField")}
          </label>
          <div className="relative">
            <select
              value={selectedMic}
              onChange={(e) => setSelectedMic(e.target.value)}
              className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-3.5 py-2 text-[13px] text-[#121317] focus:outline-none appearance-none cursor-pointer font-normal"
            >
              {mics.length === 0 ? (
                <option value="">{t("micNone")}</option>
              ) : (
                mics.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))
              )}
            </select>
            <CaretDown
              size={14}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#45474D] pointer-events-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-[450] text-[#45474D] mb-1">
            {t("spkField")}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={selectedSpeaker}
                onChange={(e) => setSelectedSpeaker(e.target.value)}
                className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-3.5 py-2 text-[13px] text-[#121317] focus:outline-none appearance-none cursor-pointer font-normal"
              >
                {speakers.length === 0 ? (
                  <option value="">{t("spkDefault")}</option>
                ) : (
                  speakers.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))
                )}
              </select>
              <CaretDown
                size={14}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#45474D] pointer-events-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleTestSpeaker()}
              disabled={isPlayingTestAudio}
              className="px-3.5 py-2 rounded-xl border border-[rgba(33,34,38,0.1)] text-[12.5px] font-[450] bg-white hover:bg-[#F8F9FA]"
            >
              {isPlayingTestAudio ? t("spkPlaying") : t("spkTest")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[24px] border border-[rgba(33,34,38,0.1)] bg-[#121317] aspect-video w-full flex items-center justify-center shadow-xs group select-none">
        {isCameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 text-[#9AA0A6]">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-3">
              <CameraSlash size={28} className="text-white/70" />
            </div>
            <p className="text-[13.5px] font-[450] text-white">{t("camOff")}</p>
            <p className="text-[12px] text-white/50 mt-1">{t("camOffHint")}</p>
          </div>
        )}

        {isCameraActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-44 h-52 sm:w-52 sm:h-60">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white/60 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white/60 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white/60 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white/60 rounded-br-lg" />
            </div>
          </div>
        )}

        <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-2 z-10">
          <button
            type="button"
            onClick={() => setIsCameraActive((prev) => !prev)}
            className={cn(
              "p-2.5 rounded-full transition-all cursor-pointer backdrop-blur-md shadow-xs",
              isCameraActive
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-[#EA4335] text-white hover:bg-[#D93025]",
            )}
            title={isCameraActive ? t("camOnTitle") : t("camOffTitle")}
          >
            {isCameraActive ? (
              <VideoCamera size={18} weight="fill" />
            ) : (
              <CameraSlash size={18} weight="bold" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsMicActive((prev) => !prev)}
            className={cn(
              "p-2.5 rounded-full transition-all cursor-pointer backdrop-blur-md shadow-xs",
              isMicActive
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-[#EA4335] text-white hover:bg-[#D93025]",
            )}
            title={isMicActive ? t("micTurnOff") : t("micTurnOn")}
          >
            {isMicActive ? (
              <Microphone size={18} weight="fill" />
            ) : (
              <MicrophoneSlash size={18} weight="bold" />
            )}
          </button>
        </div>
      </div>

      {deviceError && (
        <div
          className="rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6] px-3.5 py-2.5 text-[12.5px] text-[#C5221F]"
          role="alert"
        >
          {deviceError}
        </div>
      )}

      <div className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.06)] rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12.5px]">
        <div className="flex items-center gap-2 text-[#121317] font-normal">
          {cameraLive ? (
            <CheckCircle size={15} weight="fill" className="text-[#34A853] shrink-0" />
          ) : (
            <WarningCircle size={15} weight="fill" className="text-[#B06000] shrink-0" />
          )}
          <span>
            {!isCameraActive ? t("camOff") : cameraLive ? t("camLive") : t("camNoSignal")}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[#121317] font-normal">
          {lightingOk ? (
            <CheckCircle size={15} weight="fill" className="text-[#34A853] shrink-0" />
          ) : (
            <WarningCircle size={15} weight="fill" className="text-[#B06000] shrink-0" />
          )}
          <span>{lightingLabel}</span>
        </div>

        <div className="flex items-center gap-2 text-[#121317] font-normal">
          {micHeard ? (
            <CheckCircle size={15} weight="fill" className="text-[#34A853] shrink-0" />
          ) : (
            <WarningCircle size={15} weight="fill" className="text-[#B06000] shrink-0" />
          )}
          <span>{micLabel}</span>
          <div className="w-12 h-1.5 bg-black/[0.08] rounded-full overflow-hidden flex items-center">
            <div
              className="h-full bg-[#34A853] transition-all duration-100 rounded-full"
              style={{ width: `${isMicActive ? micLevel : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        <div>
          <label className="block text-[12px] font-[450] text-[#45474D] mb-1">
            {t("camField")}
          </label>
          <div className="relative">
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-3.5 py-2 text-[13px] text-[#121317] focus:outline-none appearance-none cursor-pointer font-normal"
            >
              {cameras.length === 0 ? (
                <option value="">{t("camNone")}</option>
              ) : (
                cameras.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))
              )}
            </select>
            <CaretDown
              size={14}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#45474D] pointer-events-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-[450] text-[#45474D] mb-1">
            {t("micField")}
          </label>
          <div className="relative">
            <select
              value={selectedMic}
              onChange={(e) => setSelectedMic(e.target.value)}
              className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-3.5 py-2 text-[13px] text-[#121317] focus:outline-none appearance-none cursor-pointer font-normal"
            >
              {mics.length === 0 ? (
                <option value="">{t("micNone")}</option>
              ) : (
                mics.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))
              )}
            </select>
            <CaretDown
              size={14}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#45474D] pointer-events-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-[450] text-[#45474D] mb-1">
            {t("spkField")}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={selectedSpeaker}
                onChange={(e) => setSelectedSpeaker(e.target.value)}
                className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-xl px-3.5 py-2 text-[13px] text-[#121317] focus:outline-none appearance-none cursor-pointer font-normal"
              >
                {speakers.length === 0 ? (
                  <option value="">{t("spkDefault")}</option>
                ) : (
                  speakers.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))
                )}
              </select>
              <CaretDown
                size={14}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#45474D] pointer-events-none"
              />
            </div>

            <button
              type="button"
              onClick={() => void handleTestSpeaker()}
              disabled={isPlayingTestAudio}
              className={cn(
                "px-3.5 py-2 rounded-xl border border-[rgba(33,34,38,0.1)] text-[12.5px] font-[450] flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs",
                isPlayingTestAudio
                  ? "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]"
                  : "bg-white hover:bg-[#F8F9FA] text-[#121317]",
              )}
            >
              <SpeakerHigh size={15} weight="bold" />
              <span>{isPlayingTestAudio ? t("spkPlaying") : t("spkTest")}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowAdvancedTech(!showAdvancedTech)}
          className="text-[11.5px] text-[#5F6368] hover:text-[#121317] flex items-center gap-1 cursor-pointer transition-colors"
        >
          <CaretDown
            size={12}
            className={cn("transition-transform", showAdvancedTech && "rotate-180")}
          />
          <span>{t("micTech")}</span>
        </button>

        {showAdvancedTech && (
          <div className="mt-2.5 p-3 rounded-xl bg-[#F8F9FA] border border-[rgba(33,34,38,0.06)] font-mono text-[11px] text-[#5F6368] space-y-1 animate-in fade-in duration-200">
            <div className="flex justify-between">
              <span>{t("micRes")}</span>
              <span className="text-[#121317]">
                {videoStats?.width && videoStats.height
                  ? `${videoStats.width}×${videoStats.height}`
                  : t("micUnmeasured")}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t("micFps")}</span>
              <span className="text-[#121317]">
                {videoStats ? String(videoStats.fps) : t("micUnmeasured")}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t("micBright")}</span>
              <span className="text-[#121317]">
                {luma == null ? t("micUnmeasured") : luma.toFixed(0)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
