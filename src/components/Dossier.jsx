import React, { useState } from 'react';
import { DOSSIER_METHOD, DOSSIER_SAMPLE, DOSSIER_SCOPE } from '../config/dossier';
import { downloadSampleDossier } from '../services/sampleDossier';

export default function Dossier() {
  const [sampleOpen, setSampleOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    setStatus(null);
    try {
      const saved = await downloadSampleDossier({
        url: DOSSIER_SAMPLE.pdfPath,
        filename: DOSSIER_SAMPLE.filename,
      });
      setStatus({
        kind: 'ok',
        text: saved.method === 'native'
          ? `Saved to Documents · ${saved.filename}`
          : `Downloaded · ${saved.filename}`,
      });
    } catch (error) {
      setStatus({ kind: 'bad', text: error?.message || 'The sample PDF could not be saved.' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="dos-page">
      <section className="dos-hero" aria-labelledby="dossier-title">
        <div className="dos-eyebrow">
          Private research · {DOSSIER_SCOPE.map((game) => game.label).join(' / ')}
        </div>
        <h1 id="dossier-title">One card. Researched properly.</h1>
        <p>
          A human-reviewed brief for the exact printing you own and the decision you are already considering.
        </p>
        <div className="dos-rule"><span>Retain</span><i /><span>Reallocate</span><i /><span>Revisit</span></div>
      </section>

      <section className="dos-method" aria-labelledby="dossier-method-title">
        <div className="dos-section-heading">
          <span>Research method</span>
          <h2 id="dossier-method-title">What goes into the file</h2>
        </div>
        <ol>
          {DOSSIER_METHOD.map((item) => (
            <li key={item.number}>
              <span className="dos-number">{item.number}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="dos-sample" aria-labelledby="dossier-sample-title">
        <div className="dos-sample-label">Sample dossier</div>
        <div className="dos-sample-top">
          <div>
            <h2 id="dossier-sample-title">{DOSSIER_SAMPLE.cardName}</h2>
            <p>{DOSSIER_SAMPLE.setName}</p>
            <code>{DOSSIER_SAMPLE.number} · {DOSSIER_SAMPLE.rarity}</code>
          </div>
          <div className="dos-sample-mark" aria-hidden="true"><span>株</span><b>D</b></div>
        </div>

        <p className="dos-finding">{DOSSIER_SAMPLE.finding}</p>

        <div className="dos-actions">
          <button
            type="button"
            className="dos-button dos-button--quiet"
            aria-expanded={sampleOpen}
            aria-controls="dossier-sample-preview"
            onClick={() => setSampleOpen((open) => !open)}
          >
            {sampleOpen ? 'Close sample' : 'View sample'}
          </button>
          <button
            type="button"
            className="dos-button dos-button--primary"
            disabled={downloading}
            onClick={download}
          >
            {downloading ? 'Saving PDF…' : 'Download PDF'}
          </button>
        </div>

        {sampleOpen && (
          <div id="dossier-sample-preview" className="dos-preview">
            <div><span>Verified</span><p>{DOSSIER_SAMPLE.known}</p></div>
            <div><span>Open fact</span><p>{DOSSIER_SAMPLE.unknown}</p></div>
            <div><span>Research lean</span><p>Revisit after exact completed-sale or population evidence appears.</p></div>
          </div>
        )}

        {status && (
          <div className={`dos-status ${status.kind === 'bad' ? 'dos-status--bad' : ''}`} role="status">
            {status.text}
          </div>
        )}
      </section>

      <p className="dos-footnote">One deliberate request. No automatic background research.</p>
    </div>
  );
}
