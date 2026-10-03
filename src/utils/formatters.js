/**
 * Utility functions for Date, Currency, and Backend Error formatting.
 * Strictly adheres to IST (Asia/Kolkata) time display and INR (₹) currency formatting.
 */

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Format a UTC date/timestamp string or Date object into IST format.
 * Options: 'date' | 'time' | 'datetime' | 'short' | 'monthYear'
 */
export const formatDateIST = (dateValue, formatType = 'datetime') => {
  if (!dateValue) return '—';
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return String(dateValue);

    switch (formatType) {
      case 'date':
        return new Intl.DateTimeFormat('en-IN', {
          timeZone: IST_TIMEZONE,
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).format(d);

      case 'time':
        return new Intl.DateTimeFormat('en-IN', {
          timeZone: IST_TIMEZONE,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(d);

      case 'short':
        return new Intl.DateTimeFormat('en-IN', {
          timeZone: IST_TIMEZONE,
          day: '2-digit',
          month: 'short',
        }).format(d);

      case 'monthYear':
        return new Intl.DateTimeFormat('en-IN', {
          timeZone: IST_TIMEZONE,
          month: 'short',
          year: 'numeric',
        }).format(d);

      case 'datetime':
      default:
        return new Intl.DateTimeFormat('en-IN', {
          timeZone: IST_TIMEZONE,
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(d);
    }
  } catch {
    return String(dateValue);
  }
};

/**
 * Formats date value as DD-MM-YYYY in IST
 */
export const formatDateOnlyIST = (dateValue) => formatDateIST(dateValue, 'date');

/**
 * Formats time value as hh:mm A in IST
 */
export const formatTimeIST = (dateValue) => formatDateIST(dateValue, 'time');


export const formatMoneyINR = (amount, includeDecimals = false) => {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '₹0';
  }
  const num = Number(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: includeDecimals ? 2 : 0,
    minimumFractionDigits: includeDecimals ? 2 : 0,
  }).format(num);
};

/**
 * Friendly mapped messages for backend attendance reasons
 */
export const ATTENDANCE_REASON_MAP = {
  NOT_ENROLLED: 'Your face is not registered. Contact HR.',
  NO_FACE_DETECTED: 'No face found. Look at the camera.',
  MULTIPLE_FACES_DETECTED: 'Only one person should be in the frame.',
  NOT_MATCHED: 'Face did not match. Try again in better light.',
  LOW_CONFIDENCE: 'Face did not match. Try again in better light.',
  LOW_GPS_ACCURACY: 'GPS signal weak. Wait a few seconds.',
  GEOFENCE_NOT_CONFIGURED: 'Office location is not set up. Contact HR.',
  OUTSIDE_GEOFENCE: 'You are outside the office area.',
  ALREADY_CHECKED_IN: 'You are already checked in. Check out first.',
  NO_OPEN_CHECKIN: 'No active check-in to check out from.',
  WORK_TYPE_MISMATCH: 'Your work type does not allow this.',
  SESSION_EXPIRED: 'You were logged in from another device.',
};

/**
 * Extracts friendly human-readable error message from backend error responses
 */
export const getErrorMessage = (error, defaultMsg = 'An error occurred') => {
  if (!error) return defaultMsg;
  const resData = error.response?.data;
  const reason = resData?.reason || resData?.code;
  if (reason && ATTENDANCE_REASON_MAP[reason]) {
    return ATTENDANCE_REASON_MAP[reason];
  }
  if (resData?.message) return resData.message;
  if (error.message) return error.message;
  return defaultMsg;
};
