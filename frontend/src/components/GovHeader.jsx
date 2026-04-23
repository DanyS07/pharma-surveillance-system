import React from 'react'
import Box        from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// ── Ashoka Lion Capital (National Emblem of India) ─────────────────
// SVG rendering of the Lion Capital — the only legally correct way to
// display the emblem on a digital government portal per GIGW guidelines.
// Must be displayed in proper ratio, no distortion, on official pages.
// Colour: white on dark background (acceptable per usage rules).
const AshokaEmblem = ({ size = 48 }) => (
    <svg width={size} height={size * 1.1} viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Abacus / base plate */}
        <rect x="15" y="88" width="70" height="6" rx="2" fill="white" opacity="0.95"/>
        {/* Dharma Chakra wheel on abacus */}
        <circle cx="50" cy="78" r="7" stroke="white" strokeWidth="2" fill="none" opacity="0.85"/>
        <circle cx="50" cy="78" r="1.5" fill="white" opacity="0.85"/>
        {/* Wheel spokes */}
        {[0,45,90,135,180,225,270,315].map((deg, i) => (
            <line key={i}
                x1={50 + Math.cos(deg * Math.PI/180) * 1.5}
                y1={78 + Math.sin(deg * Math.PI/180) * 1.5}
                x2={50 + Math.cos(deg * Math.PI/180) * 5.5}
                y2={78 + Math.sin(deg * Math.PI/180) * 5.5}
                stroke="white" strokeWidth="1" opacity="0.85"/>
        ))}
        {/* Bell capital */}
        <ellipse cx="50" cy="68" rx="16" ry="5" fill="white" opacity="0.7"/>
        {/* Lion body — front lion (simplified heraldic) */}
        <path d="M38 65 C36 58 34 52 36 46 C37 42 40 40 44 40 L56 40 C60 40 63 42 64 46 C66 52 64 58 62 65 Z"
              fill="white" opacity="0.95"/>
        {/* Lion heads */}
        <ellipse cx="40" cy="38" rx="7" ry="6" fill="white" opacity="0.95"/>
        <ellipse cx="60" cy="38" rx="7" ry="6" fill="white" opacity="0.95"/>
        {/* Mane */}
        <ellipse cx="40" cy="37" rx="8.5" ry="7.5" fill="none" stroke="white" strokeWidth="1.5" opacity="0.8"/>
        <ellipse cx="60" cy="37" rx="8.5" ry="7.5" fill="none" stroke="white" strokeWidth="1.5" opacity="0.8"/>
        {/* Eyes */}
        <circle cx="37.5" cy="36.5" r="1.2" fill="#1e3a5f"/>
        <circle cx="62.5" cy="36.5" r="1.2" fill="#1e3a5f"/>
        {/* Satyameva Jayate text */}
        <text x="50" y="107" textAnchor="middle" fontSize="5.5" fontFamily="serif"
              fill="white" opacity="0.9" fontWeight="bold">
            सत्यमेव जयते
        </text>
    </svg>
);

// ── Government Header Component ────────────────────────────────────
// Structure per GIGW (Guidelines for Indian Government Websites):
//
//   Row 1: Tricolour accent stripe (saffron → white → green)
//   Row 2: Ashoka emblem | Department name (bilingual) | Ministry attribution
//
// Correct text hierarchy for a STATE department:
//   Primary:   "Drug Control Department, Government of Kerala"
//   Secondary: "Under the Ministry of Health & Family Welfare"
//
// "Government of India" is NOT shown — this is a state body, not central govt.
// Kerala state portal convention: Malayalam name appears below English name.
const GovHeader = () => (
    <>
        {/* Tricolour stripe — Indian flag colours, thin accent bar */}
        <Box sx={{ display: 'flex', height: '5px', width: '100%' }}>
            <Box sx={{ flex: 1, backgroundColor: '#FF9933' }} />  {/* Saffron */}
            <Box sx={{ flex: 1, backgroundColor: '#FFFFFF' }} />  {/* White  */}
            <Box sx={{ flex: 1, backgroundColor: '#138808' }} />  {/* Green  */}
        </Box>

        {/* Main header bar */}
        <Box sx={{
            backgroundColor: '#1e3a5f',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: { xs: 2, md: 4 },
            py: 1.2,
            gap: 2,
        }}>
            {/* Left: Emblem + Department name */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <AshokaEmblem size={46} />
                <Box>
                    {/* English — primary */}
                    <Typography sx={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        lineHeight: 1.2,
                        letterSpacing: '0.01em',
                        color: 'white',
                    }}>
                        Drug Control Department
                    </Typography>
                    {/* Malayalam — secondary (state bilingual requirement) */}
                    <Typography sx={{
                        fontSize: '0.75rem',
                        opacity: 0.75,
                        lineHeight: 1.3,
                        fontFamily: 'serif',
                    }}>
                        ഡ്രഗ് കൺട്രോൾ വകുപ്പ്
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', opacity: 0.6, mt: 0.2 }}>
                        Government of Kerala
                    </Typography>
                </Box>
            </Box>

            {/* Right: Ministry attribution — correct for state dept */}
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                <Typography sx={{ fontSize: '0.68rem', opacity: 0.7, lineHeight: 1.5 }}>
                    Under the Ministry of Health & Family Welfare
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', opacity: 0.55 }}>
                    Government of Kerala
                </Typography>
            </Box>
        </Box>
    </>
);

export default GovHeader;