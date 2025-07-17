import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Activity, Hand, BarChart3, CheckCircle, Play, ArrowRightCircle } from 'lucide-react';

// --- Data Models and Enums ---

const HandType = {
  LEFT: 'left',
  RIGHT: 'right',
  getEmoji: (hand) => hand === HandType.LEFT ? '👈' : '👉',
  getLabel: (hand) => hand === HandType.LEFT ? 'Left' : 'Right'
};

const ViewState = {
  WELCOME: 'welcome',
  TAPPING_INSTRUCTIONS: 'tapping_instructions',
  TAPPING_TEST: 'tapping_test',
  TAPPING_RESULTS: 'tapping_results',
  TREMOR_INSTRUCTIONS: 'tremor_instructions',
  TREMOR_TEST: 'tremor_test',
  TREMOR_RESULTS: 'tremor_results',
  FINAL_RESULTS: 'final_results'
};

// --- Tremor Analysis Component ---

const TremorVisualization = ({ tremorData, tremorOffset, isActive, onStart }) => {
  // Determine stability percentage for display
  const lastMagnitude = tremorData.length > 0 ? tremorData[tremorData.length - 1]?.magnitude : 0;
  // Invert magnitude for stability: higher magnitude = lower stability
  const stabilityPercentage = Math.max(0, (1 - (lastMagnitude * 5)) * 100).toFixed(1); // Scale magnitude for better visual representation of stability

  return (
    <div className="flex flex-col items-center space-y-6">
      <div
        className="relative cursor-pointer"
        onClick={!isActive ? onStart : undefined}
        style={{ width: '400px', height: '400px' }}
      >
        {/* Outer green circle - main gyroscope body */}
        <div className="absolute inset-0 rounded-full border-8 border-green-500 bg-green-100 shadow-2xl">
          {/* Inner concentric circles for depth */}
          <div className="absolute inset-4 rounded-full border-2 border-green-400 bg-green-50">
            <div className="absolute inset-4 rounded-full border-1 border-green-300">
              {/* Cross-hairs for reference - like a real gyroscope */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1 h-full bg-green-300 opacity-50"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-1 w-full bg-green-300 opacity-50"></div>
              </div>

              {/* Concentric reference circles */}
              <div className="absolute inset-16 rounded-full border border-green-200"></div>
              <div className="absolute inset-24 rounded-full border border-green-200"></div>
              <div className="absolute inset-32 rounded-full border border-green-200"></div>
            </div>
          </div>
        </div>

        {/* Moving red dot - gyroscope indicator */}
        <div
          className={`absolute w-6 h-6 rounded-full transition-all duration-75 shadow-lg ${
            isActive ? 'bg-red-500 border-2 border-red-700' : 'bg-gray-400 border-2 border-gray-600'
          }`}
          style={{
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translate(${tremorOffset.x}px, ${tremorOffset.y}px)`,
            zIndex: 10
          }}
        />

        {/* Center equilibrium point */}
        <div className="absolute w-3 h-3 bg-green-700 rounded-full border border-green-800"
             style={{
               left: '50%',
               top: '50%',
               transform: 'translate(-50%, -50%)',
               zIndex: 5
             }}
        />

        {/* Tap to start text */}
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center text-green-700 font-bold text-2xl pointer-events-none bg-white bg-opacity-80 rounded-full">
            TAP TO START
          </div>
        )}

        {/* Gyroscope labels */}
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-sm font-semibold text-green-700">
          TREMOR GYROSCOPE
        </div>
        <div className="absolute -left-12 top-1/2 transform -translate-y-1/2 -rotate-90 text-xs text-green-600">
          Y-AXIS
        </div>
        <div className="absolute -right-12 top-1/2 transform -translate-y-1/2 rotate-90 text-xs text-green-600">
          Y-AXIS
        </div>
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-green-600">
          X-AXIS
        </div>
      </div>

      {/* Real-time sensor data display */}
      {isActive && tremorData.length > 0 && (
        <div className="w-full max-w-lg">
          <div className="bg-white p-6 rounded-lg border shadow-lg">
            <h4 className="font-bold mb-4 text-gray-800 text-center">Real-time Gyroscope Data</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="text-center bg-red-50 p-3 rounded">
                <div className="text-xs text-red-600 mb-1 font-semibold">X-Axis</div>
                <div className="font-mono font-bold text-red-700">
                  {tremorData[tremorData.length - 1]?.x?.toFixed(3) || '0.000'}
                </div>
              </div>
              <div className="text-center bg-red-50 p-3 rounded">
                <div className="text-xs text-red-600 mb-1 font-semibold">Y-Axis</div>
                <div className="font-mono font-bold text-red-700">
                  {tremorData[tremorData.length - 1]?.y?.toFixed(3) || '0.000'}
                </div>
              </div>
              <div className="text-center bg-red-50 p-3 rounded">
                <div className="text-xs text-red-600 mb-1 font-semibold">Z-Axis</div>
                <div className="font-mono font-bold text-red-700">
                  {tremorData[tremorData.length - 1]?.z?.toFixed(3) || '0.000'}
                </div>
              </div>
              <div className="text-center bg-green-50 p-3 rounded">
                <div className="text-xs text-green-600 mb-1 font-semibold">Magnitude</div>
                <div className="font-mono font-bold text-green-700">
                  {tremorData[tremorData.length - 1]?.magnitude?.toFixed(4) || '0.0000'}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t text-center">
              {/* Displaying stability percentage */}
              <div className="text-sm text-gray-600">
                Stability: {stabilityPercentage}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Hand Movement Assessment Component ---

const HandMovementAssessment = () => {
  const [currentView, setCurrentView] = useState(ViewState.WELCOME);
  const [currentHand, setCurrentHand] = useState(HandType.LEFT);
  const [isTestActive, setIsTestActive] = useState(false); // For tapping test
  const [isTremorTestActive, setIsTremorTestActive] = useState(false); // For tremor test
  const [tapCount, setTapCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(20);
  const [tremorTimeRemaining, setTremorTimeRemaining] = useState(10);
  const [currentFrequency, setCurrentFrequency] = useState(0);
  const [tremorOffset, setTremorOffset] = useState({ x: 0, y: 0 });

  const [session, setSession] = useState({
    leftTapping: null,
    rightTapping: null,
    leftTremor: null,
    rightTremor: null
  });

  const [tapTimes, setTapTimes] = useState([]);
  const [tremorData, setTremorData] = useState([]); // This state is for visualization
  const [testStartTime, setTestStartTime] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const timerRef = useRef(null);
  const motionDataRef = useRef([]); // This ref stores ALL raw motion data for analysis
  const lastCallRef = useRef(0); // For throttling handleMotionEvent

  // Sensor handling (throttled)
  // Ensures handleMotionEvent is stable and its reference doesn't change unexpectedly,
  // preventing re-registration issues for event listener.
  const handleMotionEvent = useCallback((event) => {
    const now = Date.now();
    // Throttle to approximately 20Hz (50ms interval) to avoid overwhelming state updates
    if (now - (lastCallRef.current || 0) < 50) { // Read from ref
      return;
    }
    lastCallRef.current = now; // Write to ref

    const accel = event.acceleration || event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };

    if (isTremorTestActive) {
      // Calculate magnitude (total acceleration)
      const magnitude = Math.sqrt(
        (accel.x * accel.x) +
        (accel.y * accel.y) +
        (accel.z * accel.z)
      );

      const motionPoint = {
        x: accel.x,
        y: accel.y,
        z: accel.z,
        magnitude: magnitude,
        timestamp: now
      };

      // Push to ref for full data collection for analysis
      motionDataRef.current.push(motionPoint);

      // Update tremorOffset for real-time visual gyroscope effect
      // Scaling factor and maxOffset ensure the dot stays within the circle
      const scaleFactor = 150; // Adjust sensitivity of the dot movement
      const maxOffset = 180;  // Max pixel offset from center for a 400px circle

      setTremorOffset({
        x: Math.max(-maxOffset, Math.min(maxOffset, accel.x * scaleFactor)),
        y: Math.max(-maxOffset, Math.min(maxOffset, accel.y * scaleFactor))
      });

      // Update tremorData state for the real-time display (keep last N points)
      setTremorData(prev => {
        const newData = [...prev, motionPoint];
        return newData.slice(-50); // Keep only the last 50 points for display (2.5 seconds at 20Hz)
      });
    }
  }, [isTremorTestActive]); // Re-create if isTremorTestActive changes

  // Permission handling
  const requestSensorPermissions = useCallback(async () => {
    try {
      let granted = false;
      // Check if DeviceMotionEvent.requestPermission is available (iOS 13+ requirement)
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const permission = await DeviceMotionEvent.requestPermission();
        granted = permission === 'granted';
      } else {
        // For non-iOS 13+ devices or browsers, assume permission is implicitly granted
        // This means on Android/desktop, devicemotion events should fire by default
        granted = true;
      }
      setPermissionGranted(granted);
      if (granted) {
        // Add event listener only once after permission is granted
        window.addEventListener('devicemotion', handleMotionEvent, { passive: true });
      } else {
        console.warn('DeviceMotion permission not granted.');
        alert('Sensor access denied. Tremor analysis may not work. Please enable motion sensors in your device settings if available.');
      }
      return granted;
    } catch (error) {
      console.error('Permission request failed:', error);
      setPermissionGranted(false);
      alert('Failed to request sensor permissions. Tremor analysis may not work. Ensure your device supports motion sensors.');
      return false;
    }
  }, [handleMotionEvent]);


  // Tapping test functions
  const startTappingTest = useCallback((hand) => {
    setIsTestActive(true);
    setTimeRemaining(20);
    setTapCount(0);
    setTapTimes([]); // Clear tap times for a new test
    setCurrentFrequency(0);
    setTestStartTime(Date.now()); // Set start time when test actually begins

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 0.1;
        if (newTime <= 0) {
          finishTappingTest(hand);
          return 0;
        }
        return newTime;
      });
    }, 100);
  }, [analyzeTappingData, tapTimes]); // Added analyzeTappingData and tapTimes to dependencies

  const handleTap = useCallback(() => {
    if (!isTestActive || timeRemaining <= 0) return;

    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);

    if (testStartTime) {
      const currentTimeInSeconds = (Date.now() - testStartTime) / 1000;
      setTapTimes(prev => {
        const newTapTimes = [...prev, currentTimeInSeconds];
        // Update frequency only if time has passed to avoid division by zero
        if (currentTimeInSeconds > 0) {
            setCurrentFrequency(newTapCount / currentTimeInSeconds);
        }
        return newTapTimes;
      });
    }
  }, [isTestActive, timeRemaining, tapCount, testStartTime]);

  const finishTappingTest = useCallback((hand) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsTestActive(false);

    // Ensure analysis uses the final tapTimes and tapCount
    const analysis = analyzeTappingData();

    const result = {
      hand,
      tapCount,
      averageFrequency: analysis.avgFreq,
      consistency: analysis.consistency,
      score: analysis.score,
      tapTimes: [...tapTimes], // Make a copy
      peakFrequency: analysis.peakFrequency,
      fatigueIndex: analysis.fatigueIndex,
      rhythmStability: analysis.rhythmStability,
      accelerationPhase: analysis.accelerationPhase,
      decelerationPhase: analysis.decelerationPhase,
      grade: getGrade(analysis.score)
    };

    setSession(prev => ({
      ...prev,
      [`${hand}Tapping`]: result
    }));

    setCurrentView(ViewState.TAPPING_RESULTS);
  }, [tapCount, tapTimes, analyzeTappingData, getGrade]);

  // Tremor test functions
  const startTremorTest = useCallback((hand) => {
    // Crucially reset motionDataRef.current for a new tremor test
    motionDataRef.current = [];
    setTremorData([]); // Clear real-time display data as well
    setIsTremorTestActive(true);
    setTremorTimeRemaining(10);
    setTremorOffset({ x: 0, y: 0 }); // Reset visual offset

    timerRef.current = setInterval(() => {
      setTremorTimeRemaining(prev => {
        const newTime = prev - 0.1;
        if (newTime <= 0) {
          finishTremorTest(hand);
          return 0;
        }
        return newTime;
      });
    }, 100);
  }, [analyzeTremorData]); // Added analyzeTremorData to dependencies

  const finishTremorTest = useCallback((hand) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsTremorTestActive(false); // Stop active state for tremor test
    setTremorOffset({ x: 0, y: 0 }); // Reset visual dot to center

    // Analyze data from the motionDataRef.current (all collected data points)
    const analysis = analyzeTremorData();

    const result = {
      hand,
      frequency: analysis.frequency,
      amplitude: analysis.amplitude,
      severity: analysis.severity,
      xAxisAmplitude: analysis.xAxisAmplitude,
      yAxisAmplitude: analysis.yAxisAmplitude,
      zAxisAmplitude: analysis.zAxisAmplitude,
      dominantAxis: analysis.dominantAxis,
      tremorsPerSecond: analysis.tremorsPerSecond,
      maxAmplitude: analysis.maxAmplitude,
      amplitudeVariability: analysis.amplitudeVariability,
      hasTremor: analysis.amplitude > 0.02 // Threshold for detecting tremor
    };

    setSession(prev => ({
      ...prev,
      [`${hand}Tremor`]: result
    }));

    setCurrentView(ViewState.TREMOR_RESULTS);
  }, [analyzeTremorData]);

  // Analysis functions
  const analyzeTappingData = useCallback(() => {
    if (tapTimes.length === 0 || tapCount === 0) { // Added tapCount check for robustness
      return {
        avgFrequency: 0, consistency: 0, score: 0, peakFrequency: 0,
        fatigueIndex: 0, rhythmStability: 0, accelerationPhase: 0, decelerationPhase: 0
      };
    }

    const totalTestDuration = 20.0; // The fixed duration of the tapping test
    const avgFreq = tapCount / totalTestDuration;
    const consistency = calculateConsistency();
    const peakFreq = calculatePeakFrequency();
    const fatigueIndex = calculateFatigueIndex();
    const rhythmStability = calculateRhythmStability();
    const [accelPhase, decelPhase] = calculatePhases();

    const freqScore = Math.min(100, avgFreq * 12);
    const consistencyScore = consistency * 100;
    const peakScore = Math.min(100, peakFreq * 8);
    const fatigueScore = Math.max(0, (1 - fatigueIndex) * 100);

    const score = Math.max(0, Math.min(100,
      (freqScore * 0.3) +
      (consistencyScore * 0.25) +
      (peakScore * 0.25) +
      (fatigueScore * 0.2)
    ));

    return {
      avgFrequency: parseFloat(avgFreq.toFixed(2)),
      consistency: parseFloat(consistency.toFixed(3)),
      score: parseFloat(score.toFixed(1)),
      peakFrequency: parseFloat(peakFreq.toFixed(2)),
      fatigueIndex: parseFloat(fatigueIndex.toFixed(3)),
      rhythmStability: parseFloat(rhythmStability.toFixed(3)),
      accelerationPhase: parseFloat(accelPhase.toFixed(2)),
      decelerationPhase: parseFloat(decelPhase.toFixed(2))
    };
  }, [tapCount, tapTimes, calculateConsistency, calculatePeakFrequency, calculateFatigueIndex, calculateRhythmStability, calculatePhases]);

  const analyzeTremorData = useCallback(() => {
    const data = motionDataRef.current; // Use the ref for full data
    if (!data || data.length < 20) { // Need sufficient data points for meaningful analysis
      return {
        frequency: 0, amplitude: 0, severity: 'None', xAxisAmplitude: 0, yAxisAmplitude: 0,
        zAxisAmplitude: 0, dominantAxis: 'None', tremorsPerSecond: 0, maxAmplitude: 0, amplitudeVariability: 0
      };
    }

    const xData = data.map(d => Math.abs(d.x));
    const yData = data.map(d => Math.abs(d.y));
    const zData = data.map(d => Math.abs(d.z));

    const xAxisAmp = xData.reduce((sum, val) => sum + val, 0) / xData.length;
    const yAxisAmp = yData.reduce((sum, val) => sum + val, 0) / yData.length;
    const zAxisAmp = zData.reduce((sum, val) => sum + val, 0) / zData.length;

    let dominantAxis = 'X (Side-to-side)';
    if (yAxisAmp >= xAxisAmp && yAxisAmp >= zAxisAmp) {
      dominantAxis = 'Y (Forward-back)';
    } else if (zAxisAmp >= xAxisAmp && zAxisAmp >= yAxisAmp) {
      dominantAxis = 'Z (Up-down)';
    }

    const magnitudes = data.map(d => d.magnitude);
    const amplitude = magnitudes.reduce((sum, val) => sum + val, 0) / magnitudes.length;
    const maxAmplitude = Math.max(...magnitudes);
    const amplitudeVariability = calculateAmplitudeVariability(magnitudes);
    const frequency = estimateFrequency(magnitudes);

    let severity = 'None';
    if (amplitude >= 0.25) severity = 'Very Severe';
    else if (amplitude >= 0.15) severity = 'Severe';
    else if (amplitude >= 0.08) severity = 'Moderate';
    else if (amplitude >= 0.04) severity = 'Mild';
    else if (amplitude >= 0.02) severity = 'Minimal';

    return {
      frequency: parseFloat(frequency.toFixed(2)),
      amplitude: parseFloat(amplitude.toFixed(4)),
      severity,
      xAxisAmplitude: parseFloat(xAxisAmp.toFixed(4)),
      yAxisAmplitude: parseFloat(yAxisAmp.toFixed(4)),
      zAxisAmplitude: parseFloat(zAxisAmp.toFixed(4)),
      dominantAxis,
      tremorsPerSecond: parseFloat(frequency.toFixed(2)),
      maxAmplitude: parseFloat(maxAmplitude.toFixed(4)),
      amplitudeVariability: parseFloat(amplitudeVariability.toFixed(4))
    };
  }, [calculateAmplitudeVariability, estimateFrequency]);


  // Helper functions for analysis (kept as before, ensuring useCallback for performance)
  const calculateConsistency = useCallback(() => {
    if (tapTimes.length < 2) return 0;
    const intervals = [];
    for (let i = 1; i < tapTimes.length; i++) { intervals.push(tapTimes[i] - tapTimes[i - 1]); }
    if (intervals.length === 0) return 0;
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    if (mean === 0) return 0;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, Math.min(1, 1 - (stdDev / mean)));
  }, [tapTimes]);

  const calculatePeakFrequency = useCallback(() => {
    if (tapTimes.length < 3) return 0;
    let maxFreq = 0;
    const windowSize = 3.0;
    for (let i = 0; i < tapTimes.length; i++) {
      const windowStart = tapTimes[i];
      const windowEnd = windowStart + windowSize;
      const tapsInWindow = tapTimes.filter(t => t >= windowStart && t <= windowEnd).length;
      if (tapsInWindow > 1) {
        const freq = tapsInWindow / windowSize;
        maxFreq = Math.max(maxFreq, freq);
      }
    }
    return maxFreq;
  }, [tapTimes]);

  const calculateFatigueIndex = useCallback(() => {
    if (tapTimes.length < 6) return 0;
    const thirdSize = Math.floor(tapTimes.length / 3);
    if (thirdSize < 2) return 0;
    const firstThird = tapTimes.slice(0, thirdSize);
    const lastThird = tapTimes.slice(-thirdSize);
    if (firstThird.length === 0 || lastThird.length === 0) return 0;
    const firstDuration = firstThird[firstThird.length - 1] - firstThird[0];
    const lastDuration = lastThird[lastThird.length - 1] - lastThird[0];
    if (firstDuration === 0 || lastDuration === 0) return 0;
    const firstFreq = (firstThird.length - 1) / firstDuration;
    const lastFreq = (lastThird.length - 1) / lastDuration;
    if (firstFreq === 0) return 0;
    return Math.max(0, Math.min(1, (firstFreq - lastFreq) / firstFreq));
  }, [tapTimes]);

  const calculateRhythmStability = useCallback(() => {
    if (tapTimes.length < 3) return 0;
    const intervals = [];
    for (let i = 1; i < tapTimes.length; i++) { intervals.push(tapTimes[i] - tapTimes[i - 1]); }
    if (intervals.length === 0) return 0;
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    if (mean === 0) return 0;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stability = Math.max(0, Math.min(1, 1 - (Math.sqrt(variance) / mean)));
    return stability;
  }, [tapTimes]);

  const calculatePhases = useCallback(() => {
    if (tapTimes.length < 5) return [0, 0];
    let peakIndex = 0;
    let maxLocalFreq = 0;
    for (let i = 2; i < tapTimes.length - 2; i++) {
      const windowStart = Math.max(0, i - 2);
      const windowEnd = Math.min(tapTimes.length - 1, i + 2);
      const localTaps = tapTimes.slice(windowStart, windowEnd + 1);
      if (localTaps.length > 1) {
        const duration = localTaps[localTaps.length - 1] - localTaps[0];
        if (duration > 0) {
          const localFreq = (localTaps.length - 1) / duration;
          if (localFreq > maxLocalFreq) {
            maxLocalFreq = localFreq;
            peakIndex = i;
          }
        }
      }
    }
    const accelerationPhase = tapTimes[peakIndex] || 0;
    const decelerationPhase = 20.0 - accelerationPhase;
    return [accelerationPhase, Math.max(0, decelerationPhase)];
  }, [tapTimes]);

  const calculateAmplitudeVariability = useCallback((magnitudes) => {
    if (magnitudes.length < 2) return 0;
    const mean = magnitudes.reduce((sum, val) => sum + val, 0) / magnitudes.length;
    const variance = magnitudes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / magnitudes.length;
    return Math.sqrt(variance);
  }, []);

  const estimateFrequency = useCallback((data) => {
    if (data.length < 20) return 0;
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const centered = data.map(val => val - mean);
    let crossings = 0;
    for (let i = 1; i < centered.length; i++) {
      if ((centered[i - 1] > 0 && centered[i] <= 0) || (centered[i - 1] <= 0 && centered[i] > 0)) {
        crossings++;
      }
    }
    const samplingRate = 20; // Hz, based on 50ms throttling in handleMotionEvent
    const duration = data.length / samplingRate;
    const frequency = (crossings / 2.0) / duration;
    return Math.max(0, frequency);
  }, []);


  const getGrade = (score) => {
    if (score >= 70) return 'Normal';
    if (score >= 50) return 'Mild Impairment';
    if (score >= 30) return 'Moderate Impairment';
    if (score >= 15) return 'Significant Impairment';
    return 'Severe Impairment';
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  // --- Navigation Logic ---
  const startAssessment = useCallback(async () => {
    // Request permissions only once at the start of the whole assessment
    if (!permissionGranted) {
      const granted = await requestSensorPermissions();
      if (!granted) {
        alert("Cannot proceed without sensor permissions for tremor analysis. Please allow access in device settings.");
        return;
      }
    }
    setCurrentHand(HandType.LEFT);
    setCurrentView(ViewState.TAPPING_INSTRUCTIONS);
  }, [permissionGranted, requestSensorPermissions]);


  const handleProceed = useCallback(() => {
    // Logic to navigate based on current view and completed tests
    if (currentView === ViewState.TAPPING_RESULTS) {
      setCurrentView(ViewState.TREMOR_INSTRUCTIONS);
    } else if (currentView === ViewState.TREMOR_RESULTS) {
      if (currentHand === HandType.LEFT) {
        setCurrentHand(HandType.RIGHT);
        setCurrentView(ViewState.TAPPING_INSTRUCTIONS); // Start right hand tapping
      } else {
        setCurrentView(ViewState.FINAL_RESULTS); // All tests complete
      }
    } else if (currentView === ViewState.TAPPING_INSTRUCTIONS) {
        setCurrentView(ViewState.TAPPING_TEST);
    } else if (currentView === ViewState.TREMOR_INSTRUCTIONS) {
        setCurrentView(ViewState.TREMOR_TEST);
    }
  }, [currentView, currentHand]); // Removed session from dependency as it's not directly used for navigation logic here

  const restartTest = useCallback(() => {
    setSession({
      leftTapping: null,
      rightTapping: null,
      leftTremor: null,
      rightTremor: null
    });
    setCurrentHand(HandType.LEFT);
    setCurrentView(ViewState.WELCOME);
    setIsTestActive(false);
    setIsTremorTestActive(false);
    setTapCount(0);
    setTimeRemaining(20);
    setTremorTimeRemaining(10);
    setCurrentFrequency(0);
    setTremorOffset({ x: 0, y: 0 });
    setTapTimes([]);
    setTremorData([]);
    motionDataRef.current = []; // Crucial to clear motion data ref on restart
  }, []);

  // --- Cleanup Effect ---
  // This useEffect ensures that timers are cleared and event listeners are removed
  // when the component unmounts or when handleMotionEvent changes.
  useEffect(() => {
    // Clean up function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Only remove if the listener was actually added
      if (permissionGranted) { // Check if permission was granted before removing
        window.removeEventListener('devicemotion', handleMotionEvent);
      }
    };
  }, [handleMotionEvent, permissionGranted]); // Add permissionGranted to dependencies


  // --- Render Functions for Each View State ---

  const renderWelcome = () => (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <Hand className="mx-auto mb-6 text-blue-600" size={80} />
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Hand Movement Analysis</h1>
        <p className="text-lg text-gray-600">
          A comprehensive assessment of hand motor function and tremor for clinical insights.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex items-center p-4 bg-blue-50 rounded-lg">
          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-4">1</div>
          <div>
            <h3 className="font-semibold text-lg text-blue-800">Finger Tapping Test</h3>
            <p className="text-gray-600">Measures motor speed and consistency (20 seconds).</p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-orange-50 rounded-lg">
          <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold mr-4">2</div>
          <div>
            <h3 className="font-semibold text-lg text-orange-800">Tremor Analysis</h3>
            <p className="text-gray-600">Assesses involuntary hand movements using device sensors (10 seconds).</p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-green-50 rounded-lg">
          <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold mr-4">3</div>
          <div>
            <h3 className="font-semibold text-lg text-green-800">Bilateral Analysis & Clinical Recommendations</h3>
            <p className="text-gray-600">Detailed insights for both hands, scores, and potential recommendations.</p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={startAssessment}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold py-4 px-8 rounded-lg transition-colors shadow-md"
        >
          Start New Assessment
        </button>
      </div>
    </div>
  );

  const renderTappingInstructions = () => (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
            {HandType.getEmoji(currentHand)} {HandType.getLabel(currentHand)} Hand
        </h2>
        <h3 className="text-xl text-blue-700 mb-6">Finger Tapping Test Instructions</h3>
        <p className="text-lg text-gray-700 mb-4">
            Place your device on a flat, stable surface. Use your {HandType.getLabel(currentHand).toLowerCase()} index finger to tap the large button as rapidly and consistently as possible for 20 seconds.
        </p>
        <p className="text-md text-gray-600 mb-8">
            Ensure the device does not move significantly during the tapping test.
        </p>
        <button
            onClick={handleProceed}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold py-4 px-8 rounded-lg transition-colors shadow-md flex items-center justify-center mx-auto"
        >
            Start Tapping Test <ArrowRightCircle className="ml-3" size={24} />
        </button>
    </div>
  );


  const renderTappingTest = () => (
    <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          {HandType.getEmoji(currentHand)} {HandType.getLabel(currentHand)} Hand
        </h2>
        <h3 className="text-xl text-blue-700 mb-4">Finger Tapping Test</h3>

        {isTestActive ? (
          <div className="text-8xl font-bold text-blue-600 mb-4">
            {Math.ceil(timeRemaining)}
          </div>
        ) : (
          <p className="text-xl text-gray-600">Tap the button as fast as you can!</p>
        )}
      </div>

      <div className="flex justify-center mb-8">
        <button
          onClick={isTestActive ? handleTap : () => startTappingTest(currentHand)}
          className={`rounded-full text-5xl font-bold transition-all duration-150 shadow-2xl ${
            isTestActive
              ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white scale-100 hover:scale-105 active:scale-95'
              : 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white scale-100 hover:scale-105 active:scale-95'
          }`}
          style={{
            width: '350px',
            height: '350px',
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none'
          }}
          disabled={isTestActive && timeRemaining <= 0} // Disable button when time is up
        >
          <div className="flex flex-col items-center justify-center">
            {isTestActive ? (
              <>
                <div className="text-8xl font-bold mb-4">{tapCount}</div>
                <div className="text-3xl">TAPS</div>
              </>
            ) : (
              <div className="text-4xl">START</div>
            )}
          </div>
        </button>
      </div>

      {isTestActive && (
        <div className="text-center space-y-6">
          <p className="text-2xl font-bold text-blue-600">
            Frequency: {currentFrequency.toFixed(1)} taps/sec
          </p>
          <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-6">
            <div
              className="bg-blue-600 h-6 rounded-full transition-all duration-300"
              style={{ width: `${((20 - timeRemaining) / 20) * 100}%` }}
            />
          </div>
          <p className="text-lg text-gray-600">
            Keep tapping as fast as possible!
          </p>
        </div>
      )}
    </div>
  );

  const renderTappingResults = () => {
    const tapping = session[`${currentHand}Tapping`];
    if (!tapping) {
      return (
        <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Error: Tapping Results Not Found</h2>
            <p className="text-lg text-gray-600">There was an issue retrieving the tapping test results. Please try again.</p>
            <button
                onClick={restartTest}
                className="mt-6 bg-red-600 hover:bg-red-700 text-white text-lg font-semibold py-3 px-6 rounded-lg transition-colors shadow-md"
            >
                Restart Assessment
            </button>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            {HandType.getEmoji(currentHand)} {HandType.getLabel(currentHand)} Hand - Tapping Results
          </h2>
          <p className="text-xl text-blue-700 mb-6">Test Complete! Review your performance.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-blue-50 p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-bold text-blue-800 mb-4">Summary</h3>
            <div className="space-y-2 text-lg">
              <div className="flex justify-between">
                <span>Total Taps:</span>
                <span className="font-bold text-blue-900">{tapping.tapCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg. Frequency:</span>
                <span className="font-bold text-blue-900">{tapping.averageFrequency.toFixed(1)} taps/sec</span>
              </div>
              <div className="flex justify-between">
                <span>Consistency:</span>
                <span className="font-bold text-blue-900">{(tapping.consistency * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Score:</span>
                <span className={`font-bold ${getScoreColor(tapping.score)}`}>
                  {tapping.score.toFixed(0)} - {tapping.grade}
                </span>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 p-6 rounded-lg shadow-sm">
             <h3 className="text-xl font-bold text-blue-800 mb-4">Detailed Metrics</h3>
             <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span>Peak Frequency:</span>
                    <span className="font-semibold">{tapping.peakFrequency.toFixed(2)} taps/sec</span>
                </div>
                <div className="flex justify-between">
                    <span>Rhythm Stability:</span>
                    <span className="font-semibold">{(tapping.rhythmStability * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                    <span>Fatigue Index:</span>
                    <span className="font-semibold">{tapping.fatigueIndex.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Acceleration Phase:</span>
                    <span className="font-semibold">{tapping.accelerationPhase.toFixed(2)} sec</span>
                </div>
                <div className="flex justify-between">
                    <span>Deceleration Phase:</span>
                    <span className="font-semibold">{tapping.decelerationPhase.toFixed(2)} sec</span>
                </div>
             </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={handleProceed}
            className="bg-orange-600 hover:bg-orange-700 text-white text-xl font-semibold py-4 px-8 rounded-lg transition-colors shadow-md flex items-center justify-center mx-auto"
          >
            Proceed to Tremor Test <ArrowRightCircle className="ml-3" size={24} />
          </button>
        </div>
      </div>
    );
  };

  const renderTremorInstructions = () => (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
            {HandType.getEmoji(currentHand)} {HandType.getLabel(currentHand)} Hand
        </h2>
        <h3 className="text-xl text-orange-700 mb-6">Tremor Analysis Instructions</h3>
        <p className="text-lg text-gray-700 mb-4">
            Hold your device firmly and steadily in your {HandType.getLabel(currentHand).toLowerCase()} hand, outstretched in front of you. Try to keep your hand as still as possible for 10 seconds.
        </p>
        <p className="text-md text-gray-600 mb-8">
            Avoid large movements and maintain a comfortable, stable position. The red dot will visualize your movement.
        </p>
        <button
            onClick={handleProceed}
            className="bg-orange-600 hover:bg-orange-700 text-white text-xl font-semibold py-4 px-8 rounded-lg transition-colors shadow-md flex items-center justify-center mx-auto"
        >
            Start Tremor Test <ArrowRightCircle className="ml-3" size={24} />
        </button>
    </div>
  );


  const renderTremorTest = () => (
    <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          {HandType.getEmoji(currentHand)} {HandType.getLabel(currentHand)} Hand
        </h2>
        <h3 className="text-xl text-orange-700 mb-4">Tremor Analysis</h3>

        {isTremorTestActive ? (
          <div className="text-8xl font-bold text-orange-600 mb-4">
            {Math.ceil(tremorTimeRemaining)}
          </div>
        ) : (
          <p className="text-xl text-gray-600">Hold your phone steady with this hand</p>
        )}
      </div>

      <div className="flex justify-center mb-8">
        <TremorVisualization
          tremorData={tremorData} // Pass tremorData for real-time visualization
          tremorOffset={tremorOffset} // Pass tremorOffset for dot position
          isActive={isTremorTestActive}
          onStart={() => startTremorTest(currentHand)}
        />
      </div>

      {isTremorTestActive && (
        <div className="text-center space-y-6">
          <p className="text-2xl font-bold text-orange-600">
            Keep phone as steady as possible
          </p>
          <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-6">
            <div
              className="bg-orange-600 h-6 rounded-full transition-all duration-300"
              style={{ width: `${((10 - tremorTimeRemaining) / 10) * 100}%` }}
            />
          </div>
          <p className="text-lg text-gray-600">
            Red dot shows your hand movement
          </p>
        </div>
      )}
    </div>
  );

  const renderTremorResults = () => {
    const tremor = session[`${currentHand}Tremor`];
    if (!tremor) {
        return (
            <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Error: Tremor Results Not Found</h2>
                <p className="text-lg text-gray-600">There was an issue retrieving the tremor test results. Please try again.</p>
                <button
                    onClick={restartTest}
                    className="mt-6 bg-red-600 hover:bg-red-700 text-white text-lg font-semibold py-3 px-6 rounded-lg transition-colors shadow-md"
                >
                    Restart Assessment
                </button>
            </div>
        );
    }

    return (
      <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            {HandType.getEmoji(currentHand)} {HandType.getLabel(currentHand)} Hand - Tremor Results
          </h2>
          <p className="text-xl text-orange-700 mb-6">Tremor Analysis Complete! Review the findings.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-orange-50 p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-bold text-orange-800 mb-4">Summary</h3>
            <div className="space-y-2 text-lg">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={`font-bold ${tremor.hasTremor ? 'text-red-600' : 'text-green-600'}`}>
                  {tremor.hasTremor ? 'Tremor Detected' : 'No Tremor'}
                </span>
              </div>
              {tremor.hasTremor && (
                <>
                  <div className="flex justify-between">
                    <span>Severity:</span>
                    <span className="font-bold text-orange-900">{tremor.severity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Frequency:</span>
                    <span className="font-bold text-orange-900">{tremor.frequency.toFixed(1)} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amplitude:</span>
                    <span className="font-bold text-orange-900">{tremor.amplitude.toFixed(4)} g</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="bg-orange-50 p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-bold text-orange-800 mb-4">Detailed Metrics</h3>
            <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span>Max Amplitude:</span>
                    <div className="font-semibold">{tremor.maxAmplitude.toFixed(4)} g</div>
                </div>
                <div className="flex justify-between">
                    <span>Dominant Axis:</span>
                    <div className="font-semibold">{tremor.dominantAxis}</div>
                </div>
                <div className="flex justify-between">
                    <span>X-Axis Amplitude:</span>
                    <div className="font-semibold">{tremor.xAxisAmplitude.toFixed(4)} g</div>
                </div>
                <div className="flex justify-between">
                    <span>Y-Axis Amplitude:</span>
                    <div className="font-semibold">{tremor.yAxisAmplitude.toFixed(4)} g</div>
                </div>
                <div className="flex justify-between">
                    <span>Z-Axis Amplitude:</span>
                    <div className="font-semibold">{tremor.zAxisAmplitude.toFixed(4)} g</div>
                </div>
                <div className="flex justify-between">
                    <span>Amplitude Variability:</span>
                    <div className="font-semibold">{tremor.amplitudeVariability.toFixed(4)} g</div>
                </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={handleProceed}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold py-4 px-8 rounded-lg transition-colors shadow-md flex items-center justify-center mx-auto"
          >
            {currentHand === HandType.LEFT ? 'Proceed to Right Hand Test' : 'View Full Analysis'} <ArrowRightCircle className="ml-3" size={24} />
          </button>
        </div>
      </div>
    );
  };


  const renderFinalResults = () => {
    const leftTapping = session.leftTapping;
    const rightTapping = session.rightTapping;
    const leftTremor = session.leftTremor;
    const rightTremor = session.rightTremor;

    const dominantHand = leftTapping && rightTapping ?
      (leftTapping.score > rightTapping.score ? 'Left' : 'Right') : 'Unknown';

    const getOverallStatus = () => {
      if (!leftTapping || !rightTapping || !leftTremor || !rightTremor) return 'Incomplete';

      const avgScore = (leftTapping.score + rightTapping.score) / 2;
      const hasTremor = leftTremor.hasTremor || rightTremor.hasTremor;

      if (avgScore >= 70 && !hasTremor) return 'Normal';
      if (avgScore >= 50 && !hasTremor) return 'Mild Issues';
      return 'Needs Attention';
    };

    const getOverallStatusColor = () => {
      const status = getOverallStatus();
      switch (status) {
        case 'Normal': return 'text-green-600';
        case 'Mild Issues': return 'text-yellow-600';
        default: return 'text-red-600';
      }
    };

    const getRecommendations = () => {
      const recommendations = [];

      if (leftTapping && leftTapping.score < 50) { // Lower threshold for recommendation
        recommendations.push(`Left hand motor function (Score: ${leftTapping.score.toFixed(0)}) indicates potential mild to severe impairment.`);
      }
      if (rightTapping && rightTapping.score < 50) {
        recommendations.push(`Right hand motor function (Score: ${rightTapping.score.toFixed(0)}) indicates potential mild to severe impairment.`);
      }

      if (leftTremor && leftTremor.hasTremor) {
        recommendations.push(`Left hand tremor detected: ${leftTremor.severity} (${leftTremor.amplitude.toFixed(4)}g).`);
      }
      if (rightTremor && rightTremor.hasTremor) {
        recommendations.push(`Right hand tremor detected: ${rightTremor.severity} (${rightTremor.amplitude.toFixed(4)}g).`);
      }

      if (leftTapping && leftTapping.fatigueIndex > 0.4) { // Slightly increased threshold for significance
        recommendations.push('Left hand shows significant fatigue during tapping test, suggesting motor endurance issues.');
      }
      if (rightTapping && rightTapping.fatigueIndex > 0.4) {
        recommendations.push('Right hand shows significant fatigue during tapping test, suggesting motor endurance issues.');
      }

      // Asymmetry analysis
      if (leftTapping && rightTapping) {
        const freqDiff = Math.abs(leftTapping.averageFrequency - rightTapping.averageFrequency);
        if (freqDiff > 1.8) { // Increased threshold for clinical significance
          recommendations.push(`Significant motor asymmetry detected in tapping frequency between hands (${freqDiff.toFixed(2)} Hz difference).`);
        }
      }

      if (leftTremor && rightTremor) {
        const ampDiff = Math.abs(leftTremor.amplitude - rightTremor.amplitude);
        if (ampDiff > 0.04) { // Increased threshold for clinical significance
          recommendations.push(`Significant tremor asymmetry detected in amplitude between hands (${ampDiff.toFixed(4)}g difference).`);
        }
      }

      if (recommendations.length === 0) {
        recommendations.push('Overall motor function and tremor assessment appear within normal clinical ranges.');
        recommendations.push('No significant findings requiring immediate follow-up were identified by this assessment.');
        recommendations.push('Consider periodic re-assessment as part of routine health monitoring.');
      } else {
        recommendations.unshift('**Clinical Alert:** The following findings suggest potential motor or neurological considerations:');
        recommendations.push('---');
        recommendations.push('**Recommendation:** It is highly recommended to share these results with a healthcare professional, such as a neurologist or movement disorder specialist, for a comprehensive clinical evaluation.');
        recommendations.push('Document any associated symptoms (e.g., stiffness, slowness, difficulty with daily tasks) and their progression over time.');
        recommendations.push('Repeat this assessment periodically (e.g., every 3-6 months) to track changes or response to interventions.');
      }

      return recommendations;
    };

    return (
      <div className="max-w-6xl mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <CheckCircle className="mx-auto mb-4 text-green-600" size={48} />
          <h2 className="text-3xl font-bold text-gray-800 mb-2">🏆 Full Clinical Analysis</h2>
          <p className="text-lg text-gray-600">Bilateral hand movement assessment complete with detailed insights.</p>
        </div>

        {/* Summary Card */}
        <div className="bg-purple-50 p-6 rounded-lg mb-6 shadow-md">
          <h3 className="text-xl font-bold text-purple-800 mb-4">Overall Summary</h3>
          <div className="space-y-2 text-lg">
            <div className="flex justify-between items-center">
              <span>Dominant Hand (Performance):</span>
              <span className="font-bold text-purple-900">
                {dominantHand === 'Left' ? '👈' : '👉'} {dominantHand}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Overall Assessment Status:</span>
              <span className={`font-bold text-xl ${getOverallStatusColor()}`}>
                {getOverallStatus()}
              </span>
            </div>
          </div>
        </div>

        {/* Hand Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {leftTapping && leftTremor && (
            <div className="bg-blue-50 p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-bold text-blue-800 mb-4">👈 Left Hand Overview</h3>
              <div className="space-y-2 text-md">
                <div className="flex justify-between">
                  <span>Tapping Score:</span>
                  <span className={`font-bold ${getScoreColor(leftTapping.score)}`}>
                    {leftTapping.score.toFixed(0)} - {leftTapping.grade}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tapping Avg. Freq:</span>
                  <span className="font-bold">{leftTapping.averageFrequency.toFixed(1)} Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Tremor Status:</span>
                  <span className={`font-bold ${leftTremor.hasTremor ? 'text-orange-600' : 'text-green-600'}`}>
                    {leftTremor.hasTremor ? leftTremor.severity : 'None Detected'}
                  </span>
                </div>
                 {leftTremor.hasTremor && (
                    <div className="flex justify-between">
                        <span>Tremor Amplitude:</span>
                        <span className="font-bold">{leftTremor.amplitude.toFixed(4)} g</span>
                    </div>
                 )}
              </div>
            </div>
          )}

          {rightTapping && rightTremor && (
            <div className="bg-green-50 p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-bold text-green-800 mb-4">👉 Right Hand Overview</h3>
              <div className="space-y-2 text-md">
                <div className="flex justify-between">
                  <span>Tapping Score:</span>
                  <span className={`font-bold ${getScoreColor(rightTapping.score)}`}>
                    {rightTapping.score.toFixed(0)} - {rightTapping.grade}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tapping Avg. Freq:</span>
                  <span className="font-bold">{rightTapping.averageFrequency.toFixed(1)} Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Tremor Status:</span>
                  <span className={`font-bold ${rightTremor.hasTremor ? 'text-orange-600' : 'text-green-600'}`}>
                    {rightTremor.hasTremor ? rightTremor.severity : 'None Detected'}
                  </span>
                </div>
                {rightTremor.hasTremor && (
                    <div className="flex justify-between">
                        <span>Tremor Amplitude:</span>
                        <span className="font-bold">{rightTremor.amplitude.toFixed(4)} g</span>
                    </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Clinical Recommendations */}
        <div className="bg-green-50 p-6 rounded-lg mb-6 shadow-md">
          <h3 className="text-xl font-bold text-green-800 mb-4 flex items-center">
            <BarChart3 className="mr-2" size={24} /> Clinical Interpretations & Recommendations
          </h3>
          <div className="space-y-2">
            {getRecommendations().map((recommendation, index) => (
              <div key={index} className={`text-base leading-relaxed ${recommendation.includes('Clinical Alert') || recommendation.includes('Recommendation:') ? 'font-semibold text-purple-800' : 'text-gray-700'}`}>
                {index === 0 && recommendation.includes('Clinical Alert') ? '' : '• '}{recommendation}
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Metrics Sections */}
        <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center mt-8">Detailed Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {leftTapping && (
            <div className="bg-blue-50 p-6 rounded-lg shadow-sm">
              <h4 className="text-lg font-bold text-blue-800 mb-4">Left Hand Tapping Metrics</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-600">Total Taps:</span><div className="font-semibold">{leftTapping.tapCount}</div></div>
                <div><span className="text-gray-600">Average Frequency:</span><div className="font-semibold">{leftTapping.averageFrequency.toFixed(2)} taps/sec</div></div>
                <div><span className="text-gray-600">Peak Frequency:</span><div className="font-semibold">{leftTapping.peakFrequency.toFixed(2)} taps/sec</div></div>
                <div><span className="text-gray-600">Consistency:</span><div className="font-semibold">{(leftTapping.consistency * 100).toFixed(1)}%</div></div>
                <div><span className="text-gray-600">Rhythm Stability:</span><div className="font-semibold">{(leftTapping.rhythmStability * 100).toFixed(1)}%</div></div>
                <div><span className="text-gray-600">Fatigue Index:</span><div className="font-semibold">{leftTapping.fatigueIndex.toFixed(2)}</div></div>
                <div><span className="text-gray-600">Acceleration Phase:</span><div className="font-semibold">{leftTapping.accelerationPhase.toFixed(2)} sec</div></div>
                <div><span className="text-gray-600">Deceleration Phase:</span><div className="font-semibold">{leftTapping.decelerationPhase.toFixed(2)} sec</div></div>
              </div>
            </div>
          )}

          {rightTapping && (
            <div className="bg-green-50 p-6 rounded-lg shadow-sm">
              <h4 className="text-lg font-bold text-green-800 mb-4">Right Hand Tapping Metrics</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-600">Total Taps:</span><div className="font-semibold">{rightTapping.tapCount}</div></div>
                <div><span className="text-gray-600">Average Frequency:</span><div className="font-semibold">{rightTapping.averageFrequency.toFixed(2)} taps/sec</div></div>
                <div><span className="text-gray-600">Peak Frequency:</span><div className="font-semibold">{rightTapping.peakFrequency.toFixed(2)} taps/sec</div></div>
                <div><span className="text-gray-600">Consistency:</span><div className="font-semibold">{(rightTapping.consistency * 100).toFixed(1)}%</div></div>
                <div><span className="text-gray-600">Rhythm Stability:</span><div className="font-semibold">{(rightTapping.rhythmStability * 100).toFixed(1)}%</div></div>
                <div><span className="text-gray-600">Fatigue Index:</span><div className="font-semibold">{rightTapping.fatigueIndex.toFixed(2)}</div></div>
                <div><span className="text-gray-600">Acceleration Phase:</span><div className="font-semibold">{rightTapping.accelerationPhase.toFixed(2)} sec</div></div>
                <div><span className="text-gray-600">Deceleration Phase:</span><div className="font-semibold">{rightTapping.decelerationPhase.toFixed(2)} sec</div></div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {leftTremor && (
            <div className="bg-orange-50 p-6 rounded-lg shadow-sm">
              <h4 className="text-lg font-bold text-orange-800 mb-4">Left Hand Tremor Metrics</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-600">Overall Amplitude:</span><div className="font-semibold">{leftTremor.amplitude.toFixed(4)} g</div></div>
                <div><span className="text-gray-600">Max Amplitude:</span><div className="font-semibold">{leftTremor.maxAmplitude.toFixed(4)} g</div></div>
                <div><span className="text-gray-600">Frequency:</span><div className="font-semibold">{leftTremor.frequency.toFixed(2)} Hz</div></div>
                <div><span className="text-gray-600">Dominant Axis:</span><div className="font-semibold">{leftTremor.dominantAxis}</div></div>
                <div><span className="text-gray-600">Severity:</span><div className="font-semibold">{leftTremor.severity}</div></div>
                <div><span className="text-gray-600">Variability:</span><div className="font-semibold">{leftTremor.amplitudeVariability.toFixed(4)} g</div></div>
                <div><span className="text-gray-600">X-Axis Amplitude:</span><div className="font-semibold">{leftTremor.xAxisAmplitude.toFixed(4)} g</div></div>
                <div><span className="text-gray-600">Y-Axis Amplitude:</span><div className="font-semibold">{leftTremor.yAxisAmplitude.toFixed(4)} g</div></div>
                <div><span className="text-gray-600">Z-Axis Amplitude:</span><div className="font-semibold">{leftTremor.zAxisAmplitude.toFixed(4)} g</div></div>
              </div>
            </div>
          )}

          {rightTremor && (
            <div className="bg-orange-50 p-6 rounded-lg shadow-sm">
              <h4 className="text-lg font-bold text-orange-800 mb-4">Right Hand Tremor Metrics</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-600">Overall Amplitude:</span><div className="font-semibold">{rightTremor.amplitude.toFixed(4)} g</div></div>
                <div><span className="text-gray-600">Max Amplitude:</span><div className="font-semibold">{rightTremor.maxAmplitude.toFixed(4)} g</div></div>
                <div><span className="text-gray-600">Frequency:</span><div className="font-semibold">{rightTremor.frequency.toFixed(2)} Hz</div></div>
                <div><span className="text-gray-600">Dominant Axis:</span><div className="font-semibold">{rightTremor.dominantAxis}</div></div>
                <div><span className="text-gray-600">Severity:</span><div className="font-semibold">{rightTremor.severity}</div></div>
                <div><span className="text-gray-600">Variability:</span><div className="font-semibold">{rightTremor.amplitudeVariability.toFixed(4)} g</div></div>
                <div><span className="text-gray-600">X-Axis Amplitude:</span><div className="font-semibold">{rightTremor.xAxisAmplitude.toFixed(4)} g</div></div>
                <div><span className="text-gray-600">Y-Axis Amplitude:</span><div className="font-semibold">{rightTremor.yAxisAmplitude.toFixed(4)} g</div></div>
                <div><span className="text-gray-600">Z-Axis Amplitude:</span><div className="font-semibold">{rightTremor.zAxisAmplitude.toFixed(4)} g</div></div>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={restartTest}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold py-4 px-8 rounded-lg transition-colors shadow-md flex items-center justify-center mx-auto"
          >
            Start New Assessment <Play className="ml-3" size={24} />
          </button>
        </div>
      </div>
    );
  };

  // --- Main Render Function (Switches Views) ---
  const currentViewIndex = (() => {
    switch (currentView) {
      case ViewState.WELCOME: return 1;
      case ViewState.TAPPING_INSTRUCTIONS: return 2;
      case ViewState.TAPPING_TEST: return 2;
      case ViewState.TAPPING_RESULTS: return 2; // Tapping test is step 2 for either hand
      case ViewState.TREMOR_INSTRUCTIONS: return 3;
      case ViewState.TREMOR_TEST: return 3;
      case ViewState.TREMOR_RESULTS: return 3; // Tremor test is step 3 for either hand
      case ViewState.FINAL_RESULTS: return 4; // Final results is step 4
      default: return 1;
    }
  })();

  const totalViews = 4; // Welcome, Left Hand Tests, Right Hand Tests, Final Results
                        // For progress bar: Welcome (1), Left Hand tests (2), Right Hand tests (3), Final Results (4)
                        // Simplified for progress bar to reflect overall stages

  // Adjust progress bar logic to reflect major stages, not every sub-view
  const getProgressBarWidth = () => {
      let progress = 0;
      switch(currentView) {
          case ViewState.WELCOME:
              progress = 0; // Starts from 0
              break;
          case ViewState.TAPPING_INSTRUCTIONS:
          case ViewState.TAPPING_TEST:
          case ViewState.TAPPING_RESULTS:
              progress = currentHand === HandType.LEFT ? 25 : 50; // 25% for Left Tap, 50% for Right Tap
              break;
          case ViewState.TREMOR_INSTRUCTIONS:
          case ViewState.TREMOR_TEST:
          case ViewState.TREMOR_RESULTS:
              progress = currentHand === HandType.LEFT ? 50 : 75; // 50% for Left Tremor, 75% for Right Tremor
              break;
          case ViewState.FINAL_RESULTS:
              progress = 100;
              break;
          default:
              progress = 0;
      }
      return progress;
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-4 px-4 font-sans text-gray-800">
      <div className="container mx-auto">
        {/* Progress indicator */}
        <div className="max-w-4xl mx-auto mb-6 p-4 bg-white rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-medium text-gray-700">Assessment Progress</span>
            <span className="text-lg font-medium text-gray-700">
              {/* Simplified step count for overall progress */}
              Step {
                currentView === ViewState.WELCOME ? 1 :
                (currentHand === HandType.LEFT && (currentView === ViewState.TAPPING_INSTRUCTIONS || currentView === ViewState.TAPPING_TEST || currentView === ViewState.TAPPING_RESULTS || currentView === ViewState.TREMOR_INSTRUCTIONS || currentView === ViewState.TREMOR_TEST || currentView === ViewState.TREMOR_RESULTS)) ? 2 :
                (currentHand === HandType.RIGHT && (currentView === ViewState.TAPPING_INSTRUCTIONS || currentView === ViewState.TAPPING_TEST || currentView === ViewState.TAPPING_RESULTS || currentView === ViewState.TREMOR_INSTRUCTIONS || currentView === ViewState.TREMOR_TEST || currentView === ViewState.TREMOR_RESULTS)) ? 3 :
                4 // Final Results
              } of 4
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-500"
              style={{
                width: `${getProgressBarWidth()}%`
              }}
            />
          </div>
        </div>

        {/* Main content based on currentView */}
        {currentView === ViewState.WELCOME && renderWelcome()}
        {currentView === ViewState.TAPPING_INSTRUCTIONS && renderTappingInstructions()}
        {currentView === ViewState.TAPPING_TEST && renderTappingTest()}
        {currentView === ViewState.TAPPING_RESULTS && renderTappingResults()}
        {currentView === ViewState.TREMOR_INSTRUCTIONS && renderTremorInstructions()}
        {currentView === ViewState.TREMOR_TEST && renderTremorTest()}
        {currentView === ViewState.TREMOR_RESULTS && renderTremorResults()}
        {currentView === ViewState.FINAL_RESULTS && renderFinalResults()}
      </div>
    </div>
  );
};

export default HandMovementAssessment;