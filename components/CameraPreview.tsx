"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";

export interface CameraPreviewHandle {
  capture: (type?: "image/jpeg" | "image/png", quality?: number) => string;
}

interface CameraPreviewProps {
  active: boolean;
  muted?: boolean;
  onReadyChange?: (ready: boolean) => void;
  variant?: "default" | "kiosk";
}

export const CameraPreview = forwardRef<CameraPreviewHandle, CameraPreviewProps>(
  function CameraPreview({ active, muted = true, onReadyChange, variant = "default" }, ref) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
      let cancelled = false;

      async function startCamera() {
        if (!active) {
          return;
        }

        try {
          setError(null);
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 1600 },
            },
            audio: false,
          });

          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
          setReady(true);
          onReadyChange?.(true);
        } catch {
          setError("카메라 권한을 허용해 주세요");
          setReady(false);
          onReadyChange?.(false);
        }
      }

      startCamera();

      return () => {
        cancelled = true;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setReady(false);
        onReadyChange?.(false);
      };
    }, [active, onReadyChange]);

    useImperativeHandle(ref, () => ({
      capture(type = "image/jpeg", quality = 0.88) {
        const video = videoRef.current;
        if (!video || !ready || video.videoWidth === 0 || video.videoHeight === 0) {
          throw new Error("카메라가 준비되지 않았습니다");
        }

        const targetRatio = 3 / 4;
        const sourceRatio = video.videoWidth / video.videoHeight;
        let sx = 0;
        let sy = 0;
        let sw = video.videoWidth;
        let sh = video.videoHeight;

        if (sourceRatio > targetRatio) {
          sw = video.videoHeight * targetRatio;
          sx = (video.videoWidth - sw) / 2;
        } else {
          sh = video.videoWidth / targetRatio;
          sy = (video.videoHeight - sh) / 2;
        }

        const canvas = document.createElement("canvas");
        canvas.width = 900;
        canvas.height = 1200;
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("캔버스를 사용할 수 없습니다");
        }
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL(type, quality);
      },
    }));

    return (
      <div
        className={`camera-frame relative w-full overflow-hidden bg-black ${
          variant === "kiosk"
            ? "rounded-[8px] border-[4px] border-[#12325b]"
            : "rounded-[8px] border-2 border-booth-ink"
        }`}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted={muted}
          aria-label="카메라 미리보기"
        />
        {ready && variant === "kiosk" && (
          <>
            <div className="pointer-events-none absolute inset-6 rounded-[4px] border-2 border-white/70" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/18" />
            <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/18" />
          </>
        )}
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#111827] text-white">
            {error ? <CameraOff className="h-16 w-16" /> : <Camera className="h-16 w-16" />}
            <p className="safe-text px-8 text-center text-2xl font-black">
              {error ?? "카메라 준비 중"}
            </p>
          </div>
        )}
      </div>
    );
  },
);
