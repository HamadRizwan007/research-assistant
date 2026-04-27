const { useState, useEffect } = React;

function App() {
  const [history, setHistory] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  // Fetch history on component mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const response = await fetch('/history');
      if (!response.ok) {
        throw new Error('Failed to fetch analysis history');
      }
      const data = await response.json();
      setHistory(data.data || []);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAnalysisSelect = (analysis) => {
    setSelectedAnalysis(analysis);
    setError(null);
  };

  const handleNewAnalysis = () => {
    setSelectedAnalysis(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const text = e.target.text.value;
    if (!text.trim()) {
      setError('Please enter some text to analyze');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze text');
      }

      const data = await response.json();
      const newAnalysis = {
        text,
        ...data.data,
        createdAt: new Date(data.metadata.analyzedAt)
      };
      
      // Add to history and select it
      setHistory(prev => [newAnalysis, ...prev]);
      setSelectedAnalysis(newAnalysis);
      
      // Clear form
      e.target.reset();
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePdfFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        setPdfError('Please select a PDF file');
        setPdfFile(null);
        return;
      }
      
      // Validate file size (50MB limit)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        setPdfError('File size exceeds 50MB limit');
        setPdfFile(null);
        return;
      }
      
      setPdfFile(file);
      setPdfError(null);
    }
  };

  const handlePdfUpload = async (e) => {
    e.preventDefault();
    
    if (!pdfFile) {
      setPdfError('Please select a PDF file first');
      return;
    }

    setPdfLoading(true);
    setPdfError(null);

    try {
      const formData = new FormData();
      formData.append('file', pdfFile);

      const response = await fetch('/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to analyze PDF');
      }

      const data = await response.json();
      
      // Create analysis object for display
      const newAnalysis = {
        text: `PDF: ${data.data.fileName}`,
        fileName: data.data.fileName,
        textLength: data.data.textLength,
        ...data.data.analysis,
        createdAt: new Date(),
        source: 'pdf'
      };
      
      // Add to history and select it
      setHistory(prev => [newAnalysis, ...prev]);
      setSelectedAnalysis(newAnalysis);
      
      // Clear file input
      setPdfFile(null);
      e.target.reset();
    } catch (err) {
      setPdfError(err.message || 'An error occurred. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="app">
      <Sidebar 
        history={history}
        selectedAnalysis={selectedAnalysis}
        onSelectAnalysis={handleAnalysisSelect}
        onNewAnalysis={handleNewAnalysis}
        loading={historyLoading}
        error={historyError}
        onRetry={fetchHistory}
      />
      <MainPanel 
        selectedAnalysis={selectedAnalysis}
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        pdfFile={pdfFile}
        pdfLoading={pdfLoading}
        pdfError={pdfError}
        onPdfFileSelect={handlePdfFileSelect}
        onPdfUpload={handlePdfUpload}
      />
    </div>
  );
}

function Sidebar({ history, selectedAnalysis, onSelectAnalysis, onNewAnalysis, loading, error, onRetry }) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Analysis History</h2>
        <button className="new-analysis-btn" onClick={onNewAnalysis}>
          + New Analysis
        </button>
      </div>
      
      {loading && (
        <div className="sidebar-loading">
          <div className="spinner small"></div>
          <p>Loading history...</p>
        </div>
      )}
      
      {error && (
        <div className="sidebar-error">
          <p>Failed to load history</p>
          <button onClick={onRetry} className="retry-btn">Retry</button>
        </div>
      )}
      
      {!loading && !error && (
        <div className="history-list">
          {history.length === 0 ? (
            <p className="no-history">No analyses yet</p>
          ) : (
            history.map((analysis, index) => (
              <div 
                key={analysis._id || index}
                className={`history-item ${selectedAnalysis && (selectedAnalysis._id === analysis._id || selectedAnalysis.text === analysis.text) ? 'active' : ''}`}
                onClick={() => onSelectAnalysis(analysis)}
              >
                <div className="history-text">
                  {analysis.text.length > 40 ? analysis.text.substring(0, 40) + '...' : analysis.text}
                </div>
                <div className="history-timestamp">
                  {new Date(analysis.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MainPanel({ selectedAnalysis, onSubmit, loading, error, pdfFile, pdfLoading, pdfError, onPdfFileSelect, onPdfUpload }) {
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    setEmailLoading(false);
    setEmailError(null);
    setGeneratedEmail('');
    setGeneratedSubject('');
    setCopySuccess(false);
  }, [selectedAnalysis]);

  const canGenerateEmail = !!(
    selectedAnalysis &&
    selectedAnalysis.summary &&
    Array.isArray(selectedAnalysis.keyPoints) &&
    selectedAnalysis.keyPoints.length > 0
  );

  const handleGenerateEmail = async () => {
    if (!canGenerateEmail) {
      return;
    }

    setEmailLoading(true);
    setEmailError(null);
    setCopySuccess(false);

    try {
      const contextParts = [
        selectedAnalysis.summary ? `Summary:\n${selectedAnalysis.summary}` : '',
        Array.isArray(selectedAnalysis.keyPoints) && selectedAnalysis.keyPoints.length
          ? `Key points:\n- ${selectedAnalysis.keyPoints.join('\n- ')}`
          : '',
        Array.isArray(selectedAnalysis.limitations) && selectedAnalysis.limitations.length
          ? `Limitations:\n- ${selectedAnalysis.limitations.join('\n- ')}`
          : '',
        Array.isArray(selectedAnalysis.futureWork) && selectedAnalysis.futureWork.length
          ? `Future work:\n- ${selectedAnalysis.futureWork.join('\n- ')}`
          : '',
      ].filter(Boolean);

      const researchContext = contextParts.join('\n\n');

      const response = await fetch('/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          researchContext,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to generate email');
      }

      setGeneratedSubject(data.subject || '');
      setGeneratedEmail(data.email || '');
    } catch (err) {
      setEmailError(err.message || 'Failed to generate email');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleCopyEmail = async () => {
    if (!generatedEmail.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedEmail);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setEmailError('Failed to copy email. Please copy manually.');
    }
  };

  if (selectedAnalysis) {
    return (
      <div className="main-panel">
        <div className="analysis-header">
          <h2>Analysis Results</h2>
          <div className="analysis-meta">
            Analyzed on {new Date(selectedAnalysis.createdAt).toLocaleString()}
            {selectedAnalysis.fileName && (
              <span className="file-name"> • File: {selectedAnalysis.fileName}</span>
            )}
          </div>
        </div>
        
        <div className="analysis-content">
          {selectedAnalysis.source === 'pdf' && selectedAnalysis.textLength >= 8000 && (
            <div className="warning-message">
              <p>⚠️ Only the first part of the document was analyzed due to size limitations.</p>
            </div>
          )}
          
          <div className="original-text">
            <h3>{selectedAnalysis.source === 'pdf' ? 'PDF Document' : 'Original Text'}</h3>
            {selectedAnalysis.source === 'pdf' ? (
              <p><em>{selectedAnalysis.fileName}</em> ({selectedAnalysis.textLength} characters extracted)</p>
            ) : (
              <p>{selectedAnalysis.text}</p>
            )}
          </div>
          
          <div className="results-grid">
            {selectedAnalysis.summary && (
              <div className="card summary-card">
                <h3>Summary</h3>
                <div className="card-content">
                  <p>{selectedAnalysis.summary}</p>
                </div>
              </div>
            )}

            {selectedAnalysis.keyPoints && selectedAnalysis.keyPoints.length > 0 && (
              <div className="card key-points-card">
                <h3>Key Points</h3>
                <div className="card-content">
                  <ul>
                    {selectedAnalysis.keyPoints.map((point, index) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {selectedAnalysis.limitations && selectedAnalysis.limitations.length > 0 && (
              <div className="card limitations-card">
                <h3>Limitations</h3>
                <div className="card-content">
                  <ul>
                    {selectedAnalysis.limitations.map((point, index) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {selectedAnalysis.futureWork && selectedAnalysis.futureWork.length > 0 && (
              <div className="card future-work-card">
                <h3>Future Work</h3>
                <div className="card-content">
                  <ul>
                    {selectedAnalysis.futureWork.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="email-generator-section">
            <div className="email-generator-header">
              <h3>Academic Email Draft</h3>
              <button
                type="button"
                className="submit-btn email-generate-btn"
                onClick={handleGenerateEmail}
                disabled={!canGenerateEmail || emailLoading}
              >
                {emailLoading ? 'Generating Email...' : 'Generate Email'}
              </button>
            </div>

            {emailError && (
              <div className="error-message email-error">
                <h3>Error</h3>
                <p>{emailError}</p>
              </div>
            )}

            {generatedEmail && (
              <div className="card email-card">
                <h3>Generated Email</h3>
                <div className="card-content">
                  {generatedSubject && (
                    <p><strong>Subject:</strong> {generatedSubject}</p>
                  )}
                  <textarea
                    className="email-editor"
                    value={generatedEmail}
                    onChange={(e) => setGeneratedEmail(e.target.value)}
                    aria-label="Generated email editor"
                  />
                  <button
                    type="button"
                    className="submit-btn copy-email-btn"
                    onClick={handleCopyEmail}
                  >
                    {copySuccess ? 'Copied!' : 'Copy to clipboard'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-panel">
      <div className="input-section">
        <h1>Research Assistant</h1>
        <p>Enter text below to analyze it using AI, or upload a PDF document</p>
        
        {/* Text Analysis Form */}
        <div className="form-section">
          <h3>Text Analysis</h3>
          <form onSubmit={onSubmit}>
            <label htmlFor="text-input">Text to analyze:</label>
            <textarea
              id="text-input"
              name="text"
              placeholder="Paste or type the text you want to analyze..."
              disabled={loading}
              required
            />
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze Text'}
            </button>
          </form>
        </div>

        {/* PDF Upload Form */}
        <div className="form-section">
          <h3>PDF Analysis</h3>
          <form onSubmit={onPdfUpload}>
            <label htmlFor="pdf-input">PDF file to analyze:</label>
            <input
              type="file"
              id="pdf-input"
              accept=".pdf"
              onChange={onPdfFileSelect}
              disabled={pdfLoading}
              required
            />
            {pdfFile && (
              <div className="file-info">
                <small>Selected: {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)</small>
              </div>
            )}
            <button type="submit" className="submit-btn" disabled={pdfLoading || !pdfFile}>
              {pdfLoading ? 'Analyzing PDF...' : 'Analyze PDF'}
            </button>
          </form>
        </div>

        {(loading || pdfLoading) && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">
              {loading ? 'Analyzing your text...' : 'Analyzing your PDF...'}
            </p>
          </div>
        )}

        {(error || pdfError) && (
          <div className="error-message">
            <h3>Error</h3>
            <p>{error || pdfError}</p>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));