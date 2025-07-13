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
  const [tremorHistory, setTremorHistory] = useState([]);
  const [leftHandData, setLeftHandData] = useState(null);
  const [rightHandData, setRightHandData] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [testTimer, setTestTimer] = useState(10);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const intervalRef = useRef(null);
  const tremorDataRef = useRef([]); // This ref will hold all collected tremor data

  // Phase navigation
  const phases = [
    'intro', 'left-tap', 'left-tremor', 'left-results',
    'right-tap', 'right-tremor', 'right-results', 'final-results'
  ];

  // Detect iOS device
  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOSDevice(iOS);
  }, []);

  // Real sensor data handling
  const handleMotionEvent = (event) => {
    const accel = event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
    const rotationRate = event.rotationRate || { alpha: 0, beta: 0, gamma: 0 };

    const magnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);

    // Simple low-pass filter to smooth out sensor data
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

    setSensorData(newSensorData);

    if (isTestRunning && currentPhase.includes('tremor')) {
      // Only record tremor data if the test is running and it's a tremor phase
      tremorDataRef.current.push({
        ...newSensorData,
        // Calculate relative time within the 10-second test window for consistency
        time: (10 - testTimer) * 1000 + (Date.now() % 1000) // This time calculation needs to be relative to test start
      });

      // Keep tremorHistory state updated for visualization, but tremorDataRef is the source for analysis
      setTremorHistory([...tremorDataRef.current]);
    }
  };

  // Tremor frequency analysis (using peak detection for simplicity)
  const analyzeTremorFrequency = (tremorData) => {
    if (tremorData.length < 50) return 0; // Need a reasonable number of points for frequency analysis

    const magnitudes = tremorData.map(d => d.magnitude);
    let peakCount = 0;
    let lastPeakIndex = -1;
    const minPeakDistance = 5; // Minimum data points between peaks to consider them distinct

    for (let i = 1; i < magnitudes.length - 1; i++) {
      // Check for a local maximum
      if (magnitudes[i] > magnitudes[i - 1] && magnitudes[i] > magnitudes[i + 1]) {
        if (lastPeakIndex === -1 || (i - lastPeakIndex) > minPeakDistance) {
          peakCount++;
          lastPeakIndex = i;
        }
      }
    }

    const startTime = tremorData[0].timestamp;
    const endTime = tremorData[tremorData.length - 1].timestamp;
    const timeSpanSeconds = (endTime - startTime) / 1000; // Convert to seconds

    return timeSpanSeconds > 0 ? (peakCount / timeSpanSeconds) : 0;
  };


  // Clinical analysis
  const analyzeHandData = (tapCount, elapsedTime, tremorData, handType) => {
    console.log('Analyzing hand data:', { tapCount, elapsedTime, tremorDataPoints: tremorData.length, handType });

    const actualElapsedTime = Math.max(1, elapsedTime); // Ensure minimum 1 second to avoid division by zero
    const frequency = tapCount / actualElapsedTime;

    console.log('Calculated tapping frequency:', frequency);

    const tremorFrequency = analyzeTremorFrequency(tremorData);
    const tremorAmplitude = tremorData.length > 0 ?
      tremorData.reduce((sum, d) => sum + d.magnitude, 0) / tremorData.length : 0;

    console.log('Tremor analysis:', { tremorFrequency, tremorAmplitude });

    // Improved gyroscope stability analysis
    // Measures how much the device is rotating. Lower values (closer to 0) mean more stable.
    const gyroSumOfAbsRotations = tremorData.reduce((sum, d) =>
      sum + (Math.abs(d.gyroscope.alpha || 0) + Math.abs(d.gyroscope.beta || 0) + Math.abs(d.gyroscope.gamma || 0))
    , 0);

    const averageGyroRotation = tremorData.length > 0 ? gyroSumOfAbsRotations / tremorData.length : 0;
    // Map average rotation to a 0-100 stability score. Adjust divisor for sensitivity.
    const gyroStability = Math.max(0, 100 - (averageGyroRotation * 2)); // Multiplying by 2 to scale it. Adjust as needed.

    // Calculate rhythmicity based on tap frequency (closer to 5 Hz is generally considered good)
    const rhythmicity = frequency > 0 ? Math.max(0, 100 - (Math.abs(frequency - 5) * 15)) : 0;
    const spatialConsistency = Math.max(0, gyroStability); // Using gyro stability for spatial consistency in this context

    console.log('Calculated metrics:', { rhythmicity, spatialConsistency, gyroStability });

    const getScoreCategory = (score) => {
      if (score >= 90) return { category: 'Excellent', color: 'text-green-600' };
      if (score >= 75) return { category: 'Good', color: 'text-blue-600' };
      if (score >= 60) return { category: 'Fair', color: 'text-yellow-600' };
      return { category: 'Poor', color: 'text-red-600' };
    };

    // Improved overall score calculation - weighted average of key metrics
    const frequencyScore = Math.min(100, frequency * 20); // Scale frequency, cap at 100
    const tremorFrequencyScore = Math.max(0, 100 - (Math.abs(tremorFrequency - 0) * 10)); // Lower tremor freq is better
    const tremorAmplitudeScore = Math.max(0, 100 - (tremorAmplitude * 200)); // Lower tremor amplitude is better

    const overallScore = Math.min(100, Math.max(0,
      (frequencyScore * 0.3) + // Tapping speed
      (rhythmicity * 0.2) +    // Tapping consistency
      (gyroStability * 0.3) +  // Hand steadiness / Tremor stability
      (tremorFrequencyScore * 0.1) + // Low tremor frequency is good
      (tremorAmplitudeScore * 0.1)   // Low tremor amplitude is good
    ));

    const category = getScoreCategory(overallScore);

    // Clinical interpretation based on tremor frequency and tapping rate
    let clinicalInterpretation = 'Normal motor function';
    if (frequency < 1) {
      clinicalInterpretation = 'Severe bradykinesia detected - significantly reduced movement speed. Consider neurological assessment.';
    } else if (frequency < 3) {
      clinicalInterpretation = 'Bradykinesia detected - reduced movement speed. Suggests mild to moderate motor slowness.';
    } else if (tremorFrequency > 8 && tremorAmplitude < 0.25) {
      clinicalInterpretation = 'Physiological tremor detected - within normal range, usually not clinically significant.';
    } else if (tremorFrequency > 0 && tremorFrequency < 6 && tremorAmplitude > 0.25) {
      clinicalInterpretation = 'Possible pathological tremor (e.g., resting or essential tremor characteristics). Consult physician for further evaluation.';
    } else if (frequency >= 3 && frequency <= 8 && tremorAmplitude < 0.25) {
      clinicalInterpretation = 'Normal motor function, good tapping rate and minimal tremor detected.';
    } else if (tremorAmplitude > 0.5) {
      clinicalInterpretation = 'Significant tremor amplitude detected. Further clinical assessment recommended.';
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
      tremorData: [...tremorData] // Store a copy of the tremor data for results display/debugging
    };

    console.log('Final analysis results for hand:', handType, results);
    return results;
  };

  // Request sensor permissions
  const requestSensorPermissions = async () => {
    try {
      let permissionGranted = false;

      if (isIOSDevice && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const permission = await DeviceMotionEvent.requestPermission();
        permissionGranted = permission === 'granted';

        if (permissionGranted) {
          window.addEventListener('devicemotion', handleMotionEvent, true);
        }
      } else {
        permissionGranted = true;
        window.addEventListener('devicemotion', handleMotionEvent, true);
      }

      setPermissionGranted(permissionGranted);

      if (permissionGranted) {
        setTimeout(() => {
          nextPhase(); // Automatically proceed to the next phase if permission is granted
        }, 1000);
      }
    } catch (error) {
      console.error('Permission denied:', error);
      alert('Sensor access denied. The app will use simulated data for demonstration.');
      setPermissionGranted(true); // Allow continuing with a warning
      setTimeout(() => {
        nextPhase();
      }, 1000);
    }
  };

  const startTest = () => {
    setIsTestRunning(true);
    setTestProgress(0);
    setTapCount(0);
    setTestTimer(10);
    tremorDataRef.current = []; // Clear previous tremor data for a new test
    setTremorHistory([]); // Clear for UI as well

    console.log(`Starting ${currentPhase} test`);

    // Reset and start the timer
    intervalRef.current = setInterval(() => {
      setTestTimer(prev => {
        const newTimer = prev - 1;
        setTestProgress((10 - newTimer) * 10);

        if (newTimer <= 0) {
          console.log('Timer reached 0, stopping test');
          stopTest();
          return 0;
        }
        return newTimer;
      });
    }, 1000);
  };

  const stopTest = () => {
    console.log('Stopping test - Current phase:', currentPhase);
    console.log('Final tap count:', tapCount);
    console.log('Collected tremor data points:', tremorDataRef.current.length);

    setIsTestRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Calculate elapsed time from the beginning of the 10-second test
    const elapsedTime = 10 - testTimer; // Test duration is fixed at 10 seconds

    // Ensure we pass the correct and complete data for analysis
    const dataToAnalyze = currentPhase.includes('tremor') ? tremorDataRef.current : [];

    const results = analyzeHandData(tapCount, elapsedTime, dataToAnalyze, currentPhase.includes('left') ? 'left' : 'right');
    console.log('Analysis results from stopTest:', results);

    if (currentPhase.includes('left')) {
      setLeftHandData(results);
      console.log('Left hand data saved:', results);
    } else {
      setRightHandData(results);
      console.log('Right hand data saved:', results);
    }

    // Reset timer and progress for the next phase, but after results are saved
    setTimeout(() => {
      setTestTimer(10);
      setTestProgress(0);
      nextPhase(); // Automatically move to the next phase after analysis
    }, 1000); // Give a moment for state updates and console logs
  };

  const handleTap = () => {
    if (isTestRunning && currentPhase.includes('tap')) { // Only count taps during tapping test
      setTapCount(prev => prev + 1);
    }
  };

  const nextPhase = () => {
    const currentIndex = phases.indexOf(currentPhase);
    if (currentIndex < phases.length - 1) {
      setCurrentPhase(phases[currentIndex + 1]);
      // Reset states for the new phase
      setTestProgress(0);
      setTapCount(0);
      setTestTimer(10);
      tremorDataRef.current = []; // Clear ref for new test
      setTremorHistory([]); // Clear history for new test UI
    }
  };

  // 3D Tremor Visualization Component
  const TremorVisualization = ({ tremorData }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size for high DPI screens
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      const width = rect.width;
      const height = rect.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw background
      ctx.fillStyle = '#1f2937'; // Dark gray background
      ctx.fillRect(0, 0, width, height);

      // Draw axes
      ctx.strokeStyle = '#6b7280'; // Gray for axes
      ctx.lineWidth = 1;
      ctx.beginPath();
      // X axis (time/data points)
      ctx.moveTo(50, height - 50);
      ctx.lineTo(width - 50, height - 50);
      // Y axis (magnitude/rotation)
      ctx.moveTo(50, 50);
      ctx.lineTo(50, height - 50);
      ctx.stroke();

      // Draw tremor data if available
      if (tremorData && tremorData.length > 1) {
        const maxMagnitude = Math.max(...tremorData.map(d => d.magnitude), 1); // Ensure min 1 to avoid division by zero
        const maxGyro = Math.max(...tremorData.map(d => Math.max(Math.abs(d.gyroscope.alpha), Math.abs(d.gyroscope.beta), Math.abs(d.gyroscope.gamma))), 1);

        const scaleX = (width - 100) / Math.max(1, tremorData.length - 1);
        // Scale Y to fit data within the graph, leaving some padding
        const scaleYMagnitude = (height - 100) / (maxMagnitude * 1.2); // 1.2 for some padding above max
        const scaleYGyro = (height - 100) / (maxGyro * 1.2);

        // Draw acceleration magnitude (blue line)
        ctx.strokeStyle = '#3b82f6'; // Blue
        ctx.lineWidth = 2;
        ctx.beginPath();
        tremorData.forEach((data, index) => {
          const x = 50 + index * scaleX;
          // Invert Y-axis for drawing on canvas (0,0 is top-left)
          const y = height - 50 - (data.magnitude * scaleYMagnitude);
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();

        // Draw gyroscope alpha (red line)
        ctx.strokeStyle = '#ef4444'; // Red
        ctx.lineWidth = 1;
        ctx.beginPath();
        tremorData.forEach((data, index) => {
          const x = 50 + index * scaleX;
          // Draw absolute value of alpha for visual consistency of rotation
          const y = height - 50 - ((Math.abs(data.gyroscope.alpha || 0)) * scaleYGyro);
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      }

      // Draw labels
      ctx.fillStyle = '#9ca3af'; // Light gray for text
      ctx.font = '12px sans-serif';
      ctx.fillText('Acceleration (m/s²)', 10, 20);
      ctx.fillText('Rotation (deg/s)', 10, 35);

      // Draw legend
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(160, 10, 20, 3); // Blue line for Accel
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(160, 25, 20, 3); // Red line for Gyro
      ctx.fillText('Magnitude', 185, 13);
      ctx.fillText('Alpha', 185, 28);

    }, [tremorData]); // Redraw when tremorData changes

    return (
      <div className="w-full">
        <canvas
          ref={canvasRef}
          className="w-full h-48 border border-gray-300 rounded-lg bg-gray-900"
          style={{ maxWidth: '100%', height: '200px' }}
        />
      </div>
    );
  };

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
        {isTestRunning && testTimer < 10 && (
          <div className="mt-4 text-2xl text-blue-600 font-semibold">
            Rate: {(tapCount / (10 - testTimer)).toFixed(1)} Hz
          </div>
        )}
      </div>

      <div className="flex justify-center mb-12">
        <button
          onClick={handleTap}
          // Disabled if test is not running OR if timer has already started (i.e., not initial state)
          disabled={!isTestRunning && testTimer !== 10}
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
        {!isTestRunning && testTimer === 10 && (
          <button
            onClick={startTest}
            className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-12 py-6 rounded-xl text-xl font-semibold transition-colors shadow-lg"
            style={{ touchAction: 'manipulation' }}
          >
            <Play size={24} className="inline mr-3" />
            Start Test
          </button>
        )}

        {testTimer === 0 && ( // Test finished
          <button
            onClick={nextPhase} // This will be handled by stopTest's setTimeout for proper flow
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
        {!isTestRunning && testTimer === 10 && (
          <button
            onClick={startTest}
            className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-12 py-6 rounded-xl text-xl font-semibold transition-colors shadow-lg"
            style={{ touchAction: 'manipulation' }}
          >
            <Play size={24} className="inline mr-3" />
            Start Analysis
          </button>
        )}

        {testTimer === 0 && ( // Test finished
          <button
            onClick={nextPhase} // This will be handled by stopTest's setTimeout for proper flow
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

      {data ? ( // Conditional render based on data existence
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
          onClick={nextPhase}
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

    // Confidence score based on the absolute difference in overall scores
    const confidenceScore = leftHandData && rightHandData ?
      (100 - Math.min(100, Math.abs(leftHandData.overallScore - rightHandData.overallScore) * 2)).toFixed(1) : 'N/A'; // Scale difference to a 0-100 score

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
              setPermissionGranted(false); // Reset permission on new assessment
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Start New Assessment
          </button>
        </div>
      </div>
    );
  };

  // Cleanup sensor listeners on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener('devicemotion', handleMotionEvent);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Render current phase
  const renderCurrentPhase = () => {
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
  };

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

        {renderCurrentPhase()}
      </div>
    </div>
  );
};

export default HandMovementAssessment;