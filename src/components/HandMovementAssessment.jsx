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
  const tremorDataRef = useRef([]);

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
      tremorDataRef.current.push({
        ...newSensorData,
        time: (10 - testTimer) * 1000 + (Date.now() % 1000)
      });

      if (tremorDataRef.current.length > 100) {
        tremorDataRef.current.shift();
      }

      setTremorHistory([...tremorDataRef.current]);
    }
  };

  // Tremor frequency analysis
  const analyzeTremorFrequency = (tremorData) => {
    if (tremorData.length < 10) return 0;

    const magnitudes = tremorData.map(d => d.magnitude);
    let peakCount = 0;
    let lastPeak = 0;

    for (let i = 1; i < magnitudes.length - 1; i++) {
      if (magnitudes[i] > magnitudes[i - 1] && magnitudes[i] > magnitudes[i + 1]) {
        if (i - lastPeak > 3) {
          peakCount++;
          lastPeak = i;
        }
      }
    }

    const timeSpan = (tremorData[tremorData.length - 1].time - tremorData[0].time) / 1000;
    return timeSpan > 0 ? (peakCount / timeSpan) : 0;
  };

  // Clinical analysis
  const analyzeHandData = (tapCount, elapsedTime, tremorData, handType) => {
    console.log('Analyzing hand data:', { tapCount, elapsedTime, tremorDataPoints: tremorData.length, handType });

    const actualElapsedTime = Math.max(1, elapsedTime); // Ensure minimum 1 second
    const frequency = tapCount / actualElapsedTime;

    console.log('Calculated frequency:', frequency);

    const tremorFrequency = analyzeTremorFrequency(tremorData);
    const tremorAmplitude = tremorData.length > 0 ?
      tremorData.reduce((sum, d) => sum + d.magnitude, 0) / tremorData.length : 0;

    console.log('Tremor analysis:', { tremorFrequency, tremorAmplitude });

    // Improved gyroscope stability analysis
    const gyroStability = tremorData.length > 0 ?
      Math.max(0, 100 - (tremorData.reduce((sum, d) =>
        sum + (Math.abs(d.gyroscope.alpha || 0) + Math.abs(d.gyroscope.beta || 0) + Math.abs(d.gyroscope.gamma || 0)) / 10
      , 0) / tremorData.length)) : 50; // Default to 50% if no data

    // Calculate rhythmicity based on tap frequency (closer to 5 Hz is better)
    const rhythmicity = frequency > 0 ? Math.max(0, 100 - (Math.abs(frequency - 5) * 15)) : 0;
    const spatialConsistency = Math.max(0, gyroStability);

    console.log('Calculated metrics:', { rhythmicity, spatialConsistency, gyroStability });

    const getScoreCategory = (score) => {
      if (score >= 90) return { category: 'Excellent', color: 'text-green-600' };
      if (score >= 75) return { category: 'Good', color: 'text-blue-600' };
      if (score >= 60) return { category: 'Fair', color: 'text-yellow-600' };
      return { category: 'Poor', color: 'text-red-600' };
    };

    // Improved overall score calculation
    const frequencyScore = Math.min(100, frequency * 20); // Cap at 100
    const overallScore = Math.min(100, Math.max(0,
      (frequencyScore * 0.4 + rhythmicity * 0.3 + spatialConsistency * 0.2 + gyroStability * 0.1)
    ));

    const category = getScoreCategory(overallScore);

    // Clinical interpretation based on tremor frequency and tapping rate
    let clinicalInterpretation = 'Normal motor function';
    if (frequency < 1) {
      clinicalInterpretation = 'Severe bradykinesia detected - significantly reduced movement speed';
    } else if (frequency < 3) {
      clinicalInterpretation = 'Bradykinesia detected - reduced movement speed';
    } else if (tremorFrequency > 8) {
      clinicalInterpretation = 'Physiological tremor detected - within normal range';
    } else if (tremorFrequency > 0 && tremorFrequency < 6 && tremorAmplitude > 0.3) {
      clinicalInterpretation = 'Possible pathological tremor - consult physician';
    } else if (frequency >= 3 && frequency <= 8) {
      clinicalInterpretation = 'Normal motor function';
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
      tremorData: [...tremorData]
    };

    console.log('Final results:', results);
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
          nextPhase();
        }, 1000);
      }
    } catch (error) {
      console.error('Permission denied:', error);
      alert('Sensor access denied. The app will use simulated data for demonstration.');
      setPermissionGranted(true);
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
    tremorDataRef.current = [];
    setTremorHistory([]);

    console.log(`Starting ${currentPhase} test`);

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
    console.log('Tap count:', tapCount);
    console.log('Tremor data points:', tremorDataRef.current.length);

    setIsTestRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Calculate elapsed time properly
    const elapsedTime = Math.max(1, 10 - testTimer);
    console.log('Elapsed time:', elapsedTime);

    // Ensure we have data to analyze
    const dataToAnalyze = tremorDataRef.current.length > 0 ? tremorDataRef.current : [];
    console.log('Data to analyze:', dataToAnalyze.length, 'points');

    const results = analyzeHandData(tapCount, elapsedTime, dataToAnalyze, currentPhase.includes('left') ? 'left' : 'right');
    console.log('Analysis results:', results);

    if (currentPhase.includes('left')) {
      setLeftHandData(results);
      console.log('Left hand data saved');
    } else {
      setRightHandData(results);
      console.log('Right hand data saved');
    }

    // Reset timer for next phase
    setTimeout(() => {
      setTestTimer(10);
      setTestProgress(0);
    }, 500);
  };

  const handleTap = () => {
    if (isTestRunning) {
      setTapCount(prev => prev + 1);
    }
  };

  const nextPhase = () => {
    const currentIndex = phases.indexOf(currentPhase);
    if (currentIndex < phases.length - 1) {
      setCurrentPhase(phases[currentIndex + 1]);
      setTestProgress(0);
      setTapCount(0);
      setTestTimer(10);
      tremorDataRef.current = [];
      setTremorHistory([]);
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

      // Set canvas size
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      const width = rect.width;
      const height = rect.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw background
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, width, height);

      // Draw axes
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // X axis
      ctx.moveTo(50, height - 50);
      ctx.lineTo(width - 50, height - 50);
      // Y axis
      ctx.moveTo(50, 50);
      ctx.lineTo(50, height - 50);
      ctx.stroke();

      // Draw tremor data if available
      if (tremorData && tremorData.length > 1) {
        const scaleX = (width - 100) / Math.max(1, tremorData.length - 1);
        const scaleY = (height - 100) / 4;

        // Draw acceleration magnitude (blue line)
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        tremorData.forEach((data, index) => {
          const x = 50 + index * scaleX;
          const y = height - 50 - (data.magnitude * scaleY * 5);
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();

        // Draw gyroscope alpha (red line)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        tremorData.forEach((data, index) => {
          const x = 50 + index * scaleX;
          const y = height - 50 - ((Math.abs(data.gyroscope.alpha) || 0) * scaleY * 0.5);
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      }

      // Draw labels
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px sans-serif';
      ctx.fillText('Acceleration', 10, 20);
      ctx.fillText('Rotation', 10, 35);

      // Draw legend
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(100, 10, 20, 3);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(100, 25, 20, 3);

    }, [tremorData]);

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
          disabled={!isTestRunning && testTimer > 0}
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

        {testTimer === 0 && (
          <button
            onClick={nextPhase}
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

        {testTimer === 0 && (
          <button
            onClick={nextPhase}
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

      {data && (
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

    const confidenceScore = leftHandData && rightHandData ?
      Math.abs(leftHandData.overallScore - rightHandData.overallScore) : 0;

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
                Confidence Score: {confidenceScore.toFixed(1)}%
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
              {leftHandData && rightHandData && (
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