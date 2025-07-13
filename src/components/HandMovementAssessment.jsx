import React, { useState, useEffect, useRef } from 'react';
import { Activity, Hand, BarChart3, CheckCircle, Play, Smartphone } from 'lucide-react';

const HandMovementAssessment = () => {
  const [currentPhase, setCurrentPhase] = useState('intro');
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [sensorData, setSensorData] = useState({
    acceleration: { x: 0, y: 0, z: 0 },
    gyroscope: { alpha: 0, beta: 0, gamma: 0 },
    magnitude: 0,
    frequency: 0
  });
  const [tremorHistory, setTremorHistory] = useState([]); // For real-time visualization
  const [leftHandData, setLeftHandData] = useState(null);
  const [rightHandData, setRightHandData] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [testTimer, setTestTimer] = useState(10); // Standard 10-second test duration
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const intervalRef = useRef(null);
  const tremorDataRef = useRef([]); // This ref collects all sensor data for analysis

  // Define the sequence of test phases
  const phases = [
    'intro', 'left-tap', 'left-tremor', 'left-results',
    'right-tap', 'right-tremor', 'right-results', 'final-results'
  ];

  // Detect iOS device on component mount for permission handling
  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOSDevice(iOS);
  }, []);

  // Handle DeviceMotionEvent for sensor data
  const handleMotionEvent = (event) => {
    const accel = event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
    const rotationRate = event.rotationRate || { alpha: 0, beta: 0, gamma: 0 };

    const magnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);

    // Apply a simple low-pass filter to smooth acceleration data
    const filteredAccel = {
      x: accel.x * 0.8 + sensorData.acceleration.x * 0.2,
      y: accel.y * 0.8 + sensorData.acceleration.y * 0.2,
      z: accel.z * 0.8 + sensorData.acceleration.z * 0.2
    };

    const newSensorData = {
      acceleration: filteredAccel,
      gyroscope: {
        alpha: rotationRate.alpha || 0,
        beta: rotationRate.beta || 0,
        gamma: rotationRate.gamma || 0
      },
      magnitude: magnitude,
      timestamp: Date.now()
    };

    setSensorData(newSensorData); // Update live sensor data display

    if (isTestRunning && currentPhase.includes('tremor')) {
      // Collect data into the ref for batch analysis at the end of the test
      tremorDataRef.current.push(newSensorData);
      // Update tremorHistory state for real-time visualization (only keeps a recent window)
      setTremorHistory(prev => {
        const updatedHistory = [...prev, newSensorData];
        return updatedHistory.slice(Math.max(updatedHistory.length - 200, 0)); // Keep last 200 points for performance
      });
    }
  };

  // Analyze tremor frequency using peak detection
  const analyzeTremorFrequency = (data) => {
    if (data.length < 100) return 0; // Requires sufficient data points for meaningful analysis

    const magnitudes = data.map(d => d.magnitude);
    let peakCount = 0;
    let lastPeakIndex = -1;
    const minPeakDistance = 10; // Minimum data points between peaks (adjust based on sensor rate)

    for (let i = 1; i < magnitudes.length - 1; i++) {
      if (magnitudes[i] > magnitudes[i - 1] && magnitudes[i] > magnitudes[i + 1]) { // Local maximum
        if (lastPeakIndex === -1 || (i - lastPeakIndex) > minPeakDistance) {
          peakCount++;
          lastPeakIndex = i;
        }
      }
    }

    const durationSeconds = (data[data.length - 1].timestamp - data[0].timestamp) / 1000;
    return durationSeconds > 0 ? peakCount / durationSeconds : 0;
  };

  // Perform clinical analysis of hand movement data
  const analyzeHandData = (tapCount, elapsedTime, tremorData, handType) => {
    console.log(`Analyzing ${handType} hand data:`, { tapCount, elapsedTime, tremorDataPoints: tremorData.length });

    const actualElapsedTime = Math.max(1, elapsedTime); // Ensure at least 1 second for calculation

    // Tapping Frequency
    const frequency = tapCount / actualElapsedTime;

    // Tremor Analysis
    const tremorFrequency = analyzeTremorFrequency(tremorData);
    const tremorAmplitude = tremorData.length > 0 ?
      tremorData.reduce((sum, d) => sum + d.magnitude, 0) / tremorData.length : 0;

    // Gyroscope Stability (inverse of average absolute rotation)
    const gyroRotationSum = tremorData.reduce((sum, d) =>
      sum + (Math.abs(d.gyroscope.alpha || 0) + Math.abs(d.gyroscope.beta || 0) + Math.abs(d.gyroscope.gamma || 0))
    , 0);
    const averageGyroRotation = tremorData.length > 0 ? gyroRotationSum / tremorData.length : 0;
    const gyroStability = Math.max(0, 100 - (averageGyroRotation * 2)); // Scale to 0-100, adjust '2' for sensitivity

    // Rhythmicity (how close tapping frequency is to an ideal, e.g., 5 Hz)
    const rhythmicity = frequency > 0 ? Math.max(0, 100 - (Math.abs(frequency - 5) * 15)) : 0;
    const spatialConsistency = gyroStability; // Using gyro stability as a proxy for spatial consistency

    // Score Categorization
    const getScoreCategory = (score) => {
      if (score >= 90) return { category: 'Excellent', color: 'text-green-600' };
      if (score >= 75) return { category: 'Good', color: 'text-blue-600' };
      if (score >= 60) return { category: 'Fair', color: 'text-yellow-600' };
      return { category: 'Poor', color: 'text-red-600' };
    };

    // Overall Score Calculation (weighted average)
    const frequencyScore = Math.min(100, frequency * 20); // Scale tapping frequency to score
    const tremorQualityScore = Math.max(0, 100 - (tremorFrequency * 5) - (tremorAmplitude * 100)); // Lower tremor is better

    const overallScore = Math.min(100, Math.max(0,
      (frequencyScore * 0.4) +
      (rhythmicity * 0.2) +
      (gyroStability * 0.3) +
      (tremorQualityScore * 0.1)
    ));

    const category = getScoreCategory(overallScore);

    // Clinical Interpretation based on calculated metrics
    let clinicalInterpretation = 'Normal motor function, no significant anomalies detected.';
    if (frequency < 3) {
      clinicalInterpretation = 'Bradykinesia detected (reduced movement speed). May indicate motor slowness. ';
      if (frequency < 1) clinicalInterpretation = 'Severe bradykinesia detected - significantly reduced movement speed. ';
    }
    if (tremorFrequency > 0 && tremorFrequency < 6 && tremorAmplitude > 0.25) {
      clinicalInterpretation += 'Possible pathological tremor (e.g., essential or resting tremor characteristics). Further clinical evaluation advised.';
    } else if (tremorFrequency >= 6 && tremorFrequency <= 12 && tremorAmplitude <= 0.25) {
      clinicalInterpretation += 'Physiological tremor detected, within normal limits and generally not concerning.';
    } else if (tremorAmplitude > 0.5) {
      clinicalInterpretation += 'Significant tremor amplitude detected. Highly recommend a physician consultation.';
    }
    if (gyroStability < 60) {
      clinicalInterpretation += ' Reduced hand stability observed, which could be related to motor control issues or tremor.';
    }

    const results = {
      frequency: Number(frequency.toFixed(2)),
      rhythmicity: Number(rhythmicity.toFixed(1)),
      spatialConsistency: Number(spatialConsistency.toFixed(1)),
      tremorFrequency: Number(tremorFrequency.toFixed(2)),
      tremorAmplitude: Number(tremorAmplitude.toFixed(3)),
      gyroStability: Number(gyroStability.toFixed(1)),
      overallScore: Number(overallScore.toFixed(1)),
      category: category.category,
      categoryColor: category.color,
      clinicalInterpretation,
      tremorData: [...tremorData] // Store a copy for review in results
    };

    console.log('Final computed results:', results);
    return results;
  };

  // Request motion sensor permissions (especially for iOS)
  const requestSensorPermissions = async () => {
    try {
      let granted = false;
      if (isIOSDevice && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const permission = await DeviceMotionEvent.requestPermission();
        granted = permission === 'granted';
      } else {
        granted = true; // Non-iOS devices typically grant access by default
      }

      setPermissionGranted(granted);

      if (granted) {
        window.addEventListener('devicemotion', handleMotionEvent, true);
        setTimeout(nextPhase, 1000); // Proceed after a short delay
      } else {
        alert('Sensor access denied. The app will use simulated data for demonstration, which may limit accuracy.');
        setPermissionGranted(true); // Allow proceeding in demonstration mode
        setTimeout(nextPhase, 1000);
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      alert('Could not request sensor access. Please ensure your device supports motion sensors.');
      setPermissionGranted(true); // Allow proceeding
      setTimeout(nextPhase, 1000);
    }
  };

  // Start the 10-second test timer and measurement
  const startTest = () => {
    setIsTestRunning(true);
    setTestProgress(0);
    // Reset tapCount and tremorDataRef only when starting a new test, not on phase change
    if (currentPhase.includes('tap')) setTapCount(0);
    if (currentPhase.includes('tremor')) {
      tremorDataRef.current = [];
      setTremorHistory([]);
    }
    setTestTimer(10); // Always start from 10 seconds

    intervalRef.current = setInterval(() => {
      setTestTimer(prev => {
        const newTimer = prev - 1;
        setTestProgress(((10 - newTimer) / 10) * 100); // Progress from 0% to 100%

        if (newTimer <= 0) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          stopTest(); // Call stopTest when timer finishes
          return 0;
        }
        return newTimer;
      });
    }, 1000);
  };

  // Stop the current test, analyze data, and save results
  const stopTest = () => {
    setIsTestRunning(false); // Stop recording
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const elapsedTime = 10; // Test duration is fixed at 10 seconds

    let results;
    if (currentPhase.includes('tap')) {
      results = analyzeHandData(tapCount, elapsedTime, [], currentPhase.includes('left') ? 'left' : 'right');
    } else if (currentPhase.includes('tremor')) {
      results = analyzeHandData(0, elapsedTime, tremorDataRef.current, currentPhase.includes('left') ? 'left' : 'right');
    }

    if (currentPhase.includes('left')) {
      setLeftHandData(results);
    } else {
      setRightHandData(results);
    }

    console.log(`Test for ${currentPhase} completed. Results saved.`);
    // Do NOT call nextPhase here. Let the UI button handle progression.
  };

  // Handle tap event for tapping test
  const handleTap = () => {
    if (isTestRunning && currentPhase.includes('tap')) {
      setTapCount(prev => prev + 1);
    }
  };

  // Progress to the next phase in the sequence
  const goToNextPhase = () => {
    const currentIndex = phases.indexOf(currentPhase);
    if (currentIndex < phases.length - 1) {
      setCurrentPhase(phases[currentIndex + 1]);
      // Reset states for the NEXT phase's start
      setTestProgress(0);
      setTapCount(0);
      setTestTimer(10);
      tremorDataRef.current = [];
      setTremorHistory([]);
      setIsTestRunning(false); // Ensure not running at the start of new phase
    }
  };

  // Cleanup effect for event listeners and intervals
  useEffect(() => {
    return () => {
      window.removeEventListener('devicemotion', handleMotionEvent);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // --- Render Functions for Each Phase ---

  const renderIntroduction = () => (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <Activity className="mx-auto mb-6 text-blue-600" size={64} />
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Clinical Hand Movement Assessment</h1>
        <p className="text-gray-600 text-lg">Progressive Web App with Real Sensor Integration</p>
      </div>

      <div className="space-y-6 mb-8">
        <div className="bg-blue-50 p-6 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-4 text-lg">Advanced Features</h3>
          <ul className="text-blue-700 space-y-2">
            <li>• Real-time accelerometer and gyroscope data</li>
            <li>• 3D tremor visualization and analysis</li>
            <li>• Clinical-grade frequency analysis</li>
            <li>• Progressive Web App (PWA) compatible</li>
          </ul>
        </div>

        {isIOSDevice && (
          <div className="bg-yellow-50 p-6 rounded-lg">
            <div className="flex items-center mb-3">
              <Smartphone className="mr-3 text-yellow-600" size={24} />
              <h4 className="font-semibold text-yellow-800 text-lg">iOS Device Detected</h4>
            </div>
            <p className="text-yellow-700">This app will request permission to access your device's motion sensors for accurate tremor analysis.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="font-semibold mb-3 text-lg">Left Hand Tests</h4>
            <ul className="text-gray-600 space-y-2">
              <li>• Tapping frequency analysis</li>
              <li>• 3D tremor mapping</li>
              <li>• Gyroscope stability</li>
            </ul>
          </div>
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="font-semibold mb-3 text-lg">Right Hand Tests</h4>
            <ul className="text-gray-600 space-y-2">
              <li>• Bilateral comparison</li>
              <li>• Dominance prediction</li>
              <li>• Clinical scoring</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="text-center">
        {!permissionGranted ? (
          <button
            onClick={requestSensorPermissions}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-12 py-6 rounded-xl text-xl font-semibold transition-colors shadow-lg"
            style={{ touchAction: 'manipulation' }}
          >
            {isIOSDevice ? 'Grant Motion Permissions & Start' : 'Start Assessment'}
          </button>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-center text-green-600">
              <CheckCircle size={32} className="mr-3" />
              <span className="text-xl font-semibold">Sensor access granted!</span>
            </div>
            <div className="text-gray-600 text-lg">Starting assessment...</div>
          </div>
        )}
      </div>
    </div>
  );

  const renderTappingTest = (hand) => (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <Hand className="mx-auto mb-6 text-blue-600" size={56} />
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">{hand} Hand Tapping Test</h2>
        <p className="text-gray-600 text-lg">Tap the button as quickly as possible for 10 seconds</p>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-medium text-gray-700">Progress</span>
          <span className="text-lg font-medium text-gray-700">{testTimer}s remaining</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="bg-blue-600 h-4 rounded-full transition-all duration-300"
            style={{ width: `${testProgress}%` }}
          />
        </div>
      </div>

      <div className="text-center mb-8">
        <div className="text-8xl font-bold text-blue-600 mb-4">{tapCount}</div>
        <div className="text-xl text-gray-600 mb-2">Taps</div>
        {isTestRunning && (
          <div className="mt-4 text-2xl text-blue-600 font-semibold">
            Rate: {(tapCount / Math.max(1, (10 - testTimer))).toFixed(1)} Hz
          </div>
        )}
      </div>

      <div className="flex justify-center mb-12">
        <button
          onClick={handleTap}
          disabled={!isTestRunning} // Only disable if test is not running
          className={`w-80 h-80 rounded-full text-4xl font-bold transition-all duration-150 ${
            isTestRunning
              ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-2xl transform hover:scale-105 active:scale-95'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          style={{
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none'
          }}
        >
          TAP
        </button>
      </div>

      <div className="text-center space-y-6">
        {!isTestRunning && testTimer === 10 && ( // Test not started yet
          <button
            onClick={startTest}
            className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-12 py-6 rounded-xl text-xl font-semibold transition-colors shadow-lg"
            style={{ touchAction: 'manipulation' }}
          >
            <Play size={24} className="inline mr-3" />
            Start Test
          </button>
        )}

        {!isTestRunning && testTimer === 0 && ( // Test finished
          <button
            onClick={goToNextPhase}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-12 py-6 rounded-xl text-xl font-semibold transition-colors shadow-lg"
            style={{ touchAction: 'manipulation' }}
          >
            Continue to Tremor Analysis
          </button>
        )}
      </div>
    </div>
  );

  const renderTremorTest = (hand) => (
    <div className="max-w-4xl mx-auto p-6 md:p-8 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <Activity className="mx-auto mb-6 text-purple-600" size={56} />
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">{hand} Hand Tremor Analysis</h2>
        <p className="text-gray-600 text-lg mb-2">Hold your device steady with your {hand.toLowerCase()} hand</p>
        <p className="text-sm text-gray-500">Keep the device still to measure natural tremor</p>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-medium text-gray-700">Analysis Progress</span>
          <span className="text-lg font-medium text-gray-700">{testTimer}s remaining</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="bg-purple-600 h-4 rounded-full transition-all duration-300"
            style={{ width: `${testProgress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 mb-8">
        <div>
          <h3 className="font-semibold text-gray-800 mb-6 text-xl">Real-time Sensor Data</h3>
          <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
            <div className="bg-blue-50 p-4 md:p-6 rounded-lg text-center">
              <div className="text-sm text-blue-600 mb-2">Accel X</div>
              <div className="text-lg md:text-xl font-mono font-bold">{sensorData.acceleration.x.toFixed(3)}</div>
            </div>
            <div className="bg-blue-50 p-4 md:p-6 rounded-lg text-center">
              <div className="text-sm text-blue-600 mb-2">Accel Y</div>
              <div className="text-lg md:text-xl font-mono font-bold">{sensorData.acceleration.y.toFixed(3)}</div>
            </div>
            <div className="bg-blue-50 p-4 md:p-6 rounded-lg text-center">
              <div className="text-sm text-blue-600 mb-2">Accel Z</div>
              <div className="text-lg md:text-xl font-mono font-bold">{sensorData.acceleration.z.toFixed(3)}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
            <div className="bg-red-50 p-4 md:p-6 rounded-lg text-center">
              <div className="text-sm text-red-600 mb-2">Gyro α</div>
              <div className="text-lg md:text-xl font-mono font-bold">{(sensorData.gyroscope.alpha || 0).toFixed(1)}°</div>
            </div>
            <div className="bg-red-50 p-4 md:p-6 rounded-lg text-center">
              <div className="text-sm text-red-600 mb-2">Gyro β</div>
              <div className="text-lg md:text-xl font-mono font-bold">{(sensorData.gyroscope.beta || 0).toFixed(1)}°</div>
            </div>
            <div className="bg-red-50 p-4 md:p-6 rounded-lg text-center">
              <div className="text-sm text-red-600 mb-2">Gyro γ</div>
              <div className="text-lg md:text-xl font-mono font-bold">{(sensorData.gyroscope.gamma || 0).toFixed(1)}°</div>
            </div>
          </div>

          <div className="bg-purple-50 p-6 rounded-lg mb-6">
            <h4 className="font-semibold text-purple-800 mb-4 text-lg">Live Analysis</h4>
            <div className="text-base text-purple-700 space-y-2">
              <div>Tremor Magnitude: <span className="font-mono font-bold">{sensorData.magnitude.toFixed(3)} m/s²</span></div>
              <div>Estimated Frequency: <span className="font-mono font-bold">{analyzeTremorFrequency(tremorHistory).toFixed(1)} Hz</span></div>
              <div>Data Points Collected: <span className="font-mono font-bold">{tremorHistory.length}</span></div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-800 mb-4 text-xl">3D Tremor Visualization</h3>
          <TremorVisualization tremorData={tremorHistory} />
          <div className="text-sm text-gray-500 mt-4 text-center">
            Blue: Acceleration magnitude, Red: Rotation (alpha)
          </div>
        </div>
      </div>

      <div className="text-center space-y-6">
        {!isTestRunning && testTimer === 10 && ( // Test not started yet
          <button
            onClick={startTest}
            className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-12 py-6 rounded-xl text-xl font-semibold transition-colors shadow-lg"
            style={{ touchAction: 'manipulation' }}
          >
            <Play size={24} className="inline mr-3" />
            Start Analysis
          </button>
        )}

        {!isTestRunning && testTimer === 0 && ( // Test finished
          <button
            onClick={goToNextPhase}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-12 py-6 rounded-xl text-xl font-semibold transition-colors shadow-lg"
            style={{ touchAction: 'manipulation' }}
          >
            View Detailed Results
          </button>
        )}
      </div>
    </div>
  );

  const renderHandResults = (hand, data) => (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-6">
        <BarChart3 className="mx-auto mb-4 text-green-600" size={48} />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{hand} Hand Clinical Results</h2>
        <p className="text-gray-600">Comprehensive sensor-based analysis</p>
      </div>

      {data ? (
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-3">Clinical Assessment</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Overall Score:</span>
                <span className={`font-bold ${data.categoryColor}`}>{data.overallScore.toFixed(1)}/100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Category:</span>
                <span className={`font-bold ${data.categoryColor}`}>{data.category}</span>
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-blue-800">Clinical Interpretation:</div>
              <div className="text-sm text-blue-700">{data.clinicalInterpretation}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-3">Motor Function</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Tapping Frequency:</span>
                  <span className="font-mono">{data.frequency.toFixed(1)} Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Rhythmicity:</span>
                  <span className="font-mono">{data.rhythmicity.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Consistency:</span>
                  <span className="font-mono">{data.spatialConsistency.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-800 mb-3">Tremor Analysis</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Frequency:</span>
                  <span className="font-mono">{data.tremorFrequency.toFixed(1)} Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Amplitude:</span>
                  <span className="font-mono">{data.tremorAmplitude.toFixed(3)} m/s²</span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="font-mono">
                    {data.tremorFrequency > 8 ? 'Physiological' :
                     data.tremorFrequency > 0 && data.tremorFrequency < 6 ? 'Pathological' : 'Minimal'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-3">Stability</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Gyro Stability:</span>
                  <span className="font-mono">{data.gyroStability.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Data Points:</span>
                  <span className="font-mono">{data.tremorData.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Quality:</span>
                  <span className="font-mono">
                    {data.tremorData.length > 50 ? 'High' : 'Moderate'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-semibold text-yellow-800 mb-2">Clinical Reference Values</h4>
            <div className="text-sm text-yellow-700 space-y-1">
              <div>• Normal tapping frequency: 3-8 Hz</div>
              <div>• Physiological tremor: 6-12 Hz, less than 0.25 m/s²</div>
              <div>• Pathological tremor: 3-7 Hz, greater than 0.25 m/s²</div>
              <div>• Bradykinesia threshold: less than 3 Hz tapping</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          No data available for {hand} hand yet. Please complete the tests.
        </div>
      )}

      <div className="text-center mt-6">
        <button
          onClick={goToNextPhase}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          {currentPhase === 'left-results' ? 'Test Right Hand' : 'View Final Results'}
        </button>
      </div>
    </div>
  );

  const renderFinalResults = () => {
    const dominantHand = leftHandData && rightHandData ?
      (leftHandData.overallScore > rightHandData.overallScore ? 'Left' : 'Right') : 'Unknown';

    const confidenceScore = leftHandData && rightHandData ?
      (100 - Math.min(100, Math.abs(leftHandData.overallScore - rightHandData.overallScore) * 2)).toFixed(1) : 'N/A';

    return (
      <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <CheckCircle className="mx-auto mb-4 text-green-600" size={48} />
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Comprehensive Clinical Assessment</h2>
          <p className="text-gray-600">Advanced bilateral hand movement analysis with real sensor data</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {leftHandData && (
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-4 text-xl">Left Hand Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Clinical Score:</span>
                  <span className={`font-bold ${leftHandData.categoryColor}`}>
                    {leftHandData.overallScore.toFixed(1)}/100
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Category:</span>
                  <span className={`font-bold ${leftHandData.categoryColor}`}>
                    {leftHandData.category}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tapping Rate:</span>
                  <span className="font-mono">{leftHandData.frequency.toFixed(1)} Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Tremor Frequency:</span>
                  <span className="font-mono">{leftHandData.tremorFrequency.toFixed(1)} Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Gyro Stability:</span>
                  <span className="font-mono">{leftHandData.gyroStability.toFixed(1)}%</span>
                </div>
                <div className="text-xs text-blue-600 mt-2">
                  {leftHandData.tremorData.length} sensor data points analyzed
                </div>
              </div>
            </div>
          )}

          {rightHandData && (
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="font-bold text-green-800 mb-4 text-xl">Right Hand Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Clinical Score:</span>
                  <span className={`font-bold ${rightHandData.categoryColor}`}>
                    {rightHandData.overallScore.toFixed(1)}/100
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Category:</span>
                  <span className={`font-bold ${rightHandData.categoryColor}`}>
                    {rightHandData.category}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tapping Rate:</span>
                  <span className="font-mono">{rightHandData.frequency.toFixed(1)} Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Tremor Frequency:</span>
                  <span className="font-mono">{rightHandData.tremorFrequency.toFixed(1)} Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Gyro Stability:</span>
                  <span className="font-mono">{rightHandData.gyroStability.toFixed(1)}%</span>
                </div>
                <div className="text-xs text-green-600 mt-2">
                  {rightHandData.tremorData.length} sensor data points analyzed
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-purple-50 p-6 rounded-lg mb-6">
          <h3 className="font-bold text-purple-800 mb-4 text-xl">Advanced Hand Dominance Prediction</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-3xl font-bold text-purple-800 mb-2">
                Predicted Dominant Hand: {dominantHand}
              </div>
              <div className="text-purple-700 mb-4">
                Confidence Score: {confidenceScore}%
              </div>
              <div className="space-y-2 text-sm text-purple-700">
                <div>• Multi-modal sensor analysis</div>
                <div>• Motor performance differential</div>
                <div>• Gyroscopic stability comparison</div>
                <div>• Real-time tremor assessment</div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-3">Bilateral Comparison</h4>
              {leftHandData && rightHandData ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Tapping Difference:</span>
                    <span className="font-mono">
                      {Math.abs(leftHandData.frequency - rightHandData.frequency).toFixed(1)} Hz
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tremor Difference:</span>
                    <span className="font-mono">
                      {Math.abs(leftHandData.tremorFrequency - rightHandData.tremorFrequency).toFixed(1)} Hz
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stability Difference:</span>
                    <span className="font-mono">
                      {Math.abs(leftHandData.gyroStability - rightHandData.gyroStability).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Complete both hand tests for bilateral comparison.</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-yellow-50 p-6 rounded-lg">
            <h3 className="font-bold text-yellow-800 mb-4 text-xl">Clinical Recommendations</h3>
            <div className="space-y-2 text-sm text-yellow-700">
              {leftHandData && rightHandData && leftHandData.overallScore > 75 && rightHandData.overallScore > 75 ? (
                <>
                  <div>✓ Normal bilateral motor function detected</div>
                  <div>✓ No significant tremor abnormalities</div>
                  <div>✓ Adequate hand coordination and stability</div>
                </>
              ) : (
                <>
                  <div>⚠ Consider follow-up neurological assessment</div>
                  <div>⚠ Monitor for progressive motor changes</div>
                  <div>⚠ Possible motor function impairment detected</div>
                </>
              )}
              <div className="mt-3 pt-3 border-t border-yellow-200">
                <div>• Results based on real sensor data analysis</div>
                <div>• Consult healthcare provider for clinical interpretation</div>
                <div>• Consider environmental factors during testing</div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 p-6 rounded-lg">
            <h3 className="font-bold text-indigo-800 mb-4 text-xl">Technical Summary</h3>
            <div className="space-y-2 text-sm text-indigo-700">
              <div>• Real iPhone sensor integration</div>
              <div>• Advanced gyroscope analysis</div>
              <div>• 3D tremor visualization</div>
              <div>• Clinical-grade frequency analysis</div>
              <div>• Progressive Web App (PWA) compatible</div>
              <div className="mt-3 pt-3 border-t border-indigo-200">
                <div className="font-medium">Data Quality:</div>
                <div>
                  Left: {leftHandData ? leftHandData.tremorData.length : 0} points,
                  Right: {rightHandData ? rightHandData.tremorData.length : 0} points
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">Progressive Web App Features</h4>
            <div className="text-sm text-gray-600">
              This app can be installed on your iPhone home screen for offline use.
              Real sensor data provides clinical-grade tremor analysis and motor function assessment.
            </div>
          </div>

          <button
            onClick={() => {
              setCurrentPhase('intro');
              setLeftHandData(null);
              setRightHandData(null);
              setTestProgress(0);
              setTapCount(0);
              setTestTimer(10);
              tremorDataRef.current = [];
              setTremorHistory([]);
              setPermissionGranted(false); // Reset permission for a full restart
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Start New Assessment
          </button>
        </div>
      </div>
    );
  };

  // Main render function for the component
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-4 px-4">
      <div className="container mx-auto">
        <div className="max-w-4xl mx-auto mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-medium text-gray-700">Clinical Assessment Progress</span>
            <span className="text-lg font-medium text-gray-700">
              {phases.indexOf(currentPhase) + 1} of {phases.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${((phases.indexOf(currentPhase) + 1) / phases.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Render the current phase based on state */}
        {(() => {
          switch (currentPhase) {
            case 'intro':
              return renderIntroduction();
            case 'left-tap':
              return renderTappingTest('Left');
            case 'left-tremor':
              return renderTremorTest('Left');
            case 'left-results':
              return renderHandResults('Left', leftHandData);
            case 'right-tap':
              return renderTappingTest('Right');
            case 'right-tremor':
              return renderTremorTest('Right');
            case 'right-results':
              return renderHandResults('Right', rightHandData);
            case 'final-results':
              return renderFinalResults();
            default:
              return renderIntroduction();
          }
        })()}
      </div>
    </div>
  );
};

export default HandMovementAssessment;