import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { organizerEventAPI } from '../services/api';

/**
 * QRScanner — organizer page with:
 * - Camera-based QR scanning via html5-qrcode
 * - File upload (QR image)
 * - Manual ticket ID input
 * - Live attendance dashboard
 */
export default function QRScanner() {
    const { id } = useParams();
    const [mode, setMode] = useState('manual'); // 'camera' | 'upload' | 'manual'
    const [ticketInput, setTicketInput] = useState('');
    const [scanResult, setScanResult] = useState(null);
    const [scanError, setScanError] = useState('');
    const [scanning, setScanning] = useState(false);
    const [dashboard, setDashboard] = useState(null);
    const [dashTab, setDashTab] = useState('recent'); // 'recent' | 'pending'
    const scannerRef = useRef(null);
    const html5QrRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => { fetchDashboard(); }, []);

    useEffect(() => {
        // Start/stop camera scanner based on mode
        if (mode === 'camera') {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [mode]);

    const fetchDashboard = async () => {
        try {
            const { data } = await organizerEventAPI.getAttendanceDashboard(id);
            setDashboard(data.data);
        } catch (err) { /* ignore */ }
    };

    const startCamera = async () => {
        try {
            const { Html5Qrcode } = await import('html5-qrcode');
            if (html5QrRef.current) {
                try { await html5QrRef.current.stop(); } catch (e) { /* ignore */ }
            }
            const scanner = new Html5Qrcode('qr-reader');
            html5QrRef.current = scanner;
            await scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    handleQRData(decodedText);
                    stopCamera();
                    setMode('manual');
                },
                () => { /* ignore scan failures */ }
            );
        } catch (err) {
            setScanError('Camera not available. Use file upload or manual entry.');
            setMode('manual');
        }
    };

    const stopCamera = async () => {
        if (html5QrRef.current) {
            try { await html5QrRef.current.stop(); } catch (e) { /* already stopped */ }
            html5QrRef.current = null;
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const { Html5Qrcode } = await import('html5-qrcode');
            const scanner = new Html5Qrcode('qr-file-reader');
            const result = await scanner.scanFile(file, true);
            handleQRData(result);
            scanner.clear();
        } catch (err) {
            setScanError('Could not read QR code from image. Try another image or enter ticket ID manually.');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleQRData = (rawData) => {
        try {
            const parsed = JSON.parse(rawData);
            if (parsed.ticketId) {
                submitTicketId(parsed.ticketId);
            } else {
                setScanError('Invalid QR code format');
            }
        } catch {
            // If it's not JSON, treat the raw string as ticketId
            if (rawData.startsWith('FEL-')) {
                submitTicketId(rawData);
            } else {
                setScanError('Invalid QR code format');
            }
        }
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (!ticketInput.trim()) return;
        submitTicketId(ticketInput.trim());
    };

    const submitTicketId = async (ticketId) => {
        setScanResult(null);
        setScanError('');
        setScanning(true);
        try {
            const { data } = await organizerEventAPI.scanQR(id, { ticketId });
            setScanResult({ success: true, message: data.message, participant: data.data.participant });
            setTicketInput('');
            fetchDashboard();
        } catch (err) {
            const msg = err.response?.data?.message || 'Scan failed';
            setScanResult({ success: false, message: msg });
        } finally { setScanning(false); }
    };

    const d = dashboard || {};

    return (
        <div className="main-content">
            <Link to={`/organizer/events/${id}`} className="back-link">← Back to Event</Link>

            <div className="page-header">
                <h1>📷 QR Scanner & Attendance</h1>
            </div>

            {/* Attendance Stats */}
            <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="dashboard-card">
                    <div className="dashboard-card-label">Total Registered</div>
                    <div className="dashboard-card-value">{d.total ?? '—'}</div>
                </div>
                <div className="dashboard-card">
                    <div className="dashboard-card-label">Scanned</div>
                    <div className="dashboard-card-value" style={{ color: 'var(--success)' }}>{d.scannedCount ?? '—'}</div>
                </div>
                <div className="dashboard-card">
                    <div className="dashboard-card-label">Not Scanned</div>
                    <div className="dashboard-card-value" style={{ color: 'var(--warning)' }}>{d.notScannedCount ?? '—'}</div>
                </div>
                <div className="dashboard-card">
                    <div className="dashboard-card-label">Scan Rate</div>
                    <div className="dashboard-card-value">{d.total ? `${Math.round((d.scannedCount / d.total) * 100)}%` : '—'}</div>
                </div>
            </div>

            {/* Scanner Section */}
            <div className="scanner-section">
                {/* Mode Selector */}
                <div className="filter-tabs" style={{ marginBottom: '1rem' }}>
                    <button className={`filter-tab ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>✏️ Manual Entry</button>
                    <button className={`filter-tab ${mode === 'camera' ? 'active' : ''}`} onClick={() => setMode('camera')}>📷 Camera Scan</button>
                    <button className={`filter-tab ${mode === 'upload' ? 'active' : ''}`} onClick={() => setMode('upload')}>📁 File Upload</button>
                </div>

                {/* Camera Mode */}
                {mode === 'camera' && (
                    <div className="scanner-camera-wrap">
                        <div id="qr-reader" ref={scannerRef} style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}></div>
                        <p className="text-muted" style={{ textAlign: 'center', marginTop: '0.5rem' }}>Point camera at participant's QR code</p>
                    </div>
                )}

                {/* File Upload Mode */}
                {mode === 'upload' && (
                    <div className="scanner-upload-wrap">
                        <label className="upload-area" onClick={() => fileInputRef.current?.click()}>
                            <span className="upload-icon">📁</span>
                            <span>Click to upload a QR code image</span>
                            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileUpload}
                                style={{ display: 'none' }} />
                        </label>
                    </div>
                )}

                {/* Manual Mode */}
                {mode === 'manual' && (
                    <form className="scanner-manual-form" onSubmit={handleManualSubmit}>
                        <div className="form-group">
                            <label className="form-label">Ticket ID</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input type="text" className="form-input" placeholder="e.g. FEL-A1B2C3D4"
                                    value={ticketInput} onChange={(e) => setTicketInput(e.target.value.toUpperCase())} />
                                <button type="submit" className="btn btn-primary" disabled={scanning || !ticketInput.trim()}>
                                    {scanning ? 'Scanning...' : 'Scan'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                {/* Hidden div for file-based QR scanning */}
                <div id="qr-file-reader" style={{ display: 'none' }}></div>

                {/* Scan Result */}
                {scanResult && (
                    <div className={`scan-result ${scanResult.success ? 'scan-success' : 'scan-error'}`}>
                        <div className="scan-result-icon">{scanResult.success ? '✅' : '❌'}</div>
                        <div className="scan-result-msg">{scanResult.message}</div>
                        {scanResult.participant && (
                            <div className="scan-result-detail">
                                <span>{scanResult.participant.name}</span>
                                <span>{scanResult.participant.email}</span>
                                <span>Ticket: {scanResult.participant.ticketId}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Scan Error */}
                {scanError && (
                    <div className="alert alert-error" style={{ marginTop: '1rem' }}>{scanError}</div>
                )}
            </div>

            {/* Attendance Lists */}
            <div className="detail-section" style={{ marginTop: '1.5rem' }}>
                <div className="filter-tabs" style={{ marginBottom: '1rem' }}>
                    <button className={`filter-tab ${dashTab === 'recent' ? 'active' : ''}`} onClick={() => setDashTab('recent')}>
                        ✅ Recent Scans ({d.scannedCount || 0})
                    </button>
                    <button className={`filter-tab ${dashTab === 'pending' ? 'active' : ''}`} onClick={() => setDashTab('pending')}>
                        ⏳ Not Yet Scanned ({d.notScannedCount || 0})
                    </button>
                </div>

                {dashTab === 'recent' && (
                    d.recentScans?.length > 0 ? (
                        <table className="participants-table">
                            <thead><tr><th>Name</th><th>Email</th><th>Ticket</th><th>Scanned At</th></tr></thead>
                            <tbody>
                                {d.recentScans.map((s, i) => (
                                    <tr key={i}>
                                        <td>{s.name}</td><td>{s.email}</td><td><code>{s.ticketId}</code></td>
                                        <td>{new Date(s.attendedAt).toLocaleTimeString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="text-muted">No scans yet.</p>
                )}

                {dashTab === 'pending' && (
                    d.notYetScanned?.length > 0 ? (
                        <table className="participants-table">
                            <thead><tr><th>Name</th><th>Email</th><th>Ticket</th></tr></thead>
                            <tbody>
                                {d.notYetScanned.map((s, i) => (
                                    <tr key={i}>
                                        <td>{s.name}</td><td>{s.email}</td><td><code>{s.ticketId}</code></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="text-muted">All participants have been scanned! 🎉</p>
                )}
            </div>
        </div>
    );
}
