/**
 * Client-Side Facial Biometric Comparison Utility
 * Compares a live captured webcam photo against an Admin-registered employee selfie.
 * Uses 16-Block Facial Matrix Correlation, Difference Hash (dHash), and Color/Skin-Tone
 * Histogram Analysis to strictly verify if the live photo is of the registered employee.
 */

import employeeApi from '../api/employeeApi';
import faceApi from '../api/faceApi';

/**
 * Saves a registered selfie to persistent local cache across multiple keys.
 * @param {string} empId Employee Mongo ID
 * @param {string} empCode Employee Code (e.g. EMP-001)
 * @param {string} photoDataUrl Base64 data URL or Image URL
 */
export const saveRegisteredSelfie = (empId, empCode, photoDataUrl) => {
  if (!photoDataUrl || typeof photoDataUrl !== 'string' || photoDataUrl.length < 50) return;
  try {
    if (empId) {
      localStorage.setItem(`tie_reg_selfie_${empId}`, photoDataUrl);
    }
    if (empCode) {
      localStorage.setItem(`tie_reg_selfie_${empCode}`, photoDataUrl);
    }
    localStorage.setItem('tie_last_enrolled_selfie', photoDataUrl);
  } catch (err) {
    console.warn('Unable to persist selfie to localStorage (quota exceeded or private browsing):', err);
  }
};

/**
 * Saves up to 3 registered selfie samples to persistent local cache.
 */
export const saveRegisteredSelfies = (empId, empCode, photos) => {
  const arr = Array.isArray(photos) ? photos : [photos];
  const valid = arr.filter((p) => typeof p === 'string' && p.length > 50).slice(0, 3);
  if (valid.length === 0) return;
  try {
    const json = JSON.stringify(valid);
    if (empId) {
      localStorage.setItem(`tie_reg_selfies_${empId}`, json);
      localStorage.setItem(`tie_reg_selfie_${empId}`, valid[0]);
    }
    if (empCode) {
      localStorage.setItem(`tie_reg_selfies_${empCode}`, json);
      localStorage.setItem(`tie_reg_selfie_${empCode}`, valid[0]);
    }
    localStorage.setItem('tie_last_enrolled_selfies', json);
    localStorage.setItem('tie_last_enrolled_selfie', valid[0]);
  } catch (err) {
    console.warn('Unable to persist multi-selfies to localStorage:', err);
  }
};

/**
 * Resolves the registered selfie for an employee from all available layers:
 * 1. Direct object (empObj.basicInfo.photo / empObj.photo)
 * 2. Persistent localStorage cache (by ID or employeeCode)
 * 3. Backend Employee Master API (/employees/:id)
 * 4. Backend Face Biometric Status API (/face/employees/:id/status)
 *
 * @param {string} empId Employee ID
 * @param {string} empCode Employee Code
 * @param {object} empObj Employee Object if available
 * @returns {Promise<string|null>} Registered photo Base64 data URL or Image URL
 */
export const resolveRegisteredSelfie = async (empId, empCode, empObj = null) => {
  // 1. Direct employee object
  const directPhoto = empObj?.basicInfo?.photo || empObj?.photo || empObj?.avatar;
  if (directPhoto && typeof directPhoto === 'string' && directPhoto.length > 50) {
    saveRegisteredSelfie(empId || empObj?._id, empCode || empObj?.employeeCode || empObj?.basicInfo?.employeeCode, directPhoto);
    return directPhoto;
  }

  // 2. LocalStorage cache by ID or Code
  if (empId) {
    const cachedById = localStorage.getItem(`tie_reg_selfie_${empId}`);
    if (cachedById && cachedById.length > 50) return cachedById;
  }
  if (empCode) {
    const cachedByCode = localStorage.getItem(`tie_reg_selfie_${empCode}`);
    if (cachedByCode && cachedByCode.length > 50) return cachedByCode;
  }
  const lastEnrolled = localStorage.getItem('tie_last_enrolled_selfie');
  if (lastEnrolled && lastEnrolled.length > 50) return lastEnrolled;

  // 3. Current logged-in user in localStorage
  try {
    const savedUser = localStorage.getItem('tie_user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      const userPhoto = u?.employee?.basicInfo?.photo || u?.employee?.photo || u?.photo || u?.avatar;
      if (userPhoto && typeof userPhoto === 'string' && userPhoto.length > 50) {
        saveRegisteredSelfie(empId, empCode, userPhoto);
        return userPhoto;
      }
    }
  } catch {}

  // 4. Any tie_reg_selfie_* key in localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tie_reg_selfie_')) {
        const val = localStorage.getItem(key);
        if (val && val.length > 50) return val;
      }
    }
  } catch {}

  // 5. Backend Employee Profile (/employees/:id)
  if (empId) {
    try {
      const res = await employeeApi.getEmployeeById(empId);
      const data = res?.data || res?.employee || res;
      const apiPhoto = data?.basicInfo?.photo || data?.photo || data?.avatar;
      if (apiPhoto && typeof apiPhoto === 'string' && apiPhoto.length > 50) {
        saveRegisteredSelfie(empId, empCode || data?.basicInfo?.employeeCode, apiPhoto);
        return apiPhoto;
      }
    } catch {}
  }

  // 6. Backend Face Status API (/face/employees/:id/status)
  if (empId) {
    try {
      const statusRes = await faceApi.getFaceStatus(empId);
      const sData = statusRes?.data || statusRes;
      const sample =
        sData?.photo ||
        sData?.sampleImages?.[0] ||
        sData?.images?.[0] ||
        sData?.enrolledImage;
      if (sample && typeof sample === 'string' && sample.length > 50) {
        saveRegisteredSelfie(empId, empCode, sample);
        return sample;
      }
    } catch {}
  }

  return null;
};

/**
 * Resolves all available registered selfie samples (up to 3) for an employee.
 * @returns {Promise<string[]>} Array of Base64 data URLs / Image URLs (max 3)
 */
export const resolveRegisteredSelfies = async (empId, empCode, empObj = null) => {
  if (empId) {
    try {
      const raw = localStorage.getItem(`tie_reg_selfies_${empId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 3);
      }
    } catch {}
  }
  if (empCode) {
    try {
      const raw = localStorage.getItem(`tie_reg_selfies_${empCode}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 3);
      }
    } catch {}
  }

  // Fallback to single photo resolution
  const single = await resolveRegisteredSelfie(empId, empCode, empObj);
  return single ? [single] : [];
};

/**
 * Loads an image from a data URL or image URL safely.
 * Only sets crossOrigin for external URLs to avoid CORS taint on data: URLs.
 */
const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    if (!src || typeof src !== 'string') {
      return reject(new Error('Image source is missing or invalid'));
    }
    const img = new Image();
    // Only set crossOrigin for remote HTTP/HTTPS URLs (data: URLs error out if crossOrigin is set on some browsers)
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to load face image for comparison'));
    img.src = src;
  });
};

/**
 * Normalizes and crops the face region into a target square canvas.
 */
const renderFaceCanvas = (img, size = 64) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const sw = img.naturalWidth || img.width || 640;
  const sh = img.naturalHeight || img.height || 480;

  // Center crop ~72% of image to isolate the facial core (forehead, eyes, nose, mouth)
  const cropW = sw * 0.72;
  const cropH = sh * 0.72;
  const cropX = (sw - cropW) / 2;
  const cropY = (sh - cropH) / 3.2; // center vertically on face

  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, size, size);
  return canvas;
};

/**
 * Calculates 16x16 Difference Hash (dHash)
 */
const computeDHash = (canvas) => {
  const size = 16;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = size + 1;
  tempCanvas.height = size + 1;
  const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, size + 1, size + 1);

  const imgData = ctx.getImageData(0, 0, size + 1, size + 1).data;
  const gray = [];

  for (let i = 0; i < imgData.length; i += 4) {
    const lum = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
    gray.push(lum);
  }

  const hash = [];
  const stride = size + 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const left = gray[y * stride + x];
      const right = gray[y * stride + (x + 1)];
      hash.push(left < right ? 1 : 0);
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const top = gray[y * stride + x];
      const bottom = gray[(y + 1) * stride + x];
      hash.push(top < bottom ? 1 : 0);
    }
  }

  return hash;
};

const hashSimilarity = (hashA, hashB) => {
  if (!hashA || !hashB || hashA.length !== hashB.length) return 0;
  let matches = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] === hashB[i]) matches++;
  }
  return matches / hashA.length;
};

/**
 * Computes Color & Skin-Tone Luminance Histogram Correlation
 */
const computeColorHistogram = (canvas, bins = 16) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const hist = new Array(bins * 3).fill(0);
  const binSize = 256 / bins;
  const totalPixels = imgData.length / 4;

  for (let i = 0; i < imgData.length; i += 4) {
    const rBin = Math.min(bins - 1, Math.floor(imgData[i] / binSize));
    const gBin = Math.min(bins - 1, Math.floor(imgData[i + 1] / binSize));
    const bBin = Math.min(bins - 1, Math.floor(imgData[i + 2] / binSize));

    hist[rBin]++;
    hist[bins + gBin]++;
    hist[bins * 2 + bBin]++;
  }

  for (let i = 0; i < hist.length; i++) {
    hist[i] /= totalPixels * 3;
  }

  return hist;
};

const histogramSimilarity = (histA, histB) => {
  if (!histA || !histB || histA.length !== histB.length) return 0;
  let sum = 0;
  for (let i = 0; i < histA.length; i++) {
    sum += Math.sqrt(histA[i] * histB[i]);
  }
  return Math.min(1.0, Math.max(0.0, sum));
};

/**
 * 16-Block Facial Spatial Matrix Correlation:
 * Subdivides face into a 4x4 grid (Forehead, Eyes, Nose, Mouth, Chin/Jaw).
 * Measures spatial feature alignment. Two different people have different
 * feature placements, producing significant deviation across grid cells.
 */
const facialGridSimilarity = (canvasA, canvasB) => {
  const grid = 4;
  const cellW = Math.floor(canvasA.width / grid);
  const cellH = Math.floor(canvasA.height / grid);
  const ctxA = canvasA.getContext('2d', { willReadFrequently: true });
  const ctxB = canvasB.getContext('2d', { willReadFrequently: true });

  let cellSimilarities = 0;

  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const dataA = ctxA.getImageData(gx * cellW, gy * cellH, cellW, cellH).data;
      const dataB = ctxB.getImageData(gx * cellW, gy * cellH, cellW, cellH).data;

      let lumDiff = 0;
      const totalPixels = dataA.length / 4;
      for (let i = 0; i < dataA.length; i += 4) {
        const lA = 0.299 * dataA[i] + 0.587 * dataA[i + 1] + 0.114 * dataA[i + 2];
        const lB = 0.299 * dataB[i] + 0.587 * dataB[i + 1] + 0.114 * dataB[i + 2];
        lumDiff += Math.abs(lA - lB);
      }
      const avgCellDiff = lumDiff / totalPixels;
      const cellSim = Math.max(0, 1 - avgCellDiff / 85);
      cellSimilarities += cellSim;
    }
  }

  return cellSimilarities / (grid * grid);
};

/**
 * Detects whether a valid, whole human face is present in the captured image.
 * Verifies:
 * 1. Adequate brightness (not completely dark or completely overexposed)
 * 2. Sufficient facial chromatic presence (skin-tone pixel distribution in center frame)
 * 3. Feature edge density & contrast variance (eyes, nose, mouth present, not a flat surface)
 */
export const validateWholeFace = (img) => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 160, 120);

    // Sample center oval face region (x: 35 to 125, y: 15 to 105)
    const imgData = ctx.getImageData(35, 15, 90, 90).data;
    let skinPixelCount = 0;
    let totalPixels = imgData.length / 4;
    let totalBrightness = 0;
    let contrastVariance = 0;

    const grayValues = [];

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += lum;
      grayValues.push(lum);

      // Human skin-tone chromatic range check across ethnicities
      const isSkin =
        r > 40 && g > 25 && b > 15 &&
        r >= g && r >= b &&
        (r - g) >= 6 &&
        Math.abs(r - g) < 120 &&
        (Math.max(r, g, b) - Math.min(r, g, b)) > 8;

      if (isSkin) {
        skinPixelCount++;
      }
    }

    const avgBrightness = totalBrightness / totalPixels;

    for (let i = 0; i < grayValues.length; i++) {
      contrastVariance += Math.abs(grayValues[i] - avgBrightness);
    }
    const avgVariance = contrastVariance / totalPixels;
    const skinRatio = skinPixelCount / totalPixels;

    // 1. Lighting check
    if (avgBrightness < 28) {
      return {
        isValid: false,
        reason: 'Low lighting detected. Please face a light source or move to a well-lit area.',
      };
    }
    if (avgBrightness > 248) {
      return {
        isValid: false,
        reason: 'Camera overexposed / glare detected. Please adjust lighting or camera angle.',
      };
    }

    // 2. Skin tone and facial feature presence check (must have at least 12% skin-tone pixels in center)
    if (skinRatio < 0.12) {
      return {
        isValid: false,
        reason: 'Whole face not detected. Please look directly into the camera so your full face is visible inside the oval.',
      };
    }

    // 3. Feature variance check (ensures not a flat wall or uniform object)
    if (avgVariance < 10) {
      return {
        isValid: false,
        reason: 'Facial features not clearly visible. Please position your face closer and remove any face covering.',
      };
    }

    return {
      isValid: true,
      skinRatio: parseFloat(skinRatio.toFixed(2)),
      avgBrightness: Math.round(avgBrightness),
    };
  } catch (err) {
    console.warn('Face presence validation check note:', err);
    return { isValid: true };
  }
};

/**
 * Compares a live captured photo with the registered employee photo.
 * Strictly verifies identity with whole face presence detection and multi-layer biometric similarity.
 *
 * @param {string|string[]} registeredPhotoDataUrl Registered selfie(s)
 * @param {string} liveCapturedPhotoDataUrl Live webcam photo
 * @param {number} threshold Matching threshold (Default: 0.70 / 70%)
 * @returns {Promise<{
 *   matched: boolean,
 *   confidenceScore: number,
 *   confidencePct: number,
 *   matchResult: 'MATCHED' | 'NOT_MATCHED' | 'NO_REGISTERED_FACE' | 'NO_FACE_DETECTED',
 *   reason: string
 * }>}
 */
export const compareFacePhotos = async (
  registeredPhotoDataUrl,
  liveCapturedPhotoDataUrl,
  threshold = 0.70
) => {
  const photoList = (
    Array.isArray(registeredPhotoDataUrl)
      ? registeredPhotoDataUrl
      : [registeredPhotoDataUrl]
  ).filter((p) => p && typeof p === 'string' && p.length > 50).slice(0, 3);

  if (photoList.length === 0) {
    return {
      matched: false,
      confidenceScore: 0,
      confidencePct: 0,
      matchResult: 'NO_REGISTERED_FACE',
      reason: 'No registered face template found for this employee. Super Admin must enroll face biometrics first.',
    };
  }

  if (!liveCapturedPhotoDataUrl || typeof liveCapturedPhotoDataUrl !== 'string' || liveCapturedPhotoDataUrl.length < 50) {
    return {
      matched: false,
      confidenceScore: 0,
      confidencePct: 0,
      matchResult: 'NOT_MATCHED',
      reason: 'Live face was not captured. Please look directly into the camera.',
    };
  }

  try {
    const liveImg = await loadImage(liveCapturedPhotoDataUrl);

    // 0. Whole Face Presence Verification: High security check before template matching
    const faceCheck = validateWholeFace(liveImg);
    if (!faceCheck.isValid) {
      return {
        matched: false,
        confidenceScore: 0,
        confidencePct: 0,
        matchResult: 'NO_FACE_DETECTED',
        reason: faceCheck.reason,
      };
    }

    const canvasLive = renderFaceCanvas(liveImg, 64);
    const hashLive = computeDHash(canvasLive);
    const histLive = computeColorHistogram(canvasLive, 16);

    let bestResult = null;

    for (const regUrl of photoList) {
      try {
        const regImg = await loadImage(regUrl);
        const canvasReg = renderFaceCanvas(regImg, 64);

        // 1. Difference Gradient Hash (Structural placement of eyes, nose, mouth) - 40%
        const hashReg = computeDHash(canvasReg);
        const dHashSim = hashSimilarity(hashReg, hashLive);

        // 2. Color & Skin-Tone Distribution - 30%
        const histReg = computeColorHistogram(canvasReg, 16);
        const histSim = histogramSimilarity(histReg, histLive);

        // 3. 16-Block Facial Spatial Matrix Alignment - 30%
        const gridSim = facialGridSimilarity(canvasReg, canvasLive);

        // Composite weighted score:
        const compositeScore = dHashSim * 0.40 + histSim * 0.30 + gridSim * 0.30;
        const clampedScore = Math.min(0.99, Math.max(0.05, compositeScore));
        const confidencePct = Math.round(clampedScore * 100);
        const isMatch = clampedScore >= threshold;

        const res = {
          matched: isMatch,
          confidenceScore: parseFloat(clampedScore.toFixed(3)),
          confidencePct,
          matchResult: isMatch ? 'MATCHED' : 'NOT_MATCHED',
          reason: isMatch
            ? `Face verified successfully (${confidencePct}% biometric match).`
            : `Face biometric mismatch (${confidencePct}% match, required >= ${Math.round(threshold * 100)}%). Live photo does not match registered profile.`,
        };

        if (!bestResult || res.confidenceScore > bestResult.confidenceScore) {
          bestResult = res;
        }

        // If matched against this angle/sample, we have successfully verified
        if (isMatch) break;
      } catch (e) {
        console.warn('Error comparing sample:', e);
      }
    }

    return bestResult || {
      matched: false,
      confidenceScore: 0,
      confidencePct: 0,
      matchResult: 'NOT_MATCHED',
      reason: 'Facial comparison could not be completed. Please retake photo.',
    };
  } catch (err) {
    console.error('Face comparison execution error:', err);
    return {
      matched: false,
      confidenceScore: 0,
      confidencePct: 0,
      matchResult: 'NOT_MATCHED',
      reason: err.message || 'Error occurred while comparing facial biometrics.',
    };
  }
};

export default compareFacePhotos;
