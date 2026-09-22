/**
 * Geolocation & Haversine Distance Calculation Utilities
 */
import masterApi from '../api/masterApi';
import geoApi from '../api/geoApi';

/**
 * Calculates the great-circle distance between two GPS points using the Haversine formula.
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {number} Distance in meters (rounded to nearest integer)
 */
export const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const p1Lat = Number(lat1);
  const p1Lon = Number(lon1);
  const p2Lat = Number(lat2);
  const p2Lon = Number(lon2);

  if (
    isNaN(p1Lat) ||
    isNaN(p1Lon) ||
    isNaN(p2Lat) ||
    isNaN(p2Lon) ||
    p1Lat === 0 ||
    p1Lon === 0 ||
    p2Lat === 0 ||
    p2Lon === 0
  ) {
    return null;
  }

  const R = 6371000; // Earth's mean radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(p2Lat - p1Lat);
  const dLon = toRad(p2Lon - p1Lon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(p1Lat)) *
      Math.cos(toRad(p2Lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Resolves the branch coordinates and radius for an employee or user.
 * Supports: Branch object, Branch ID string, or fallback to fetching from API.
 * @param {string|object} branchRef
 * @returns {Promise<{ branchId: string, branchName: string, latitude: number, longitude: number, radiusMeters: number } | null>}
 */
export const resolveBranchLocation = async (branchRef) => {
  if (!branchRef) return null;

  let branchObj = null;
  let branchId = null;

  if (typeof branchRef === 'object' && branchRef !== null) {
    branchObj = branchRef;
    branchId = branchObj._id || branchObj.id;
  } else if (typeof branchRef === 'string') {
    branchId = branchRef;
  }

  // Check if coordinates already exist on the object
  const extractCoords = (b) => {
    if (!b) return null;
    const lat =
      b.latitude ??
      b.geoFence?.latitude ??
      b.centerLatitude ??
      b.address?.latitude;
    const lon =
      b.longitude ??
      b.geoFence?.longitude ??
      b.centerLongitude ??
      b.address?.longitude;
    const radius =
      b.radiusInMeters ??
      b.geoFence?.radiusInMeters ??
      b.radiusMeters ??
      500;

    if (lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      return {
        branchId: b._id || b.id || branchId,
        branchName: b.name || b.title || 'Assigned Branch',
        latitude: Number(lat),
        longitude: Number(lon),
        radiusMeters: Number(radius) || 500,
      };
    }
    return null;
  };

  const direct = extractCoords(branchObj);
  if (direct) return direct;

  // Otherwise, fetch fresh branch details from masterApi
  if (branchId) {
    try {
      const res = await masterApi.getBranchById(branchId);
      const bData = res?.data || res?.branch || res;
      const fetched = extractCoords(bData);
      if (fetched) return fetched;
    } catch {
      // Fallback to searching geofences
    }

    // Try finding in /geo/geofences
    try {
      const gRes = await geoApi.getGeoFences({ scope: 'BRANCH' });
      const fList = Array.isArray(gRes) ? gRes : gRes?.data || gRes?.geofences || [];
      const matchedFence = fList.find(
        (f) =>
          String(f.reference || f.referenceId) === String(branchId) ||
          String(f.name || '').toLowerCase().includes(String(branchObj?.name || '').toLowerCase())
      );
      if (matchedFence && matchedFence.centerLatitude && matchedFence.centerLongitude) {
        return {
          branchId,
          branchName: matchedFence.name || branchObj?.name || 'Assigned Branch',
          latitude: Number(matchedFence.centerLatitude),
          longitude: Number(matchedFence.centerLongitude),
          radiusMeters: Number(matchedFence.radiusMeters) || 500,
        };
      }
    } catch {
      // Return null if unresolved
    }
  }

  return null;
};
