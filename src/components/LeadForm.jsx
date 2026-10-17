import { useState } from 'react';
import { X } from 'lucide-react';
import { isValidPincode } from '../shared/lead-data.js';
import {
  FALLBACK_DEALER,
  LEAD_PRODUCTS,
  LEAD_SOURCES,
  LEAD_VALIDATION,
} from '../shared/lead-options.js';
import { findDealer } from '../services/dealer-directory.js';

const initialValues = {
  name: '',
  phone: '',
  pincode: '',
  product: LEAD_PRODUCTS[0],
  source: LEAD_SOURCES[0],
};

export default function LeadForm({ onClose, onSubmit, submitting }) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState('');
  const dealer = findDealer(values.pincode);
  const pincodeValid = isValidPincode(values.pincode);

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await onSubmit(values);
      setValues(initialValues);
    } catch (submitError) {
      setError(submitError.message || 'Unable to save this lead.');
    }
  }

  return (
    <div
      className="drawer-scrim"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="lead-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-form-title"
      >
        <header className="drawer-header">
          <div>
            <span className="eyebrow">NEW OPPORTUNITY</span>
            <h2 id="lead-form-title">Add a lead</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close form">
            <X size={18} />
          </button>
        </header>

        <form className="lead-form" onSubmit={handleSubmit}>
          <label>
            Customer name
            <input
              autoFocus
              required
              maxLength={LEAD_VALIDATION.maxNameLength}
              autoComplete="name"
              name="name"
              value={values.name}
              onChange={updateField}
              placeholder="e.g. Ravi Kumar"
            />
          </label>
          <label>
            Mobile number
            <span className="input-wrap">
              <span className="country-code">+91</span>
              <input
                required
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={values.phone}
                onChange={updateField}
                placeholder="10-digit mobile"
                maxLength={20}
                pattern="\+?[0-9][0-9\s\(\)\.\-]*"
                title="Enter a 10-digit Indian mobile number, optionally with +91."
                aria-describedby="mobile-help"
              />
            </span>
            <small id="mobile-help">Enter a valid Indian mobile number, optionally with +91.</small>
          </label>
          <label>
            Pincode
            <input
              required
              name="pincode"
              inputMode="numeric"
              autoComplete="postal-code"
              value={values.pincode}
              onChange={updateField}
              placeholder="6-digit pincode"
              maxLength={6}
              pattern="[1-9][0-9]{5}"
              title="Enter a valid 6-digit Indian pincode."
            />
          </label>
          <label>
            Product
            <select required name="product" value={values.product} onChange={updateField}>
              {LEAD_PRODUCTS.map((product) => (
                <option key={product}>{product}</option>
              ))}
            </select>
          </label>
          <label>
            Lead source
            <select required name="source" value={values.source} onChange={updateField}>
              {LEAD_SOURCES.map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </label>

          <div className={`assignment-preview ${pincodeValid ? '' : 'is-pending'}`}>
            <span className="assignment-dot" />
            <div>
              <span className="preview-label">AUTO-ASSIGNED TO</span>
              <strong>
                {pincodeValid
                  ? (dealer?.dealerName ?? FALLBACK_DEALER.dealerName)
                  : 'Enter a valid pincode to route'}
              </strong>
            </div>
            {pincodeValid && <span className="preview-city">{dealer?.city ?? 'No match'}</span>}
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="drawer-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button button-primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save lead'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
