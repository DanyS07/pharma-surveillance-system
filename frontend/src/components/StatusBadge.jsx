import React from 'react'
import Chip from '@mui/material/Chip';

// Status badge configuration.
//
// COLOUR LOGIC — why these specific shades:
//
//   INVESTIGATING   = #d97706 amber    → "a human is working on this" (workflow state)
//   PROBABLE_MATCH  = #c2410c orange   → "the AI is uncertain" (AI output, not human action)
//
// These two were previously identical amber, creating ambiguity on the officer dashboard.
// An officer seeing amber needs to know immediately: is this my active case, or an AI flag?
// Burnt orange (#c2410c) is visually distinct from workflow amber at a glance.

const CONFIG = {
    // Alert / investigation status — human workflow states
    OPEN:           { bg: '#fee2e2', color: '#dc2626' },
    INVESTIGATING:  { bg: '#fef3c7', color: '#d97706' },   // amber — "officer is working on this"
    RESOLVED:       { bg: '#d1fae5', color: '#059669' },

    // NSQ match results — AI output states
    NSQ_CONFIRMED:  { bg: '#fee2e2', color: '#dc2626' },   // red — confirmed threat
    PROBABLE_MATCH: { bg: '#fff7ed', color: '#c2410c' },   // burnt orange — AI uncertain, needs review
    MISMATCH:       { bg: '#f3f4f6', color: '#6b7280' },   // grey — batch matched, drug name did not
    SAFE:           { bg: '#d1fae5', color: '#059669' },   // green — cleared
    pending:        { bg: '#f3f4f6', color: '#6b7280' },
    PENDING:        { bg: '#f3f4f6', color: '#6b7280' },

    // Account status
    active:         { bg: '#d1fae5', color: '#059669' },
    suspended:      { bg: '#fee2e2', color: '#dc2626' },

    // Risk tier
    HIGH:           { bg: '#fee2e2', color: '#dc2626' },
    MEDIUM:         { bg: '#fef3c7', color: '#d97706' },
    LOW:            { bg: '#fef9c3', color: '#92400e' },
};

const LABEL = {
    NSQ_CONFIRMED:  'NSQ CONFIRMED',
    PROBABLE_MATCH: 'PROBABLE MATCH',
    pending:        'PENDING',
};

const StatusBadge = ({ status }) => {
    const cfg = CONFIG[status] || { bg: '#f3f4f6', color: '#6b7280' };
    const isCritical = status === 'NSQ_CONFIRMED' || status === 'HIGH' || status === 'OPEN';
    return (
        <Chip
            label={LABEL[status] || status}
            size="small"
            sx={{
                backgroundColor: cfg.bg,
                color:           cfg.color,
                fontWeight:      isCritical ? 700 : 600,
                fontSize:        '0.7rem',
                borderRadius:    '999px',
                height:          22,
                border:          isCritical ? `1px solid ${cfg.color}30` : 'none',
            }}
        />
    );
};

export default StatusBadge;