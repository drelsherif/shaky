import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Hand, BarChart3, CheckCircle, Play } from 'lucide-react';

// Data Models matching Swift structs
const HandType = {
  LEFT: 'left',
  RIGHT: 'right',
  getEmoji: (hand) => hand === HandType.LEFT ? '👈' : '👉',
  getLabel: (hand) => hand === HandType.LEFT ? 'Left' : 'Right'
};

// Tremor Analysis Component - matching iPhone app exactly
const TremorVisualization = ({ tremorData, tremorOffset, isActive, onStart }) => {
  return (
    <div className="flex flex-col items-center space-y-6">
      <div
        className="relative w-80 h-80 cursor-pointer"
        onClick={!isActive ? onStart : undefined}
      >
        {/* Outer circle - gray border */}
        <div className="absolute inset-0 rounded-full border-4 border-gray-300 bg-gray-50"></div>

        {/* Moving dot in center */}
        <div
          className={`absolute w-6 h-6 rounded-full transition-all duration-75 ${
            isActive ? 'bg-orange-500' : 'bg-gray-400'
          }`}
          style={{
            left: `50%`,
            top: `50%`,
            transform: `translate(-50%, -50%) translate(${tremorOffset.x}px, ${tremorOffset.y}px)`
          }}
        />

        {/* Center cross-hairs for reference */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-1 h-8 bg-gray-200 absolute"></div>
          <div className="h-1 w-8 bg-gray-200 absolute"></div>
        </div>

        {/* Tap to start text */}
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 font-bold text-lg pointer-events-none">
            TAP TO START
          </div>
        )}
      </div>

      {/* Real-time sensor data display */}
      {tremorData.length > 0 && (
        <div className="w-full max-w-md">
          <div className="bg-white p-4 rounded-lg border shadow">
            <h4 className="font-semibold mb-3 text-gray-800">Real-time Motion Data</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">X-Axis</div>
                <div className="font-mono font-bold">
                  {tremorData[tremorData.length - 1]?.x?.toFixed(3) || '0.000'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Y-Axis</div>
                <div className="font-mono font-bold">
                  {tremorData[tremorData.length - 1]?.y?.toFixed(3) || '0.000'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Z-Axis</div>
                <div className="font-mono font-bold">
                  {tremorData[tremorData.length - 1]?.z?.toFixed(3) || '0.000'}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t text-center">
              <div className="text-xs text-gray-500 mb-1">Magnitude</div>
              <div className="font-mono font-bold text-orange-600">
                {tremorData[tremorData.length - 1]?.magnitude?.toFixed(4) || '0.0000'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const HandMovementAssessment = () => {
  // State management matching Swift MotionManager
  const [currentView, setCurrentView] = useState('welcome');
  const [currentHand, setCurrentHand] = useState(HandType.LEFT);
  const [isTestActive, setIsTestActive] = useState(false);
  const [isTremorTestActive, setIsTremorTestActive] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(20);
  const [tremorTimeRemaining, setTremorTimeRemaining] = useState(10);
  const [currentFrequency, setCurrentFrequency] = useState(0);
  const [tremorOffset, setTremorOffset] = useState({ x: 0, y: 0 });

  // Results storage
  const [session, setSession] = useState({
    leftTapping: null,
    rightTapping: null,
    leftTremor: null,
    rightTremor: null
  });

  // Test data
  const [tapTimes, setTapTimes] = useState([]);
  const [tremorData, setTremorData] = useState([]);
  const [testStartTime, setTestStartTime] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const timerRef = useRef(null);
  const motionDataRef = useRef([]);

  // Sensor handling - using useCallback to prevent recreating event handlers
  const handleMotionEvent = useCallback((event) => {
    // Use userAcceleration if available (removes gravity), otherwise use accelerationIncludingGravity
    const accel = event.acceleration || event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };

    if (isTremorTestActive) {
      // Calculate magnitude using proper vector math
      const magnitude = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);

      const motionPoint = {
        x: accel.x,
        y: accel.y,
        z: accel.z,
        magnitude,
        timestamp: Date.now()
      };

      motionDataRef.current.push(motionPoint);

      // Update visual offset - scaled appropriately for tremor visualization
      // Scale factor adjusted to match iPhone app sensitivity
      const scaleFactor = 100; // Increased for better visibility
      setTremorOffset({
        x: Math.max(-140, Math.min(140, accel.x * scaleFactor)), // Constrain to circle bounds
        y: Math.max(-140, Math.min(140, accel.y * scaleFactor))
      });

      // Keep last 1000 points for better analysis (10 seconds at 100Hz)
      setTremorData(prev => [...prev, motionPoint].slice(-1000));
    }
  }, [isTremorTestActive]);

  // Permission handling with better error handling
  const requestSensorPermissions = useCallback(async () => {
    try {
      let granted = false;

      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const permission = await DeviceMotionEvent.requestPermission();
        granted = permission === 'granted';
      } else {
        granted = true;
      }

      setPermissionGranted(granted);

      if (granted) {
        window.addEventListener('devicemotion', handleMotionEvent, { passive: true });
      }

      return granted;
    } catch (error) {
      console.error('Permission request failed:', error);
      setPermissionGranted(true);
      return true;
    }
  }, [handleMotionEvent]);

  // Tapping test functions
  const startTappingTest = (hand) => {
    setIsTestActive(true);
    setTimeRemaining(20);
    setTapCount(0);
    setTapTimes([]);
    setCurrentFrequency(0);
    setTestStartTime(Date.now());

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
  };

  const handleTap = () => {
    if (!isTestActive || timeRemaining <= 0) return;

    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);

    if (testStartTime) {
      const currentTime = (Date.now() - testStartTime) / 1000;
      setTapTimes(prev => [...prev, currentTime]);
      setCurrentFrequency(newTapCount / currentTime);
    }
  };

  const finishTappingTest = (hand) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsTestActive(false);
    const analysis = analyzeTappingData();

    const result = {
      hand,
      tapCount,
      averageFrequency: analysis.avgFrequency,
      consistency: analysis.consistency,
      score: analysis.score,
      tapTimes: [...tapTimes],
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
  };

  // Tremor test functions
  const startTremorTest = (hand) => {
    setIsTremorTestActive(true);
    setTremorTimeRemaining(10);
    setTremorData([]);
    setTremorOffset({ x: 0, y: 0 });
    motionDataRef.current = [];

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
  };

  const finishTremorTest = (hand) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsTremorTestActive(false);
    setTremorOffset({ x: 0, y: 0 });

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
      hasTremor: analysis.amplitude > 0.02
    };

    setSession(prev => ({
      ...prev,
      [`${hand}Tremor`]: result
    }));
  };

  // Analysis functions - improved accuracy matching Swift implementation
  const analyzeTappingData = () => {
    if (tapTimes.length === 0) {
      return {
        avgFrequency: 0,
        consistency: 0,
        score: 0,
        peakFrequency: 0,
        fatigueIndex: 0,
        rhythmStability: 0,
        accelerationPhase: 0,
        decelerationPhase: 0
      };
    }

    const avgFreq = tapCount / 20.0;
    const consistency = calculateConsistency();
    const peakFreq = calculatePeakFrequency();
    const fatigueIndex = calculateFatigueIndex();
    const rhythmStability = calculateRhythmStability();
    const [accelPhase, decelPhase] = calculatePhases();

    // Scoring algorithm matching Swift exactly
    const freqScore = Math.min(100, avgFreq * 12); // Scale frequency score
    const consistencyScore = consistency * 100;
    const peakScore = Math.min(100, peakFreq * 8);
    const fatigueScore = Math.max(0, (1 - fatigueIndex) * 100);

    // Weighted average matching Swift weights
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
  };

  const analyzeTremorData = () => {
    const data = motionDataRef.current;
    if (!data || data.length < 10) {
      return {
        frequency: 0,
        amplitude: 0,
        severity: 'None',
        xAxisAmplitude: 0,
        yAxisAmplitude: 0,
        zAxisAmplitude: 0,
        dominantAxis: 'None',
        tremorsPerSecond: 0,
        maxAmplitude: 0,
        amplitudeVariability: 0
      };
    }

    // Separate per-axis analysis
    const xData = data.map(d => Math.abs(d.x));
    const yData = data.map(d => Math.abs(d.y));
    const zData = data.map(d => Math.abs(d.z));

    // Calculate per-axis mean amplitudes
    const xAxisAmp = xData.reduce((sum, val) => sum + val, 0) / xData.length;
    const yAxisAmp = yData.reduce((sum, val) => sum + val, 0) / yData.length;
    const zAxisAmp = zData.reduce((sum, val) => sum + val, 0) / zData.length;

    // Determine dominant axis
    let dominantAxis = 'X (Side-to-side)';
    if (yAxisAmp >= xAxisAmp && yAxisAmp >= zAxisAmp) {
      dominantAxis = 'Y (Forward-back)';
    } else if (zAxisAmp >= xAxisAmp && zAxisAmp >= yAxisAmp) {
      dominantAxis = 'Z (Up-down)';
    }

    // Calculate overall metrics using magnitude
    const magnitudes = data.map(d => d.magnitude);
    const amplitude = magnitudes.reduce((sum, val) => sum + val, 0) / magnitudes.length;
    const maxAmplitude = Math.max(...magnitudes);
    const amplitudeVariability = calculateAmplitudeVariability(magnitudes);
    const frequency = estimateFrequency(magnitudes);

    // Severity classification matching Swift exactly
    let severity = 'None';
    if (amplitude >= 0.25) {
      severity = 'Very Severe';
    } else if (amplitude >= 0.15) {
      severity = 'Severe';
    } else if (amplitude >= 0.08) {
      severity = 'Moderate';
    } else if (amplitude >= 0.04) {
      severity = 'Mild';
    } else if (amplitude >= 0.02) {
      severity = 'Minimal';
    }

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
  };

  // Helper functions - improved accuracy
  const calculateConsistency = () => {
    if (tapTimes.length < 2) return 0;

    const intervals = [];
    for (let i = 1; i < tapTimes.length; i++) {
      intervals.push(tapTimes[i] - tapTimes[i - 1]);
    }

    if (intervals.length === 0) return 0;

    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    if (mean === 0) return 0;

    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    return Math.max(0, Math.min(1, 1 - (stdDev / mean)));
  };

  const calculatePeakFrequency = () => {
    if (tapTimes.length < 3) return 0;

    let maxFreq = 0;
    const windowSize = 3.0; // 3-second sliding window

    for (let i = 0; i < tapTimes.length; i++) {
      const windowStart = tapTimes[i];
      const windowEnd = windowStart + windowSize;

      const tapsInWindow = tapTimes.filter(t => t >= windowStart && t <= windowEnd).length;
      if (tapsInWindow > 1) { // Need at least 2 taps for frequency calculation
        const freq = tapsInWindow / windowSize;
        maxFreq = Math.max(maxFreq, freq);
      }
    }

    return maxFreq;
  };

  const calculateFatigueIndex = () => {
    if (tapTimes.length < 6) return 0;

    const thirdSize = Math.floor(tapTimes.length / 3);
    if (thirdSize < 2) return 0;

    const firstThird = tapTimes.slice(0, thirdSize);
    const lastThird = tapTimes.slice(-thirdSize);

    if (firstThird.length === 0 || lastThird.length === 0) return 0;

    const firstDuration = firstThird[firstThird.length - 1] - firstThird[0];
    const lastDuration = lastThird[lastThird.length - 1] - lastThird[0];

    if (firstDuration === 0 || lastDuration === 0) return 0;

    const firstFreq = (firstThird.length - 1) / firstDuration; // -1 because intervals = taps - 1
    const lastFreq = (lastThird.length - 1) / lastDuration;

    if (firstFreq === 0) return 0;

    return Math.max(0, Math.min(1, (firstFreq - lastFreq) / firstFreq));
  };

  const calculateRhythmStability = () => {
    if (tapTimes.length < 3) return 0;

    const intervals = [];
    for (let i = 1; i < tapTimes.length; i++) {
      intervals.push(tapTimes[i] - tapTimes[i - 1]);
    }

    if (intervals.length === 0) return 0;

    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    if (mean === 0) return 0;

    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stability = Math.max(0, Math.min(1, 1 - (Math.sqrt(variance) / mean)));

    return stability;
  };

  const calculatePhases = () => {
    if (tapTimes.length < 5) return [0, 0];

    let peakIndex = 0;
    let maxLocalFreq = 0;

    // Find peak frequency using sliding window
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
  };

  const calculateAmplitudeVariability = (magnitudes) => {
    if (magnitudes.length < 2) return 0;

    const mean = magnitudes.reduce((sum, val) => sum + val, 0) / magnitudes.length;
    const variance = magnitudes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / magnitudes.length;

    return Math.sqrt(variance);
  };

  const estimateFrequency = (data) => {
    if (data.length < 20) return 0; // Need sufficient data points

    // Remove DC component (mean)
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const centered = data.map(val => val - mean);

    // Count zero crossings
    let crossings = 0;
    for (let i = 1; i < centered.length; i++) {
      if ((centered[i - 1] > 0 && centered[i] <= 0) || (centered[i - 1] <= 0 && centered[i] > 0)) {
        crossings++;
      }
    }

    // Calculate frequency (crossings/2 = full cycles)
    const samplingRate = 100.0; // Assuming 100Hz sampling (0.01s intervals)
    const duration = data.length / samplingRate;
    const frequency = (crossings / 2.0) / duration;

    return Math.max(0, frequency);
  };

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

  // Navigation functions with useCallback for performance
  const startTest = useCallback(async () => {
    if (!permissionGranted) {
      await requestSensorPermissions();
    }
    setCurrentHand(HandType.LEFT);
    setCurrentView('tapping');
  }, [permissionGranted, requestSensorPermissions]);

  const proceedToTremor = useCallback(() => {
    setCurrentView('tremor');
  }, []);

  const showHandResults = useCallback(() => {
    setCurrentView('results');
  }, []);

  const proceedToNextStep = useCallback(() => {
    if (currentHand === HandType.LEFT) {
      setCurrentHand(HandType.RIGHT);
      setCurrentView('tapping');
    } else {
      setCurrentView('finalResults');
    }
  }, [currentHand]);

  const restartTest = useCallback(() => {
    setSession({
      leftTapping: null,
      rightTapping: null,
      leftTremor: null,
      rightTremor: null
    });
    setCurrentHand(HandType.LEFT);
    setCurrentView('welcome');
    setIsTestActive(false);
    setIsTremorTestActive(false);
    setTapCount(0);
    setTimeRemaining(20);
    setTremorTimeRemaining(10);
    setCurrentFrequency(0);
    setTremorOffset({ x: 0, y: 0 });
    setTapTimes([]);
    setTremorData([]);
    motionDataRef.current = [];
  }, []);

  // Cleanup effect with proper dependency handling
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      window.removeEventListener('devicemotion', handleMotionEvent);
    };
  }, [handleMotionEvent]);

  // Auto-proceed after test completion
  useEffect(() => {
    if (!isTestActive && timeRemaining === 0 && currentView === 'tapping') {
      setTimeout(proceedToTremor, 1000);
    }
  }, [isTestActive, timeRemaining, currentView, proceedToTremor]); // Added proceedToTremor to dependencies

  useEffect(() => {
    if (!isTremorTestActive && tremorTimeRemaining === 0 && currentView === 'tremor') {
      setTimeout(showHandResults, 1000);
    }
  }, [isTremorTestActive, tremorTimeRemaining, currentView, showHandResults]); // Added showHandResults to dependencies

  // Render components
  const renderWelcome = () => (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <Hand className="mx-auto mb-6 text-blue-600" size={80} />
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Hand Movement Analysis</h1>
        <p className="text-lg text-gray-600">
          This app will test your finger tapping and measure hand tremor for both hands
        </p>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex items-center p-4 bg-blue-50 rounded-lg">
          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-4">
            1
          </div>
          <div>
            <h3 className="font-semibold">Finger Tapping</h3>
            <p className="text-gray-600">Tap as fast as you can for 20 seconds</p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-orange-50 rounded-lg">
          <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold mr-4">
            2
          </div>
          <div>
            <h3 className="font-semibold">Tremor Analysis</h3>
            <p className="text-gray-600">Hold phone steady for 10 seconds</p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-green-50 rounded-lg">
          <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold mr-4">
            3
          </div>
          <div>
            <h3 className="font-semibold">Results</h3>
            <p className="text-gray-600">View your detailed analysis</p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={startTest}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold py-4 px-8 rounded-lg transition-colors"
        >
          Start Test
        </button>
      </div>
    </div>
  );

  const renderTapping = () => (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          {HandType.getEmoji(currentHand)} {HandType.getLabel(currentHand)} Hand
        </h2>
        <h3 className="text-xl text-gray-600 mb-4">Finger Tapping Test</h3>

        {isTestActive ? (
          <div className="text-6xl font-bold text-blue-600 mb-4">
            {Math.ceil(timeRemaining)}
          </div>
        ) : (
          <p className="text-lg text-gray-600">Tap the button as fast as you can!</p>
        )}
      </div>

      {/* Large circular tap button matching iPhone app exactly */}
      <div className="flex justify-center mb-8">
        <button
          onClick={isTestActive ? handleTap : () => startTappingTest(currentHand)}
          className={`w-80 h-80 rounded-full text-4xl font-bold transition-all duration-150 shadow-2xl ${
            isTestActive
              ? 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white scale-100 hover:scale-105 active:scale-95'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white scale-100 hover:scale-105 active:scale-95'
          }`}
          style={{
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none'
          }}
        >
          <div className="flex flex-col items-center justify-center">
            {isTestActive ? (
              <>
                <div className="text-6xl font-bold mb-2">{tapCount}</div>
                <div className="text-lg">TAPS</div>
              </>
            ) : (
              <div className="text-3xl">START</div>
            )}
          </div>
        </button>
      </div>

      {isTestActive && (
        <div className="text-center space-y-4">
          <p className="text-xl font-semibold text-blue-600">
            Frequency: {currentFrequency.toFixed(1)} taps/sec
          </p>
          <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${((20 - timeRemaining) / 20) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderTremor = () => (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          {HandType.getEmoji(currentHand)} {HandType.getLabel(currentHand)} Hand
        </h2>
        <h3 className="text-xl text-gray-600 mb-4">Tremor Analysis</h3>

        {isTremorTestActive ? (
          <div className="text-6xl font-bold text-orange-600 mb-4">
            {Math.ceil(tremorTimeRemaining)}
          </div>
        ) : (
          <p className="text-lg text-gray-600">Hold your phone steady with this hand</p>
        )}
      </div>

      <div className="text-center mb-8">
        <TremorVisualization
          tremorData={tremorData}
          tremorOffset={tremorOffset}
          isActive={isTremorTestActive}
          onStart={() => startTremorTest(currentHand)}
        />
      </div>

      {isTremorTestActive && (
        <div className="text-center space-y-4">
          <p className="text-xl font-semibold text-orange-600">
            Keep phone as steady as possible
          </p>
          <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-4">
            <div
              className="bg-orange-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${((10 - tremorTimeRemaining) / 10) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderResults = () => {
    const tapping = session[`${currentHand}Tapping`];
    const tremor = session[`${currentHand}Tremor`];

    return (
      <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {HandType.getEmoji(currentHand)} {HandType.getLabel(currentHand)} Hand Results
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {tapping && (
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="text-lg font-bold text-blue-800 mb-4">Finger Tapping</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Taps:</span>
                  <span className="font-bold">{tapping.tapCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Frequency:</span>
                  <span className="font-bold">{tapping.averageFrequency.toFixed(1)}/sec</span>
                </div>
                <div className="flex justify-between">
                  <span>Consistency:</span>
                  <span className="font-bold">{(tapping.consistency * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Score:</span>
                  <span className={`font-bold ${getScoreColor(tapping.score)}`}>
                    {tapping.score.toFixed(0)} - {tapping.grade}
                  </span>
                </div>
              </div>
            </div>
          )}

          {tremor && (
            <div className="bg-orange-50 p-6 rounded-lg">
              <h3 className="text-lg font-bold text-orange-800 mb-4">Tremor Analysis</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`font-bold ${tremor.hasTremor ? 'text-red-600' : 'text-green-600'}`}>
                    {tremor.hasTremor ? 'Tremor Detected' : 'No Tremor'}
                  </span>
                </div>
                {tremor.hasTremor && (
                  <>
                    <div className="flex justify-between">
                      <span>Frequency:</span>
                      <span className="font-bold">{tremor.frequency.toFixed(1)} Hz</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Severity:</span>
                      <span className="font-bold">{tremor.severity}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="text-center">
          <button
            onClick={proceedToNextStep}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold py-4 px-8 rounded-lg transition-colors"
          >
            {currentHand === HandType.LEFT ? 'Test Right Hand' : 'View Final Results'}
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

      if (leftTapping && leftTapping.score < 40) {
        recommendations.push(`Left hand motor function shows impairment (Score: ${leftTapping.score.toFixed(0)})`);
      }
      if (rightTapping && rightTapping.score < 40) {
        recommendations.push(`Right hand motor function shows impairment (Score: ${rightTapping.score.toFixed(0)})`);
      }

      if (leftTremor && leftTremor.hasTremor) {
        recommendations.push(`Left hand tremor detected (${leftTremor.severity} - ${leftTremor.amplitude.toFixed(4)}g)`);
      }
      if (rightTremor && rightTremor.hasTremor) {
        recommendations.push(`Right hand tremor detected (${rightTremor.severity} - ${rightTremor.amplitude.toFixed(4)}g)`);
      }

      // Fatigue analysis
      if (leftTapping && leftTapping.fatigueIndex > 0.3) {
        recommendations.push('Left hand shows significant fatigue during testing');
      }
      if (rightTapping && rightTapping.fatigueIndex > 0.3) {
        recommendations.push('Right hand shows significant fatigue during testing');
      }

      // Asymmetry analysis
      if (leftTapping && rightTapping) {
        const freqDiff = Math.abs(leftTapping.averageFrequency - rightTapping.averageFrequency);
        if (freqDiff > 1.5) {
          recommendations.push('Significant asymmetry in tapping frequency between hands');
        }
      }

      if (leftTremor && rightTremor) {
        const ampDiff = Math.abs(leftTremor.amplitude - rightTremor.amplitude);
        if (ampDiff > 0.03) {
          recommendations.push('Significant asymmetry in tremor amplitude between hands');
        }
      }

      if (recommendations.length === 0) {
        recommendations.push('Motor function appears within normal range');
        recommendations.push('No significant tremor detected');
        recommendations.push('Continue regular monitoring as part of health maintenance');
      } else {
        recommendations.push('Consider consultation with a neurologist or movement disorder specialist');
        recommendations.push('Document symptoms and monitor progression over time');
        recommendations.push('Repeat testing in 3-6 months to track changes');
      }

      return recommendations;
    };

    return (
      <div className="max-w-6xl mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <CheckCircle className="mx-auto mb-4 text-green-600" size={48} />
          <h2 className="text-3xl font-bold text-gray-800 mb-2">🏆 Complete Analysis</h2>
          <p className="text-lg text-gray-600">Bilateral hand movement analysis complete</p>
        </div>

        {/* Summary Card */}
        <div className="bg-purple-50 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-bold text-purple-800 mb-4">Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Dominant Hand:</span>
              <span className="font-bold">
                {dominantHand === 'Left' ? '👈' : '👉'} {dominantHand}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Overall Status:</span>
              <span className={`font-bold ${getOverallStatusColor()}`}>
                {getOverallStatus()}
              </span>
            </div>
          </div>
        </div>

        {/* Hand Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {leftTapping && leftTremor && (
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-blue-800 mb-4">👈 Left Hand</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Tapping Score:</span>
                  <span className={`font-bold ${getScoreColor(leftTapping.score)}`}>
                    {leftTapping.score.toFixed(0)} - {leftTapping.grade}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tremor:</span>
                  <span className={`font-bold ${leftTremor.hasTremor ? 'text-orange-600' : 'text-green-600'}`}>
                    {leftTremor.hasTremor ? leftTremor.severity : 'None'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {rightTapping && rightTremor && (
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-green-800 mb-4">👉 Right Hand</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Tapping Score:</span>
                  <span className={`font-bold ${getScoreColor(rightTapping.score)}`}>
                    {rightTapping.score.toFixed(0)} - {rightTapping.grade}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tremor:</span>
                  <span className={`font-bold ${rightTremor.hasTremor ? 'text-orange-600' : 'text-green-600'}`}>
                    {rightTremor.hasTremor ? rightTremor.severity : 'None'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detailed Clinical Analysis */}
        <div className="bg-purple-50 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-bold text-purple-800 mb-4">Complete Clinical Analysis</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-blue-600 mb-2">MOTOR FUNCTION ANALYSIS:</h4>
              <div className="space-y-1 text-sm">
                {leftTapping && (
                  <div>• Left Hand: {leftTapping.tapCount} taps, {leftTapping.averageFrequency.toFixed(2)} Hz average ({leftTapping.grade})</div>
                )}
                {rightTapping && (
                  <div>• Right Hand: {rightTapping.tapCount} taps, {rightTapping.averageFrequency.toFixed(2)} Hz average ({rightTapping.grade})</div>
                )}
                <div className="font-semibold">• Dominant Hand: {dominantHand} (based on performance)</div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-orange-600 mb-2">TREMOR ANALYSIS:</h4>
              <div className="space-y-1 text-sm">
                {leftTremor && (
                  <div>• Left Hand Tremor: {leftTremor.severity} ({leftTremor.amplitude.toFixed(4)}g, {leftTremor.frequency.toFixed(2)}Hz)</div>
                )}
                {rightTremor && (
                  <div>• Right Hand Tremor: {rightTremor.severity} ({rightTremor.amplitude.toFixed(4)}g, {rightTremor.frequency.toFixed(2)}Hz)</div>
                )}
                {leftTremor && rightTremor && (
                  <div className={`font-semibold ${(leftTremor.hasTremor || rightTremor.hasTremor) ? 'text-red-600' : 'text-green-600'}`}>
                    • {(leftTremor.hasTremor || rightTremor.hasTremor) ? 'Tremor Detected: Requires clinical evaluation' : 'No significant tremor detected'}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-purple-600 mb-2">ASYMMETRY ANALYSIS:</h4>
              <div className="space-y-1 text-sm">
                {leftTapping && rightTapping && (
                  <>
                    <div>• Frequency Asymmetry: {Math.abs(leftTapping.averageFrequency - rightTapping.averageFrequency).toFixed(2)} Hz difference</div>
                    {Math.abs(leftTapping.averageFrequency - rightTapping.averageFrequency) > 1.0 && (
                      <div className="text-orange-600">• Significant motor asymmetry detected</div>
                    )}
                  </>
                )}
                {leftTremor && rightTremor && (
                  <>
                    <div>• Tremor Asymmetry: {Math.abs(leftTremor.amplitude - rightTremor.amplitude).toFixed(4)}g difference</div>
                    {Math.abs(leftTremor.amplitude - rightTremor.amplitude) > 0.02 && (
                      <div className="text-orange-600">• Significant tremor asymmetry detected</div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Recommendations */}
        <div className="bg-green-50 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-bold text-green-800 mb-4">Clinical Recommendations</h3>
          <div className="space-y-2">
            {getRecommendations().map((recommendation, index) => (
              <div key={index} className="text-sm">• {recommendation}</div>
            ))}
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {leftTapping && (
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="text-lg font-bold text-blue-800 mb-4">Left Hand Detailed Metrics</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Total Taps:</span>
                  <div className="font-semibold">{leftTapping.tapCount}</div>
                </div>
                <div>
                  <span className="text-gray-600">Average Frequency:</span>
                  <div className="font-semibold">{leftTapping.averageFrequency.toFixed(2)} taps/sec</div>
                </div>
                <div>
                  <span className="text-gray-600">Peak Frequency:</span>
                  <div className="font-semibold">{leftTapping.peakFrequency.toFixed(2)} taps/sec</div>
                </div>
                <div>
                  <span className="text-gray-600">Consistency:</span>
                  <div className="font-semibold">{(leftTapping.consistency * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <span className="text-gray-600">Rhythm Stability:</span>
                  <div className="font-semibold">{(leftTapping.rhythmStability * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <span className="text-gray-600">Fatigue Index:</span>
                  <div className="font-semibold">{leftTapping.fatigueIndex.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {rightTapping && (
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="text-lg font-bold text-green-800 mb-4">Right Hand Detailed Metrics</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Total Taps:</span>
                  <div className="font-semibold">{rightTapping.tapCount}</div>
                </div>
                <div>
                  <span className="text-gray-600">Average Frequency:</span>
                  <div className="font-semibold">{rightTapping.averageFrequency.toFixed(2)} taps/sec</div>
                </div>
                <div>
                  <span className="text-gray-600">Peak Frequency:</span>
                  <div className="font-semibold">{rightTapping.peakFrequency.toFixed(2)} taps/sec</div>
                </div>
                <div>
                  <span className="text-gray-600">Consistency:</span>
                  <div className="font-semibold">{(rightTapping.consistency * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <span className="text-gray-600">Rhythm Stability:</span>
                  <div className="font-semibold">{(rightTapping.rhythmStability * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <span className="text-gray-600">Fatigue Index:</span>
                  <div className="font-semibold">{rightTapping.fatigueIndex.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tremor Detailed Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {leftTremor && (
            <div className="bg-orange-50 p-6 rounded-lg">
              <h3 className="text-lg font-bold text-orange-800 mb-4">Left Hand Tremor Metrics</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Overall Amplitude:</span>
                  <div className="font-semibold">{leftTremor.amplitude.toFixed(4)} g</div>
                </div>
                <div>
                  <span className="text-gray-600">Max Amplitude:</span>
                  <div className="font-semibold">{leftTremor.maxAmplitude.toFixed(4)} g</div>
                </div>
                <div>
                  <span className="text-gray-600">Frequency:</span>
                  <div className="font-semibold">{leftTremor.frequency.toFixed(2)} Hz</div>
                </div>
                <div>
                  <span className="text-gray-600">Dominant Axis:</span>
                  <div className="font-semibold">{leftTremor.dominantAxis}</div>
                </div>
                <div>
                  <span className="text-gray-600">Severity:</span>
                  <div className="font-semibold">{leftTremor.severity}</div>
                </div>
                <div>
                  <span className="text-gray-600">Variability:</span>
                  <div className="font-semibold">{leftTremor.amplitudeVariability.toFixed(4)} g</div>
                </div>
              </div>
            </div>
          )}

          {rightTremor && (
            <div className="bg-orange-50 p-6 rounded-lg">
              <h3 className="text-lg font-bold text-orange-800 mb-4">Right Hand Tremor Metrics</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Overall Amplitude:</span>
                  <div className="font-semibold">{rightTremor.amplitude.toFixed(4)} g</div>
                </div>
                <div>
                  <span className="text-gray-600">Max Amplitude:</span>
                  <div className="font-semibold">{rightTremor.maxAmplitude.toFixed(4)} g</div>
                </div>
                <div>
                  <span className="text-gray-600">Frequency:</span>
                  <div className="font-semibold">{rightTremor.frequency.toFixed(2)} Hz</div>
                </div>
                <div>
                  <span className="text-gray-600">Dominant Axis:</span>
                  <div className="font-semibold">{rightTremor.dominantAxis}</div>
                </div>
                <div>
                  <span className="text-gray-600">Severity:</span>
                  <div className="font-semibold">{rightTremor.severity}</div>
                </div>
                <div>
                  <span className="text-gray-600">Variability:</span>
                  <div className="font-semibold">{rightTremor.amplitudeVariability.toFixed(4)} g</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-center">
          <button
            onClick={restartTest}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold py-4 px-8 rounded-lg transition-colors"
          >
            Start New Test
          </button>
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-4 px-4">
      <div className="container mx-auto">
        {/* Progress indicator */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-medium text-gray-700">Assessment Progress</span>
            <span className="text-lg font-medium text-gray-700">
              {['welcome', 'tapping', 'tremor', 'results', 'finalResults'].indexOf(currentView) + 1} of 5
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-500"
              style={{
                width: `${((['welcome', 'tapping', 'tremor', 'results', 'finalResults'].indexOf(currentView) + 1) / 5) * 100}%`
              }}
            />
          </div>
        </div>

        {/* Main content */}
        {currentView === 'welcome' && renderWelcome()}
        {currentView === 'tapping' && renderTapping()}
        {currentView === 'tremor' && renderTremor()}
        {currentView === 'results' && renderResults()}
        {currentView === 'finalResults' && renderFinalResults()}
      </div>
    </div>
  );
};

export default HandMovementAssessment;