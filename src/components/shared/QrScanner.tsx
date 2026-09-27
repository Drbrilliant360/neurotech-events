import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Camera QR scanner for the check-in desk.
 *
 * Uses the rear camera through getUserMedia and decodes with the native BarcodeDetector where the
 * browser has it (Chrome on Android/macOS/ChromeOS), falling back to jsQR, which is loaded only
 * when needed. The camera only works in a secure context: HTTPS, or http://localhost.
 */

interface Props {
  /** Called once per distinct code; the scanner pauses until the returned promise settles. */
  onScan: (code: string) => Promise<unknown>;
  onClose: () => void;
}

type Detect = (source: HTMLVideoElement) => Promise<string | null>;

interface NativeDetector { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> }
interface NativeDetectorClass {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

const SCAN_INTERVAL_MS = 200;
const REPEAT_COOLDOWN_MS = 3000;

async function createDetector(canvas: HTMLCanvasElement): Promise<Detect> {
  const Native = (window as unknown as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  if (Native) {
    try {
      const formats = (await Native.getSupportedFormats?.()) ?? ["qr_code"];
      if (formats.includes("qr_code")) {
        const detector = new Native({ formats: ["qr_code"] });
        return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
      }
    } catch {
      // Fall through to jsQR.
    }
  }
  const { default: jsQR } = await import("jsqr");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!context || !video.videoWidth) return null;
    // Decode a downscaled frame: QR codes stay readable and each pass stays cheap.
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

function cameraError(error: unknown): string {
  if (!window.isSecureContext) return "The camera needs a secure page. Open the console over HTTPS or on http://localhost.";
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera access was blocked. Allow the camera for this site in your browser settings, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device. Use the lookup field instead.";
  if (name === "NotReadableError") return "The camera is in use by another app. Close it and try again.";
  return "The camera could not be started. Use the lookup field instead.";
}

export function QrScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState<string | null>(
    // mediaDevices is undefined outside secure contexts, whatever the types say.
    "getUserMedia" in (navigator.mediaDevices ?? {}) ? null : cameraError(new DOMException("", "NotSupportedError")),
  );
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);

  const handle = useCallback(async (code: string) => {
    const now = Date.now();
    // The same ticket stays in frame for a while; only react to it again after a cooldown.
    if (code === lastRef.current.code && now - lastRef.current.at < REPEAT_COOLDOWN_MS) return;
    lastRef.current = { code, at: now };
    busyRef.current = true;
    setPaused(true);
    navigator.vibrate?.(60);
    try {
      await onScanRef.current(code);
    } finally {
      busyRef.current = false;
      setPaused(false);
      lastRef.current = { code, at: Date.now() };
    }
  }, []);

  useEffect(() => {
    if (error) return;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    let stopped = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped || !videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const detect = await createDetector(canvasRef.current);
        if (stopped) return;
        setReady(true);
        const tick = async () => {
          if (stopped) return;
          if (!busyRef.current && !document.hidden && video.readyState >= 2) {
            try {
              const code = await detect(video);
              if (code && !stopped) await handle(code.trim());
            } catch {
              // A single bad frame is not an error; keep scanning.
            }
          }
          if (!stopped) timer = window.setTimeout(tick, SCAN_INTERVAL_MS);
        };
        void tick();
      } catch (err) {
        if (!stopped) setError(cameraError(err));
      }
    })();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [error, handle]);

  return (
    <div className="nt-qr-scanner">
      {error ? (
        <div className="nt-qr-scanner-error" role="alert">{error}</div>
      ) : (
        <div className="nt-qr-scanner-frame">
          <video ref={videoRef} muted playsInline aria-label="Camera preview for scanning ticket QR codes" />
          <div className={`nt-qr-scanner-target ${paused ? "is-paused" : ""}`} aria-hidden="true" />
          {!ready ? <div className="nt-qr-scanner-hint">Starting camera…</div> : null}
        </div>
      )}
      <canvas ref={canvasRef} hidden />
      <div className="nt-actions" style={{ marginTop: 10 }}>
        <button type="button" className="nt-btn ghost" onClick={onClose}>Close camera</button>
        {ready && !error ? <span className="nt-muted">{paused ? "Checking ticket…" : "Point the camera at the ticket QR code."}</span> : null}
      </div>
    </div>
  );
}
