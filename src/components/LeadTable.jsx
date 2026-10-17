import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { FALLBACK_DEALER, LEAD_STATUSES } from '../shared/lead-options.js';

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function displayDate(value) {
  if (!value) return '—';
  const date =
    typeof value === 'string'
      ? new Date(`${value.slice(0, 10)}T00:00:00`)
      : (value?.toDate?.() ?? new Date(value));
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export default function LeadTable({ leads, onStatusChange }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus = statusFilter === 'All statuses' || lead.status === statusFilter;
      const matchesSearch =
        !term ||
        [lead.name, lead.phone, lead.pincode, lead.dealerName, lead.product].some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(term),
        );
      return matchesStatus && matchesSearch;
    });
  }, [leads, search, statusFilter]);

  return (
    <section className="lead-list-section" id="lead-records" aria-labelledby="lead-list-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PIPELINE</span>
          <h2 id="lead-list-title">
            Recent leads <span className="count-badge">{filteredLeads.length}</span>
          </h2>
        </div>
        <span className="updated-label">
          <span className="live-dot" /> Live overview
        </span>
      </div>

      <div className="table-toolbar">
        <label className="search-box">
          <Search size={17} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, phone or pincode"
            aria-label="Search leads"
          />
        </label>
        <label className="filter-box">
          <SlidersHorizontal size={16} aria-hidden="true" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
          >
            <option>All statuses</option>
            {LEAD_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Product / source</th>
              <th>Dealer</th>
              <th>Received</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <div className="customer-cell">
                    <span className="customer-avatar">
                      {(lead.name || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <strong>{lead.name || 'Name unavailable'}</strong>
                      <small>
                        +91 {lead.phone} · {lead.pincode}
                      </small>
                    </span>
                  </div>
                </td>
                <td>
                  <span className="product-cell">{lead.product}</span>
                  <small className="source-cell">{lead.source}</small>
                </td>
                <td>
                  <span className="dealer-cell">
                    {lead.dealerName || FALLBACK_DEALER.dealerName}
                  </span>
                  <small className="source-cell">{lead.dealerId || FALLBACK_DEALER.dealerId}</small>
                </td>
                <td className="date-cell">{displayDate(lead.createdOn ?? lead.createdAt)}</td>
                <td>
                  <select
                    className={`status-select status-${String(lead.status).toLowerCase()}`}
                    value={lead.status}
                    onChange={(event) => onStatusChange(lead.id, event.target.value)}
                    aria-label={`Change status for ${lead.name}`}
                  >
                    {LEAD_STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {filteredLeads.length === 0 && (
              <tr>
                <td className="empty-cell" colSpan="5">
                  {leads.length
                    ? 'No leads match these filters.'
                    : 'Your pipeline is clear. Add the first lead to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="table-footer">
        Showing {filteredLeads.length} of {leads.length} leads <span>Sorted by most recent</span>
      </footer>
    </section>
  );
}
