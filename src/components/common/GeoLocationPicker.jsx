import React, { useState, useEffect } from 'react';
import { MapPin, RefreshCw, AlertTriangle, CheckCircle2, Navigation, Compass } from 'lucide-react';
import Button from './Button';
import { calculateDistanceMeters } from '../../utils/geoUtils';

export const GeoLocationPicker = ({ onLocationChange, targetLocation = null }) => {
  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSimulated, setIsSimulated] = useState(false);

  // Target branch location details
  const targetLat = targetLocation?.latitude ?? null;
  const targetLon = targetLocation?.longitude ?? null;
  const targetRadius = targetLocation?.radiusMeters || 500;
  const targetName = targetLocation?.branchName || 'Assigned Branch';

  const applySimulatedLocation = () => {
    // If target branch coordinates exist, use them; otherwise fallback to default office coords
    const fallbackLat = targetLat != null ? targetLat : 23.0225;
    const fallbackLon = targetLon != null ? targetLon : 72.5714;

    const simLoc = {
      latitude: fallbackLat,
      longitude: fallbackLon,
      gpsAccuracy: 12,
      gpsUnavailable: false,
      isSimulated: true,
      distanceFromBranch: 0,
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
      setTimeout(() => applySimulatedLocation(), 300);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy: acc } = position.coords;
        const curLat = parseFloat(latitude.toFixed(6));
        const curLon = parseFloat(longitude.toFixed(6));

        let dist = null;
        if (targetLat != null && targetLon != null) {
          dist = calculateDistanceMeters(curLat, curLon, targetLat, targetLon);
        }

        const locData = {
          latitude: curLat,
          longitude: curLon,
          gpsAccuracy: Math.round(acc),
          gpsUnavailable: false,
          distanceFromBranch: dist,
        };
        setCoords({ latitude: locData.latitude, longitude: locData.longitude });
        setAccuracy(locData.gpsAccuracy);
        setError(null);
        setIsSimulated(false);
        setLoading(false);
        if (onLocationChange) onLocationChange(locData);
      },
      (err) => {
        const isDenied = err.code === 1; // PERMISSION_DENIED
        const isTimeout = err.code === 3; // TIMEOUT
        const errMsg = isDenied
          ? 'Location permission denied. Please allow location access to verify 500m branch distance.'
          : isTimeout
          ? 'GPS timed out. You can retry or click Use Office Coords.'
          : `GPS unavailable: ${err.message || 'Position unavailable'}`;
        setError(errMsg);
        setCoords(null);
        setAccuracy(null);
        setLoading(false);
        if (onLocationChange) onLocationChange({ gpsUnavailable: true, error: errMsg });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  useEffect(() => {
    fetchLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLat, targetLon]);

  const isAccuracyGood = accuracy !== null && accuracy <= 100;

  // Calculate distance if coordinates are present
  const liveDistance =
    coords && targetLat != null && targetLon != null
      ? calculateDistanceMeters(coords.latitude, coords.longitude, targetLat, targetLon)
      : null;

  const isWithinRadius = liveDistance !== null ? liveDistance <= targetRadius : null;

  return (
    <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.88rem' }}>
          <MapPin size={16} color="var(--primary)" />
          <span>
            GPS Geolocation{' '}
            {isSimulated && (
              <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600 }}>(Office Coordinates)</span>
            )}
          </span>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} loading={loading} onClick={fetchLocation}>
          Refresh GPS
        </Button>
      </div>

      {/* Target Branch Radius Proximity Banner */}
      {targetLat != null && targetLon != null && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 6,
            backgroundColor: liveDistance === null ? '#f8fafc' : isWithinRadius ? '#f0fdf4' : '#fef2f2',
            border: liveDistance === null ? '1px solid #e2e8f0' : isWithinRadius ? '1px solid #bbf7d0' : '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 6,
            fontSize: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Compass size={14} color={isWithinRadius ? '#16a34a' : '#dc2626'} />
            <span>
              <strong>{targetName}:</strong> Radius {targetRadius}m
            </span>
          </div>
          {liveDistance !== null ? (
            <span
              style={{
                fontWeight: 700,
                color: isWithinRadius ? '#166534' : '#991b1b',
              }}
            >
              {isWithinRadius
                ? `✓ Within Range (${liveDistance}m away)`
                : `⚠️ Outside Range (${liveDistance}m away)`}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Calculating distance...</span>
          )}
        </div>
      )}

      {error && !coords ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.82rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
              ℹ️ Using office coordinates (GPS unavailable on this browser)
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Acquiring GPS location... (please ensure location permissions are allowed)
        </div>
      )}
    </div>
  );
};

export default GeoLocationPicker;
