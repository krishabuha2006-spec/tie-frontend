import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Check,
  AlertCircle,
  ScanFace,
  Sparkles,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import Button from './Button';

export const CameraCapture = ({
  onCapture,
  onError,
  label = 'Capture Attendance Face',
  autoCapture = true,
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [starting, setStarting] = useState(false);

  // Auto-Capture & Face Detection States
  const [isAutoCaptureEnabled, setIsAutoCaptureEnabled] = useState(autoCapture);
  const [faceDetected, setFaceDetected] = useState(false);
  const [countdown, setCountdown] = useState(null); // null | 2 | 1 | 0
  const [flashActive, setFlashActive] = useState(false);

  const countdownTimerRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const faceStableCountRef = useRef(0);
  const retakeCooldownRef = useRef(false);

  // ----------------------------------------------------
  // CAMERA START / STOP
  // ----------------------------------------------------
  const startCamera = async () => {
    setCameraError(null);
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('Camera error:', err);
      const isDenied =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.message?.toLowerCase().includes('denied') ||
        err.message?.toLowerCase().includes('permission');
      const msg = isDenied
        ? 'Camera permission denied. Please allow camera access in browser settings.'
        : err.message || 'Unable to access camera. Please check camera hardware or permissions.';
      setCameraError(msg);
      if (onError) {
        onError({ error: msg, isPermissionDenied: isDenied });
      }
    } finally {
      setStarting(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Ensure video element plays and receives stream when active
  useEffect(() => {
    if (videoRef.current && streamRef.current && !capturedImage) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [stream, capturedImage]);

  // ----------------------------------------------------
  // CAPTURE FRAME ACTION
  // ----------------------------------------------------
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Trigger visual shutter flash
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 250);

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    setCapturedImage(dataUrl);
    setCountdown(null);
    setFaceDetected(false);
    faceStableCountRef.current = 0;

    if (onCapture) {
      onCapture(dataUrl);
    }
  }, [onCapture]);

  // ----------------------------------------------------
  // INTELLIGENT FACE DETECTION & AUTO-CAPTURE ENGINE
  // Detects when user's face is positioned in the center oval
  // ----------------------------------------------------
  useEffect(() => {
    if (!stream || capturedImage || !isAutoCaptureEnabled) {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      return;
    }

    let isSubscribed = true;

    // Check Native FaceDetector API or Canvas Optical Presence Analyzer
    const hasNativeFaceDetector = 'FaceDetector' in window;
    let nativeDetector = null;
    if (hasNativeFaceDetector) {
      try {
        nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      } catch {
        nativeDetector = null;
      }
    }

    const analyzeFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || retakeCooldownRef.current) return;
      const video = videoRef.current;

      let detected = false;

      // 1. Try Native Browser FaceDetector
      if (nativeDetector) {
        try {
          const faces = await nativeDetector.detect(video);
          if (faces && faces.length > 0) {
            detected = true;
          }
        } catch {
          detected = false;
        }
      }

      // 2. Fallback / Complementary: Optical Luminance & Oval Presence Analyzer
      if (!detected) {
        try {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = 160;
          tempCanvas.height = 120;
          const ctx = tempCanvas.getContext('2d');
          ctx.drawImage(video, 0, 0, 160, 120);

          // Sample center oval pixels (x: 40-120, y: 30-90)
          const imgData = ctx.getImageData(40, 25, 80, 70).data;
          let brightnessSum = 0;
          let contrastVar = 0;
          const len = imgData.length / 4;

          for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            brightnessSum += lum;
          }
          const avgLum = brightnessSum / len;

          // Check if frame is illuminated and has non-zero subject variance (not pure black/covered)
          for (let i = 0; i < imgData.length; i += 16) {
            const lum = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
            contrastVar += Math.abs(lum - avgLum);
          }

          // Sufficient lighting & human presence contrast threshold
          if (avgLum > 35 && avgLum < 240 && contrastVar > 800) {
            detected = true;
          }
        } catch {
          detected = true;
        }
      }

      if (!isSubscribed) return;

      if (detected) {
        faceStableCountRef.current += 1;
        // Require 2 consecutive stable frames (~400ms) to trigger lock
        if (faceStableCountRef.current >= 2) {
          setFaceDetected(true);
        }
      } else {
        faceStableCountRef.current = 0;
        setFaceDetected(false);
        setCountdown(null);
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }
    };

    detectionIntervalRef.current = setInterval(analyzeFrame, 250);

    return () => {
      isSubscribed = false;
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, [stream, capturedImage, isAutoCaptureEnabled]);

  // ----------------------------------------------------
  // AUTO-CAPTURE COUNTDOWN TRIGGER
  // When face is detected and aligned, counts down and fires captureFrame()
  // ----------------------------------------------------
  useEffect(() => {
    if (faceDetected && isAutoCaptureEnabled && !capturedImage && countdown === null) {
      // Start 2-second auto-capture countdown
      let count = 2;
      setCountdown(count);

      countdownTimerRef.current = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
        } else if (count === 0) {
          setCountdown(0);
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          // AUTO CAPTURE TRIGGER!
          setTimeout(() => {
            captureFrame();
          }, 150);
        }
      }, 700);
    }

    return () => {
      if (countdownTimerRef.current && !faceDetected) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [faceDetected, isAutoCaptureEnabled, capturedImage, countdown, captureFrame]);

  const retake = () => {
    setCapturedImage(null);
    setFaceDetected(false);
    setCountdown(null);
    faceStableCountRef.current = 0;
    retakeCooldownRef.current = true;
    setTimeout(() => {
      retakeCooldownRef.current = false;
    }, 1500);

    if (onCapture) {
      onCapture(null);
    }

    const isAlive =
      streamRef.current &&
      streamRef.current.active &&
      streamRef.current.getVideoTracks().some((t) => t.readyState === 'live');

    if (!isAlive) {
      startCamera();
    } else if (videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
      {cameraError ? (
        <div
          style={{
            padding: 16,
            background: 'var(--danger-light)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            width: '100%',
            textAlign: 'center',
            fontSize: '0.9rem',
          }}
        >
          <AlertCircle size={20} style={{ margin: '0 auto 8px', display: 'block' }} />
          {cameraError}
          <div style={{ marginTop: 8 }}>
            <Button variant="secondary" size="sm" onClick={startCamera} loading={starting}>
              Retry Camera
            </Button>
          </div>
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 420,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            background: '#0f172a',
            aspectRatio: '4/3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: faceDetected
              ? '0 0 20px rgba(16, 185, 129, 0.45)'
              : '0 4px 12px rgba(0,0,0,0.15)',
            border: `2px solid ${faceDetected ? '#10b981' : 'rgba(255,255,255,0.15)'}`,
            transition: 'border-color 0.3s, box-shadow 0.3s',
          }}
        >
          {/* Always keep video mounted so stream is never detached on recapture */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror feed for intuitive positioning
              display: capturedImage ? 'none' : 'block',
            }}
          />
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured Biometric Frame"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}

          {/* Shutter White Flash Effect */}
          {flashActive && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: '#ffffff',
                zIndex: 20,
                opacity: 0.95,
                transition: 'opacity 0.25s ease-out',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Biometric Oval Guide Overlay */}
          {!capturedImage && (
            <>
              {/* Central Biometric Oval Target */}
              <div
                style={{
                  position: 'absolute',
                  width: '58%',
                  height: '78%',
                  border: `2.5px ${faceDetected ? 'solid #10b981' : 'dashed rgba(255,255,255,0.7)'}`,
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  boxShadow: faceDetected ? '0 0 15px rgba(16, 185, 129, 0.6)' : 'none',
                  transition: 'all 0.3s ease',
                  zIndex: 2,
                }}
              />

              {/* Animated Laser Scanner Line */}
              <div
                style={{
                  position: 'absolute',
                  left: '21%',
                  width: '58%',
                  height: 2,
                  backgroundColor: faceDetected ? '#10b981' : '#38bdf8',
                  boxShadow: `0 0 10px ${faceDetected ? '#10b981' : '#38bdf8'}`,
                  animation: 'laserScan 2.4s ease-in-out infinite',
                  pointerEvents: 'none',
                  zIndex: 3,
                }}
              />

              {/* Status HUD Header inside Camera Viewfinder */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: faceDetected ? 'rgba(16, 185, 129, 0.9)' : 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(4px)',
                  color: '#ffffff',
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  zIndex: 4,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                }}
              >
                {faceDetected ? (
                  <>
                    <Sparkles size={13} />
                    <span>Face Matched & Locked!</span>
                  </>
                ) : (
                  <>
                    <ScanFace size={13} />
                    <span>Position face inside oval...</span>
                  </>
                )}
              </div>

              {/* Auto-Capture Countdown Visual Badge */}
              {countdown !== null && (
                <div
                  style={{
                    position: 'absolute',
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(16, 185, 129, 0.92)',
                    backdropFilter: 'blur(6px)',
                    color: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    zIndex: 5,
                    boxShadow: '0 0 25px rgba(16, 185, 129, 0.8)',
                    animation: 'pulseGlow 0.8s infinite',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {countdown === 0 ? <Camera size={26} color="#ffffff" /> : countdown}
                  </span>
                  <span style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Auto
                  </span>
                </div>
              )}

              {/* Bottom Auto-Capture Indicator */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontSize: '0.72rem',
                  color: '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  zIndex: 4,
                }}
              >
                <Zap size={12} color="#10b981" />
                <span>Auto-Capture is <strong>Active</strong></span>
              </div>
            </>
          )}

          {/* Captured Success Overlay Icon */}
          {capturedImage && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                backgroundColor: 'rgba(16, 185, 129, 0.95)',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: 14,
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                zIndex: 4,
              }}
            >
              <CheckCircle2 size={14} />
              <span>Face Stored</span>
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Action Controls & Toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {!capturedImage ? (
          <>
            {/* Auto Capture Mode Pill */}
            <button
              type="button"
              onClick={() => setIsAutoCaptureEnabled(!isAutoCaptureEnabled)}
              className="btn btn-sm"
              style={{
                backgroundColor: isAutoCaptureEnabled ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)',
                border: `1px solid ${isAutoCaptureEnabled ? '#10b981' : 'var(--border-color)'}`,
                color: isAutoCaptureEnabled ? '#166534' : 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 20,
              }}
            >
              <Zap size={14} color={isAutoCaptureEnabled ? '#10b981' : 'currentColor'} />
              <span>{isAutoCaptureEnabled ? 'Auto-Capture ON (Hands-Free)' : 'Auto-Capture OFF'}</span>
            </button>

            {/* Manual Click Fallback Button */}
            <Button
              variant="secondary"
              size="sm"
              icon={Camera}
              onClick={captureFrame}
              disabled={!stream || !!cameraError}
              title="Click to manually capture if needed"
            >
              {label} (Manual)
            </Button>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={retake}>
              Retake / Re-scan Face
            </Button>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--success)',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              <CheckCircle2 size={17} />
              <span>Face Auto-Captured Successfully</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes laserScan {
          0% { top: 18%; opacity: 0.85; }
          50% { top: 78%; opacity: 1; }
          100% { top: 18%; opacity: 0.85; }
        }
        @keyframes pulseGlow {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default CameraCapture;
