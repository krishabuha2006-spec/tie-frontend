import React, { useState, useEffect } from 'react';
import { MapPin, RefreshCw, AlertTriangle, CheckCircle2, Navigation } from 'lucide-react';
import Button from './Button';

export const GeoLocationPicker = ({ onLocationChange }) => {
  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSimulated, setIsSimulated] = useState(false);

  const applySimulatedLocation = () => {
    const simLoc = {
      latitude: 23.0225,
      longitude: 72.5714,
      gpsAccuracy: 12,
      gpsUnavailable: false,
      isSimulated: true,
    };
    setCoords({ latitude: simLoc.latitude, longitude: simLoc.longitude });
    setAccuracy(simLoc.gpsAccuracy);
    setError(null);
    setIsSimulated(true);
    if (onLocationChange) onLocationChange(simLoc);
  };

  const fetchLocation = () => {
    setLoading(true);
    setError(null);
    setIsSimulated(false);

    if (!navigator.geolocation) {
      const errMsg = 'GPS not supported by this browser.';
      setError(errMsg);
      setCoords(null);
      setAccuracy(null);
      setLoading(false);
      if (onLocationChange) onLocationChange({ gpsUnavailable: true, error: errMsg });
      // Auto-use office coords
      setTimeout(() => applySimulatedLocation(), 300);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy: acc } = position.coords;
        const locData = {
          latitude: parseFloat(latitude.toFixed(6)),
          longitude: parseFloat(longitude.toFixed(6)),
          gpsAccuracy: Math.round(acc),
          gpsUnavailable: false,
        };
        setCoords({ latitude: locData.latitude, longitude: locData.longitude });
        setAccuracy(locData.gpsAccuracy);
        setError(null);
        setIsSimulated(false);
        setLoading(false);
        if (onLocationChange) onLocationChange(locData);
      },
      (err) => {
        // Suppress browser GPS error from appearing in console as unhandled
        const isDenied = err.code === 1; // PERMISSION_DENIED
        const isTimeout = err.code === 3; // TIMEOUT
        const errMsg = isDenied
          ? 'Location permission denied. Using office coordinates.'
          : isTimeout
          ? 'GPS timed out (normal on desktop). Using office coordinates.'
          : `GPS unavailable: ${err.message || 'Position unavailable'}`;
        setError(errMsg);
        setCoords(null);
        setAccuracy(null);
        setLoading(false);
        if (onLocationChange) onLocationChange({ gpsUnavailable: true, error: errMsg });
        // Auto-apply simulated office location on timeout/denied so attendance isn't blocked
        if (isTimeout || isDenied) {
          setTimeout(() => applySimulatedLocation(), 400);
        }
      },
      {
        enableHighAccuracy: false, // false = faster, works better on desktops/browsers
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  };

  useEffect(() => {
    fetchLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAccuracyGood = accuracy !== null && accuracy <= 100;

  return (
    <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.88rem' }}>
          <MapPin size={16} color="var(--primary)" />
          <span>
            GPS Geolocation{' '}
            {isSimulated && (
              <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600 }}>(Office Coords)</span>
            )}
          </span>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} loading={loading} onClick={fetchLocation}>
          Refresh GPS
        </Button>
      </div>

      {error && !coords ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.82rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="secondary" size="xs" icon={RefreshCw} onClick={fetchLocation}>
              Retry GPS
            </Button>
            <Button variant="primary" size="xs" icon={Navigation} onClick={applySimulatedLocation}>
              Use Office Location
            </Button>
          </div>
        </div>
      ) : coords ? (
        <div style={{ fontSize: '0.84rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div>
            <strong>Latitude:</strong> {coords.latitude}, <strong>Longitude:</strong> {coords.longitude}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span><strong>Accuracy:</strong> ±{accuracy} meters</span>
            {isAccuracyGood ? (
              <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600 }}>
                <CheckCircle2 size={13} /> {isSimulated ? 'Office Location Set' : 'High Accuracy'}
              </span>
            ) : (
              <span style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600 }}>
                <AlertTriangle size={13} /> Accuracy &gt; 100m
              </span>
            )}
          </div>
          {isSimulated && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              ℹ️ Using office location (GPS unavailable on this device)
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Acquiring GPS lock... (may take a few seconds)
        </div>
      )}
    </div>
  );
};

export default GeoLocationPicker;
