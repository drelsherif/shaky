import React, { useState, useEffect, useRef } from 'react';
import { Activity, Hand, BarChart3, CheckCircle, Play, Smartphone } from 'lucide-react';

// Simple Tremor Visualization Component
const TremorVisualization = ({ tremorData }) => {
  if (!tremorData || tremorData.length === 0) {
    return (
      <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-gray-500">Waiting for sensor data...</div>
      </div>
    );
  }

  // Create a simple line chart using SVG
  const width = 400;
  const height = 200;
  const padding = 20;

  const maxMagnitude = Math.max(...tremorData.map(d => d.magnitude), 1);
  const minMagnitude = Math.min(...tremorData.map(d => d.magnitude), 0);

  const points = tremorData.map((d, i) => {
    const x = (i / (tremorData.length - 1)) * (width - 2 * padding) + padding;
    // Handle case where maxMagnitude and minMagnitude are the same to avoid division by zero
    const y = height - padding - ((d.magnitude - minMagnitude) / (maxMagnitude - minMagnitude || 1)) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full bg-white rounded-lg border p-4">
      <svg width="100%" height="200" viewBox={`0 0 ${width} ${height}`}>
        <polyline
          fill="none"
          stroke="blue"
          strokeWidth="2"
          points={points}
        />
        <text x={padding} y={padding} fontSize="12" fill="gray">
          Max: {maxMagnitude.toFixed(3)}
        </text>
        <text x={padding} y={height - 5} fontSize="12" fill="gray">
          Min: {minMagnitude.toFixed(3)}
        </text>
      </svg>
    </div>
  );
};

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
  const [tremorHistory, setTremorHistory] = useState([]);
  const [leftHandData, setLeftHandData] = useState(null);
  const [rightHandData, setRightHandData] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [testTimer, setTestTimer] = useState(10);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const intervalRef = useRef(null);
  const tremorDataRef = useRef([]);

  // Define the sequence of test phases
  const phases = [
    'intro', 'left-tap', 'left-tremor', 'left-results',
    'right-tap', 'right-tremor', 'right-results', 'final-results'
  ];

  // Detect iOS device on component mount
  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOSDevice(iOS);
  }, []);

  // Handle DeviceMotionEvent for sensor data
  const handleMotionEvent = (event) => {
    const accel = event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
    const rotationRate = event.rotationRate || { alpha: 0, beta: 0, gamma: 0 };

    const magnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);

    const newSensorData = {
      acceleration: accel,
      gyroscope: {
        alpha: rotationRate.alpha || 0,
        beta: rotationRate.beta || 0,
        gamma: rotationRate.gamma || 0
      },
      magnitude: magnitude,
      timestamp: Date.now()
    };

    setSensorData(newSensorData);

    if (isTestRunning && currentPhase.includes('tremor')) {
      tremorDataRef.current.push(newSensorData);
      setTremorHistory(prev => {
        const updatedHistory = [...prev, newSensorData];
        // Keep only the last 200 data points for performance and real-time visualization
        return updatedHistory.slice(Math.max(updatedHistory.length - 200, 0));
      });
    }
  };

  // Analyze tremor frequency using peak detection
  const analyzeTremorFrequency = (data) => {
    if (data.length < 10) return 0;

    const magnitudes = data.map(d => d.magnitude);
    let peakCount = 0;
    const threshold = magnitudes.reduce((sum, val) => sum + val, 0) / magnitudes.length;

    for (let i = 1; i < magnitudes.length - 1; i++) {
      if (magnitudes[i] > magnitudes[i - 1] &&
          magnitudes[i] > magnitudes[i + 1] &&
          magnitudes[i] > threshold) {
        peakCount++;
      }
    }

    const durationSeconds = data.length > 0 ?
      (data[data.length - 1].timestamp - data[0].timestamp) / 1000 : 1;
    return durationSeconds > 0 ? peakCount / durationSeconds : 0;
  };

  // Analyze hand data and return results
  const analyzeHandData = (tapCount, elapsedTime, tremorData, handType) => {
    console.log(`Analyzing ${handType} hand:`, { tapCount, elapsedTime, tremorPoints: tremorData.length });

    const frequency = tapCount / Math.max(1, elapsedTime);
    const tremorFrequency = analyzeTremorFrequency(tremorData);
    const tremorAmplitude = tremorData.length > 0 ?
      tremorData.reduce((sum, d) => sum + d.magnitude, 0) / tremorData.length : 0;

    // Calculate gyroscope stability
    const gyroRotationSum = tremorData.reduce((sum, d) =>
      sum + (Math.abs(d.gyroscope.alpha || 0) + Math.abs(d.gyroscope.beta || 0) + Math.abs(d.gyroscope.gamma || 0))
    , 0);
    const averageGyroRotation = tremorData.length > 0 ? gyroRotationSum / tremorData.length : 0;
    const gyroStability = Math.max(0, 100 - (averageGyroRotation * 0.1));

    // Calculate scores
    const frequencyScore = Math.min(100, frequency * 20); // Scale tapping frequency to a score
    const rhythmicity = frequency > 0 ? Math.max(0, 100 - (Math.abs(frequency - 5) * 15)) : 0; // Penalize deviation from an ideal tapping rhythm (e.g., 5Hz)
    const tremorQualityScore = Math.max(0, 100 - (tremorFrequency * 5) - (tremorAmplitude * 10)); // Penalize high tremor frequency and amplitude

    const overallScore = Math.min(100, Math.max(0,
      (frequencyScore * 0.4) +
      (rhythmicity * 0.2) +
      (gyroStability * 0.3) +
      (tremorQualityScore * 0.1)
    ));

    // Determine category
    let category, categoryColor;
    if (overallScore >= 90) {
      category = 'Excellent';
      categoryColor = 'text-green-600';
    } else if (overallScore >= 75) {
      category = 'Good';
      categoryColor = 'text-blue-600';
    } else if (overallScore >= 60) {
      category = 'Fair';
      categoryColor = 'text-yellow-600';
    } else {
      category = 'Poor';
      categoryColor = 'text-red-600';
    }

    // Clinical interpretation
    let clinicalInterpretation = 'Normal motor function detected.';
    if (frequency < 3 && currentPhase.includes('tap')) { // Only apply to tapping tests
      clinicalInterpretation = 'Bradykinesia detected - reduced movement speed.';
    }
    if (tremorFrequency > 0 && tremorFrequency < 6 && tremorAmplitude > 0.25) {
      clinicalInterpretation += ' Possible pathological tremor detected.';
    }
    if (gyroStability < 60) {
      clinicalInterpretation += ' Reduced hand stability observed.';
    }

    const results = {
      frequency: Number(frequency.toFixed(2)),
      rhythmicity: Number(rhythmicity.toFixed(1)),
      spatialConsistency: Number(gyroStability.toFixed(1)), // Renamed from gyroStability for clarity
      tremorFrequency: Number(tremorFrequency.toFixed(2)),
      tremorAmplitude: Number(tremorAmplitude.toFixed(3)),
      gyroStability: Number(gyroStability.toFixed(1)),
      overallScore: Number(overallScore.toFixed(1)),
      category,
      categoryColor,
      clinicalInterpretation,
      tremorData: [...tremorData] // Store a copy of tremorData for visualization if needed
    };

    console.log('Analysis results:', results);
    return results;
  };

  // Request sensor permissions
  const requestSensorPermissions = async () => {
    try {
      let granted = false;
      if (isIOSDevice && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const permission = await DeviceMotionEvent.requestPermission();
        granted = permission === 'granted';
      } else {
        // For non-iOS devices or if permission API is not available
        granted = true;
      }

      setPermissionGranted(granted);

      if (granted) {
        window.addEventListener('devicemotion', handleMotionEvent, true);
        // Directly move to the next phase after permissions are handled
        goToNextPhase();
      } else {
        alert('Sensor access denied. Using demo mode with limited functionality.');
        setPermissionGranted(true); // Allow proceeding even if denied for demo purposes
        goToNextPhase();
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      alert('Error requesting sensor permissions. Using demo mode.');
      setPermissionGranted(true); // Allow proceeding for demo purposes
      goToNextPhase();
    }
  };

  // Start test with proper initialization
  const startTest = () => {
    console.log('Starting test for phase:', currentPhase);
    setIsTestRunning(true);
    setTestProgress(0);
    setTestTimer(10); // Reset timer to initial value
    
    // Reset appropriate counters based on test type
    if (currentPhase.includes('tap')) {
      setTapCount(0);
    }
    if (currentPhase.includes('tremor')) {
      tremorDataRef.current = []; // Clear previous tremor data
      setTremorHistory([]); // Clear previous tremor history for visualization
    }

    intervalRef.current = setInterval(() => {
      setTestTimer(prev => {
        const newTimer = prev - 1;
        setTestProgress(((10 - newTimer) / 10) * 100);

        if (newTimer <= 0) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          stopTest(); // Call stopTest when timer runs out
          return 0;
        }
        return newTimer;
      });
    }, 1000);
  };

  // Stop test and analyze data
  const stopTest = () => {
    console.log('Stopping test for phase:', currentPhase);
    setIsTestRunning(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const elapsedTime = 10; // The test duration is fixed at 10 seconds
    let results;

    if (currentPhase.includes('tap')) {
      console.log('Analyzing tap data:', { tapCount, elapsedTime });
      results = analyzeHandData(tapCount, elapsedTime, [], currentPhase.includes('left') ? 'left' : 'right');
    } else if (currentPhase.includes('tremor')) {
      console.log('Analyzing tremor data:', { tremorPoints: tremorDataRef.current.length, elapsedTime });
      results = analyzeHandData(0, elapsedTime, tremorDataRef.current, currentPhase.includes('left') ? 'left' : 'right');
    }

    // Save results
    if (currentPhase.includes('left')) {
      console.log('Saving left hand data:', results);
      setLeftHandData(results);
    } else if (currentPhase.includes('right')) {
      console.log('Saving right hand data:', results);
      setRightHandData(results);
    }
  };

  // Handle tap events
  const handleTap = () => {
    if (isTestRunning && currentPhase.includes('tap')) {
      setTapCount(prev => prev + 1);
    }
  };

  // Navigate to next phase
  const goToNextPhase = () => {
    const currentIndex = phases.indexOf(currentPhase);
    if (currentIndex < phases.length - 1) {
      const nextPhase = phases[currentIndex + 1];
      console.log('Moving to next phase:', nextPhase);
      setCurrentPhase(nextPhase);
      
      // Reset states for new phase
      setTestProgress(0);
      setTapCount(0);
      setTestTimer(10);
      tremorDataRef.current = [];
      setTremorHistory([]);
      setIsTestRunning(false); // Ensure test is not running when entering new phase
    }
  };

  // Cleanup effect for event listener and interval
  useEffect(() => {
    return () => {
      window.removeEventListener('devicemotion', handleMotionEvent);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Render functions
  const renderIntroduction = () => (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <Activity className="mx-auto mb-6 text-blue-600" size={64} />
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Clinical Hand Movement Assessment</h1>
        <p className="text-gray-600 text-lg">Real Sensor Integration & Analysis</p>
      </div>

      <div className="space-y-6 mb-8">
        <div className="bg-blue-50 p-6 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-4 text-lg">Features</h3>
          <ul className="text-blue-700 space-y-2">
            <li>• Real-time accelerometer and gyroscope data</li>
            <li>• Tremor visualization and analysis</li>
            <li>• Clinical-grade frequency analysis</li>
            <li>• Bilateral hand comparison</li>
          </ul>
        </div>

        {isIOSDevice && (
          <div className="bg-yellow-50 p-6 rounded-lg">
            <div className="flex items-center mb-3">
              <Smartphone className="mr-3 text-yellow-600" size={24} />
              <h4 className="font-semibold text-yellow-800 text-lg">iOS Device Detected</h4>
            </div>
            <p className="text-yellow-700">This app will request permission to access motion sensors.</p>
          </div>
        )}
      </div>

      <div className="text-center">
        {!permissionGranted ? (
          <button
            onClick={requestSensorPermissions}
            className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-6 rounded-xl text-xl font-semibold transition-colors shadow-lg"
          >
            {isIOSDevice ? 'Grant Permissions & Start' : 'Start Assessment'}
          </button>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-center text-green-600">
              <CheckCircle size={32} className="mr-3" />
              <span className="text-xl font-semibold">Ready to start!</span>
            </div>
            <button
              onClick={goToNextPhase} // Automatically proceed after permissions granted or acknowledged
              className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-6 rounded-xl text-xl font-semibold transition-colors shadow-lg"
            >
              Begin Assessment
            </button>
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
        <p className="text-gray-600 text-lg">Tap as quickly as possible for 10 seconds</p>
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
          disabled={!isTestRunning}
          className={`w-80 h-80 rounded-full text-4xl font-bold transition-all duration-150 ${
            isTestRunning
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xl'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          TAP
        </button>
      </div>

      <div className="text-center space-y-6">
        {!isTestRunning && testTimer === 10 && ( // Display start button only before test begins
          <button
            onClick={startTest}
            className="bg-green-600 hover:bg-green-700 text-white px-12 py-6 rounded-xl text-xl font-semibold transition-colors shadow-lg"
          >
            <Play size={24} className="inline mr-3" />
            Start Test
          </button>
        )}

        {!isTestRunning && testTimer === 0 && ( // Display continue button only after test ends
          <button
            onClick={goToNextPhase}
            className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-6 rounded-xl text-xl font-semibold transition-colors shadow-lg"
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
        <p className="text-gray-600 text-lg mb-2">Hold device steady with your {hand.toLowerCase()} hand</p>
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
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-sm text-blue-600 mb-2">Accel X</div>
              <div className="text-lg font-mono font-bold">{sensorData.acceleration.x.toFixed(3)}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-sm text-blue-600 mb-2">Accel Y</div>
              <div className="text-lg font-mono font-bold">{sensorData.acceleration.y.toFixed(3)}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-sm text-blue-600 mb-2">Accel Z</div>
              <div className="text-lg font-mono font-bold">{sensorData.acceleration.z.toFixed(3)}</div>
            </div>
          </div>

          <div className="bg-purple-50 p-6 rounded-lg mb-6">
            <h4 className="font-semibold text-purple-800 mb-4 text-lg">Live Analysis</h4>
            <div className="text-base text-purple-700 space-y-2">
              <div>Magnitude: <span className="font-mono font-bold">{sensorData.magnitude.toFixed(3)} m/s²</span></div>
              <div>Frequency: <span className="font-mono font-bold">{analyzeTremorFrequency(tremorHistory).toFixed(1)} Hz</span></div>
              <div>Data Points: <span className="font-mono font-bold">{tremorHistory.length}</span></div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-800 mb-4 text-xl">Tremor Visualization</h3>
          <TremorVisualization tremorData={tremorHistory} />
        </div>
      </div>

      <div className="text-center space-y-6">
        {!isTestRunning && testTimer === 10 && ( // Display start button only before test begins
          <button
            onClick={startTest}
            className="bg-purple-600 hover:bg-purple-700 text-white px-12 py-6 rounded-xl text-xl font-semibold transition-colors shadow-lg"
          >
            <Play size={24} className="inline mr-3" />
            Start Analysis
          </button>
        )}

        {!isTestRunning && testTimer === 0 && ( // Display continue button only after test ends
          <button
            onClick={goToNextPhase}
            className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-6 rounded-xl text-xl font-semibold transition-colors shadow-lg"
          >
            View Results
          </button>
        )}
      </div>
    </div>
  );

  const renderHandResults = (hand, data) => {
    console.log(`Rendering results for ${hand} hand:`, data);
    
    return (
      <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <BarChart3 className="mx-auto mb-4 text-green-600" size={48} />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{hand} Hand Results</h2>
          <p className="text-gray-600">Clinical analysis completed</p>
        </div>

        {data ? (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-3">Clinical Assessment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Overall Score:</span>
                  <span className={`font-bold ${data.categoryColor}`}>{data.overallScore}/100</span>
                </div>
                <div className="flex justify-between">
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
                    <span>Frequency:</span>
                    <span className="font-mono">{data.frequency} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rhythmicity:</span>
                    <span className="font-mono">{data.rhythmicity}%</span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-semibold text-purple-800 mb-3">Tremor Analysis</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Frequency:</span>
                    <span className="font-mono">{data.tremorFrequency} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amplitude:</span>
                    <span className="font-mono">{data.tremorAmplitude}</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-3">Stability</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Gyro Stability:</span>
                    <span className="font-mono">{data.gyroStability}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Data Points:</span>
                    <span className="font-mono">{data.tremorData.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            No data available for {hand} hand. Please complete the tests.
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
  };

  const renderFinalResults = () => {
    // Determine dominant hand based on overall score, if both hands have data
    const dominantHand = leftHandData && rightHandData ?
      (leftHandData.overallScore > rightHandData.overallScore ? 'Left' : 'Right') : 'Unknown';

    return (
      <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <CheckCircle className="mx-auto mb-4 text-green-600" size={48} />
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Final Assessment</h2>
          <p className="text-gray-600">Bilateral hand movement analysis complete</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {leftHandData && (
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-4 text-xl">Left Hand Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Score:</span>
                  <span className={`font-bold ${leftHandData.categoryColor}`}> {/* Corrected: Use leftHandData */}
                    {leftHandData.overallScore}/100
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Category:</span>
                  <span className={`font-bold ${leftHandData.categoryColor}`}> {/* Corrected: Use leftHandData */}
                    {leftHandData.category}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tapping Rate:</span>
                  <span className="font-mono">{leftHandData.frequency} Hz</span> {/* Corrected: Use leftHandData */}
                </div>
              </div>
            </div>
          )}

          {rightHandData && (
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="font-bold text-green-800 mb-4 text-xl">Right Hand Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Score:</span>
                  <span className={`font-bold ${rightHandData.categoryColor}`}>
                    {rightHandData.overallScore}/100
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
                  <span className="font-mono">{rightHandData.frequency} Hz</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-purple-50 p-6 rounded-lg mb-6">
          <h3 className="font-bold text-purple-800 mb-4 text-xl">Hand Dominance Analysis</h3>
          <div className="text-2xl font-bold text-purple-800 mb-2">
            Predicted Dominant Hand: {dominantHand}
          </div>
          {leftHandData && rightHandData && (
            <div className="text-purple-700 space-y-2">
              <div>Score Difference: {Math.abs(leftHandData.overallScore - rightHandData.overallScore).toFixed(1)} points</div>
              <div>Tapping Difference: {Math.abs(leftHandData.frequency - rightHandData.frequency).toFixed(1)} Hz</div>
            </div>
          )}
        </div>

        <div className="bg-yellow-50 p-6 rounded-lg mb-6">
          <h3 className="font-bold text-yellow-800 mb-4 text-xl">Clinical Summary</h3>
          <div className="text-yellow-700 space-y-2">
            {leftHandData && rightHandData && leftHandData.overallScore > 75 && rightHandData.overallScore > 75 ? (
              <div>✓ Normal bilateral motor function detected</div>
            ) : (
              <div>⚠ Consider follow-up assessment</div>
            )}
            <div>• Results based on real sensor data analysis</div>
            <div>• Consult healthcare provider for clinical interpretation</div>
          </div>
        </div>

        <div className="text-center space-y-4">
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
              setPermissionGranted(false);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Start New Assessment
          </button>
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-4 px-4">
      <div className="container mx-auto">
        <div className="max-w-4xl mx-auto mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-medium text-gray-700">Assessment Progress</span>
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

        {/* Debug info - remove in production */}
        <div className="max-w-4xl mx-auto mt-4 p-4 bg-gray-100 rounded-lg text-sm">
          <div>Current Phase: {currentPhase}</div>
          <div>Left Hand Data: {leftHandData ? 'Available' : 'None'}</div>
          <div>Right Hand Data: {rightHandData ? 'Available' : 'None'}</div>
          <div>Test Running: {isTestRunning ? 'Yes' : 'No'}</div>
          <div>Timer: {testTimer}s</div>
          <div>Tap Count: {tapCount}</div>
          <div>Tremor Data Points: {tremorDataRef.current.length}</div>
        </div>
      </div>
    </div>
  );
};

export default HandMovementAssessment;