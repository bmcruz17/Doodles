import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'

// Camera barcode scanner (works on iOS Safari via getUserMedia + ZXing, where
// the native BarcodeDetector API isn't available). Returns the decoded text.
export default function BarcodeScanner({
  onResult,
  onClose,
}: {
  onResult: (text: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let cancelled = false

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, _err, controls) => {
        controlsRef.current = controls
        if (cancelled) {
          controls.stop()
          return
        }
        if (result) {
          controls.stop()
          onResult(result.getText())
        }
      })
      .catch(() => {
        setError(
          "Couldn't access the camera. You can type the number or upload the document instead.",
        )
      })

    return () => {
      cancelled = true
      try {
        controlsRef.current?.stop()
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-lg font-semibold text-brand-900">Scan the barcode</h2>
        <p className="mb-3 text-sm text-brand-600">
          Point your camera at the barcode on the microchip paperwork.
        </p>
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <video
            ref={videoRef}
            className="aspect-square w-full rounded-xl bg-black object-cover"
            muted
            playsInline
          />
        )}
        <button onClick={onClose} className="btn-ghost mt-4 w-full">
          Cancel
        </button>
      </div>
    </div>
  )
}
