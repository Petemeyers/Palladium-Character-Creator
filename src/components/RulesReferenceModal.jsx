import React from 'react';
import PropTypes from 'prop-types';
import '../styles/RulesReference.css';

const SRD_PDF_PATH = '/reference/SRD_CC_v5.2.1.pdf';
const DND_BEYOND_SRD_URL = 'https://www.dndbeyond.com/srd';
const CC_BY_4_LEGAL_URL = 'https://creativecommons.org/licenses/by/4.0/legalcode';

const referenceLinks = [
  { label: 'Combat', page: 23, search: 'Combat' },
  { label: 'Actions', page: 15, search: 'Actions' },
  { label: 'Movement', page: 24, search: 'Movement' },
  { label: 'Damage and Healing', page: 34, search: 'Damage and Healing' },
  { label: 'Conditions / Rules Glossary', page: 37, search: 'Rules Glossary' },
  { label: 'Spells', page: 180, search: 'Spells' },
  { label: 'Monsters', page: 254, search: 'Monsters' },
];

function buildPdfUrl({ page, search } = {}) {
  const params = [];
  if (page) params.push(`page=${page}`);
  if (search) params.push(`search=${encodeURIComponent(search)}`);
  return params.length ? `${SRD_PDF_PATH}#${params.join('&')}` : SRD_PDF_PATH;
}

const RulesReferenceModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="rules-reference-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="rules-reference-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-reference-title"
        aria-describedby="rules-reference-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="rules-reference-header">
          <div>
            <h2 id="rules-reference-title" className="rules-reference-title">Rules Reference</h2>
            <p id="rules-reference-description" className="rules-reference-subtitle">
              SRD 5.2.1 PDF reference. Medieval Combat Simulator rules remain unchanged.
            </p>
          </div>
          <button type="button" className="rules-reference-close" onClick={onClose} aria-label="Close rules reference">
            Close
          </button>
        </header>

        <div className="rules-reference-body">
          <aside className="rules-reference-sidebar">
            <h3>Quick Links</h3>
            <div className="rules-reference-links">
              {referenceLinks.map((link) => (
                <a
                  key={link.label}
                  href={buildPdfUrl(link)}
                  target="rules-reference-frame"
                  className="rules-reference-link"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <h3>Attribution / Legal</h3>
            <p className="rules-reference-legal">
              This work includes material from the System Reference Document 5.2.1
              ("SRD 5.2.1") by Wizards of the Coast LLC, available at{' '}
              <a href={DND_BEYOND_SRD_URL} target="_blank" rel="noreferrer">
                {DND_BEYOND_SRD_URL}
              </a>
              . The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0
              International License, available at{' '}
              <a href={CC_BY_4_LEGAL_URL} target="_blank" rel="noreferrer">
                {CC_BY_4_LEGAL_URL}
              </a>
              .
            </p>
            <p className="rules-reference-legal">
              The PDF is provided as a rules reference. Medieval Combat Simulator keeps
              its own original mechanics and does not adopt the reference document as
              active game logic.
            </p>
          </aside>

          <div className="rules-reference-viewer-wrap">
            <iframe
              title="SRD 5.2.1 Rules Reference PDF"
              name="rules-reference-frame"
              src={buildPdfUrl()}
              className="rules-reference-viewer"
            />
            <p className="rules-reference-fallback">
              If the PDF does not display,{' '}
              <a href={SRD_PDF_PATH} target="_blank" rel="noreferrer">
                open the SRD 5.2.1 PDF in a new tab
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

RulesReferenceModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export { SRD_PDF_PATH, buildPdfUrl, DND_BEYOND_SRD_URL, CC_BY_4_LEGAL_URL };
export default RulesReferenceModal;
