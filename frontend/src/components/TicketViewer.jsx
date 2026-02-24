import { useState } from 'react';

/**
 * TicketViewer — modal component showing ticket details, QR code, event info
 * Props: ticket (registration object), onClose callback
 */
export default function TicketViewer({ ticket, onClose }) {
    if (!ticket) return null;

    const event = ticket.eventId || {};

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card ticket-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>

                <div className="ticket-header">
                    <h2>🎫 Event Ticket</h2>
                    <span className={`status-badge status-${ticket.status}`}>{ticket.status}</span>
                </div>

                {/* QR Code */}
                {ticket.qrCode && (
                    <div className="ticket-qr">
                        <img src={ticket.qrCode} alt="QR Code" />
                    </div>
                )}

                {/* Ticket Details */}
                <div className="ticket-details">
                    <div className="ticket-row">
                        <strong>Ticket ID</strong>
                        <span className="ticket-id-value">{ticket.ticketId}</span>
                    </div>
                    <div className="ticket-row">
                        <strong>Event</strong>
                        <span>{event.name || 'N/A'}</span>
                    </div>
                    <div className="ticket-row">
                        <strong>Type</strong>
                        <span>{event.type || 'N/A'}</span>
                    </div>
                    <div className="ticket-row">
                        <strong>Status</strong>
                        <span>{event.status || 'N/A'}</span>
                    </div>
                    {event.startDate && (
                        <div className="ticket-row">
                            <strong>Date</strong>
                            <span>{new Date(event.startDate).toLocaleDateString()}</span>
                        </div>
                    )}
                    {event.organizerId?.organizerName && (
                        <div className="ticket-row">
                            <strong>Organizer</strong>
                            <span>{event.organizerId.organizerName}</span>
                        </div>
                    )}
                    {ticket.attended && (
                        <div className="ticket-row">
                            <strong>Attended</strong>
                            <span>✅ {ticket.attendedAt ? new Date(ticket.attendedAt).toLocaleString() : 'Yes'}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
